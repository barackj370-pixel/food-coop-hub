-- 1. Add columns to farm_baselines
ALTER TABLE farm_baselines ADD COLUMN IF NOT EXISTS size_in_acres NUMERIC;
ALTER TABLE farm_baselines ADD COLUMN IF NOT EXISTS ai_profile TEXT;

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
