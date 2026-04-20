-- ==========================================
-- COOPPESA SYSTEM: DATABASE SCHEMA & CORE LOGIC
-- ==========================================
-- Run this in your Supabase SQL Editor to initialize the CoopPesa engine.

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('farmer', 'driver', 'buyer', 'admin');
CREATE TYPE currency_type AS ENUM ('COOP_PESA', 'KES');
CREATE TYPE tx_type AS ENUM ('transfer', 'topup', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'collateral_lock', 'collateral_unlock');
CREATE TYPE tx_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE loan_status AS ENUM ('active', 'defaulted', 'repaid');
CREATE TYPE blf_type AS ENUM ('GLOBAL', 'COOP');

-- 2. TABLES

-- Food Coops
CREATE TABLE coops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  region VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extended User Details (Joins with auth.users)
CREATE TABLE pesausers (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  phone VARCHAR UNIQUE NOT NULL,
  role user_role DEFAULT 'farmer',
  coop_id UUID REFERENCES coops(id),
  reputation_score INT DEFAULT 100,
  successful_trades INT DEFAULT 0,
  defaulted_loans INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES pesausers(id) UNIQUE,
  coop_pesa_balance DECIMAL(19,4) DEFAULT 0 CHECK (coop_pesa_balance >= 0),
  kes_loan_balance DECIMAL(19,4) DEFAULT 0 CHECK (kes_loan_balance >= 0),
  locked_collateral DECIMAL(19,4) DEFAULT 0 CHECK (locked_collateral >= 0),
  qr_code_hash VARCHAR UNIQUE, -- Static payload for receiving (e.g., kpl://wallet/qr_hash)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Ledger (Immutable)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_wallet_id UUID REFERENCES wallets(id),
  receiver_wallet_id UUID REFERENCES wallets(id),
  amount DECIMAL(19,4) NOT NULL CHECK (amount > 0),
  currency currency_type NOT NULL,
  type tx_type NOT NULL,
  status tx_status DEFAULT 'pending',
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Loans
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id),
  principal_amount DECIMAL(19,4) NOT NULL CHECK (principal_amount > 0),
  collateral_locked DECIMAL(19,4) NOT NULL CHECK (collateral_locked > 0),
  interest_rate DECIMAL(5,4) NOT NULL, -- e.g., 0.05 for 5%
  status loan_status DEFAULT 'active',
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basket Liquidity Funds (BLF)
CREATE TABLE liquidity_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type blf_type NOT NULL,
  coop_id UUID REFERENCES coops(id), -- Null if GLOBAL
  total_kes_balance DECIMAL(19,4) DEFAULT 0 CHECK (total_kes_balance >= 0)
);

-- 3. CORE LOGIC: STORED PROCEDURES (ACID TRANSACTIONS)

-- Transfer CoopPesa P2P Safely
CREATE OR REPLACE FUNCTION transfer_cooppesa(
  p_sender_wallet_id UUID,
  p_receiver_wallet_id UUID,
  p_amount DECIMAL,
  p_description TEXT
) RETURNS UUID AS $$
DECLARE
  v_sender_balance DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- 1. Check sender balance
  SELECT coop_pesa_balance INTO v_sender_balance 
  FROM wallets WHERE id = p_sender_wallet_id FOR UPDATE;

  IF v_sender_balance < p_amount THEN
     RAISE EXCEPTION 'Insufficient CoopPesa balance';
  END IF;

  -- 2. Deduct from sender
  UPDATE wallets SET coop_pesa_balance = coop_pesa_balance - p_amount, updated_at = NOW()
  WHERE id = p_sender_wallet_id;

  -- 3. Add to receiver
  UPDATE wallets SET coop_pesa_balance = coop_pesa_balance + p_amount, updated_at = NOW()
  WHERE id = p_receiver_wallet_id;

  -- 4. Record transaction
  INSERT INTO transactions (sender_wallet_id, receiver_wallet_id, amount, currency, type, status, description)
  VALUES (p_sender_wallet_id, p_receiver_wallet_id, p_amount, 'COOP_PESA', 'transfer', 'completed', p_description)
  RETURNING id INTO v_transaction_id;

  -- 5. Update reputation (minor bump for successful trade)
  UPDATE pesausers SET successful_trades = successful_trades + 1
  WHERE id IN (SELECT user_id FROM wallets WHERE id IN (p_sender_wallet_id, p_receiver_wallet_id));

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Borrow KES Logic (Lock Collateral)
CREATE OR REPLACE FUNCTION borrow_kes(
  p_wallet_id UUID,
  p_request_kes DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_cooppesa_balance DECIMAL;
  v_collateral_ratio DECIMAL := 0.70; -- 70% LTV
  v_required_collateral DECIMAL;
  v_loan_id UUID;
BEGIN
  -- Calculate Required Collateral
  v_required_collateral := p_request_kes / v_collateral_ratio;

  -- 1. Check if user has enough CoopPesa
  SELECT coop_pesa_balance INTO v_cooppesa_balance 
  FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF v_cooppesa_balance < v_required_collateral THEN
    RAISE EXCEPTION 'Insufficient CoopPesa to cover collateral. Required: %', v_required_collateral;
  END IF;

  -- 2. Move CoopPesa to Locked Collateral, Give KES Loan
  UPDATE wallets 
  SET 
    coop_pesa_balance = coop_pesa_balance - v_required_collateral,
    locked_collateral = locked_collateral + v_required_collateral,
    kes_loan_balance = kes_loan_balance + p_request_kes
  WHERE id = p_wallet_id;

  -- 3. Create Loan Record (5% Interest, 30 days)
  INSERT INTO loans (wallet_id, principal_amount, collateral_locked, interest_rate, due_date)
  VALUES (p_wallet_id, p_request_kes, v_required_collateral, 0.05, NOW() + INTERVAL '30 days')
  RETURNING id INTO v_loan_id;

  -- 4. Record Transaction
  INSERT INTO transactions (receiver_wallet_id, amount, currency, type, status, description)
  VALUES (p_wallet_id, p_request_kes, 'KES', 'loan_disbursement', 'completed', 'Loan issued against collateral');

  RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql;
