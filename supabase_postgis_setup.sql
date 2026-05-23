-- STEP 1: Enable PostGIS extension in Supabase
create extension if not exists postgis schema extensions;

-- STEP 2: Create the land_data table
-- This table stores farm data including geometry (PostGIS point)
create table if not exists public.land_data (
    id uuid default gen_random_uuid() primary key,
    farmer_id uuid references auth.users(id), -- Assuming auth.users is used
    location geography(POINT) not null, -- Stores GPS coordinates natively
    soil_type text,
    ph_level numeric,
    moisture_percentage numeric,
    current_crop text,
    created_at timestamp with time zone default now()
);

-- Note:
-- To insert data using PostGIS from your apps:
-- INSERT INTO public.land_data (location, soil_type, ph_level, moisture_percentage) 
-- VALUES (ST_Point(longitude, latitude), 'Clay', 6.5, 45.2);

-- Set up Row Level Security
alter table public.land_data enable row level security;
create policy "Users can view all land data" on public.land_data for select using (true);
create policy "Users can insert land data" on public.land_data for insert with check (auth.role() = 'authenticated');
