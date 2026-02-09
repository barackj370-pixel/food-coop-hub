
-- Run this script in your Supabase SQL Editor to initialize the database tables

-- 1. Create profiles table (Public Profile)
-- This table mirrors the Auth users but stores application-specific details
-- Renamed from 'users' to 'profiles' to match application code
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text not null,
  phone text not null unique,
  role text not null,
  cluster text,
  passcode text,
  status text default 'ACTIVE',
  created_at timestamptz default now()
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Policy: Everyone can view profiles (needed for verifying agents/suppliers)
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select 
  using (true);

-- Policy: Users can insert their own profile during signup
create policy "Users can insert their own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);


-- 2. Create records table (Sales Records)
-- camelCase columns used to match existing frontend JSON payloads
create table if not exists public.records (
  id text primary key,
  date text,
  "cropType" text,
  "unitType" text,
  "farmerName" text,
  "farmerPhone" text,
  "customerName" text,
  "customerPhone" text,
  "unitsSold" numeric,
  "unitPrice" numeric,
  "totalSale" numeric,
  "coopProfit" numeric,
  status text,
  signature text,
  "createdAt" text,
  "agentPhone" text,
  "agentName" text,
  cluster text,
  order_id text,
  produce_id text, -- Added produce_id column
  agent_id uuid references public.profiles(id)
);

alter table public.records enable row level security;
create policy "Records viewable by everyone" on public.records for select using (true);
create policy "Agents can insert records" on public.records for insert with check (auth.uid() = agent_id);
create policy "Agents can update records" on public.records for update using (auth.uid() = agent_id);


-- 3. Create produce table (Produce Listings)
create table if not exists public.produce (
  id text primary key,
  date text,
  "cropType" text,
  "unitsAvailable" numeric,
  "unitType" text,
  "sellingPrice" numeric,
  "supplierName" text,
  "supplierPhone" text,
  cluster text,
  status text,
  images text, -- New column for storing JSON array of base64 images
  agent_id uuid references public.profiles(id)
);

alter table public.produce enable row level security;
create policy "Produce viewable by everyone" on public.produce for select using (true);
create policy "Agents can insert produce" on public.produce for insert with check (auth.uid() = agent_id);
create policy "Agents can update produce" on public.produce for update using (auth.uid() = agent_id);


-- 4. Create orders table (Market Orders)
create table if not exists public.orders (
  id text primary key,
  date text,
  "cropType" text,
  "unitsRequested" numeric,
  "unitType" text,
  "customerName" text,
  "customerPhone" text,
  status text,
  "agentPhone" text,
  cluster text,
  agent_id uuid references public.profiles(id)
);

alter table public.orders enable row level security;
create policy "Orders viewable by everyone" on public.orders for select using (true);
create policy "Agents can insert orders" on public.orders for insert with check (auth.uid() = agent_id);
create policy "Agents can update orders" on public.orders for update using (auth.uid() = agent_id);
