-- Run this script in the Supabase SQL editor

-- 1. Create farm_baselines table
CREATE TABLE IF NOT EXISTS farm_baselines (
    id TEXT PRIMARY KEY,
    farmer_phone TEXT NOT NULL,
    farmer_name TEXT NOT NULL,
    farm_name TEXT NOT NULL,
    cluster TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    size_in_acres NUMERIC,
    ai_profile TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE farm_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for everyone on farm_baselines" ON farm_baselines;
CREATE POLICY "Enable all for everyone on farm_baselines" ON farm_baselines FOR ALL USING (true) WITH CHECK (true);

-- 1.5 Add submission_type to table_banking_contributions
ALTER TABLE table_banking_contributions ADD COLUMN IF NOT EXISTS submission_type TEXT CHECK (submission_type IN ('DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'WEEKLY';

-- 2. Create Men/Women Articulations Tables (Table Banking)

-- Members Table
CREATE TABLE IF NOT EXISTS table_banking_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cluster TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('MEN', 'WOMEN')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Total Contributions Table
CREATE TABLE IF NOT EXISTS table_banking_contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_date DATE NOT NULL,
    cluster TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('MEN', 'WOMEN')) NOT NULL,
    amount_total NUMERIC NOT NULL,
    submitted_by TEXT NOT NULL, -- phone or name of agent
    submission_type TEXT CHECK (submission_type IN ('DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'WEEKLY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Weekly breakdown reports
CREATE TABLE IF NOT EXISTS table_banking_weekly_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start_date DATE NOT NULL,
    cluster TEXT NOT NULL,
    group_type TEXT CHECK (group_type IN ('MEN', 'WOMEN')) NOT NULL,
    member_id UUID REFERENCES table_banking_members(id),
    amount NUMERIC NOT NULL,
    submitted_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for new tables
ALTER TABLE table_banking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_banking_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_banking_weekly_reports ENABLE ROW LEVEL SECURITY;

-- Allow all for everyone globally (based on the app's open baseline style)
-- For proper production, these should be restricted to specific roles.

DROP POLICY IF EXISTS "Enable all for everyone on table_banking_members" ON table_banking_members;
CREATE POLICY "Enable all for everyone on table_banking_members" ON table_banking_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for everyone on table_banking_contributions" ON table_banking_contributions;
CREATE POLICY "Enable all for everyone on table_banking_contributions" ON table_banking_contributions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for everyone on table_banking_weekly_reports" ON table_banking_weekly_reports;
CREATE POLICY "Enable all for everyone on table_banking_weekly_reports" ON table_banking_weekly_reports FOR ALL USING (true) WITH CHECK (true);
