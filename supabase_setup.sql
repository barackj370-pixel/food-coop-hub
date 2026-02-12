
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (User Registry)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  phone text unique,
  role text,
  cluster text,
  passcode text,
  status text default 'ACTIVE',
  email text,
  last_sign_in_at timestamptz,
  provider text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Policies for Profiles (Drop first to avoid conflicts)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select 
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" 
  on public.profiles for update 
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('System Developer', 'Director', 'Manager')
    )
  );

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles" 
  on public.profiles for delete 
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('System Developer', 'Director')
    )
  );


-- 2. RECORDS (The Universal Ledger)
create table if not exists public.records (
  id text primary key,
  date text,
  crop_type text,
  unit_type text,
  farmer_name text,
  farmer_phone text,
  customer_name text,
  customer_phone text,
  units_sold numeric,
  unit_price numeric,
  total_sale numeric,
  coop_profit numeric,
  status text,
  signature text,
  created_at timestamptz default now(),
  agent_phone text,
  agent_name text,
  cluster text,
  synced boolean default true,
  order_id text,
  produce_id text,
  agent_id uuid references public.profiles(id)
);

alter table public.records enable row level security;

-- Policies for Records
drop policy if exists "Ledger viewable by everyone" on public.records;
create policy "Ledger viewable by everyone" on public.records for select using (true);

drop policy if exists "Agents can insert records" on public.records;
create policy "Agents can insert records" on public.records for insert with check (auth.role() = 'authenticated');

drop policy if exists "Agents can update records" on public.records;
create policy "Agents can update records" on public.records for update using (auth.role() = 'authenticated');

drop policy if exists "Agents can delete records" on public.records;
create policy "Agents can delete records" on public.records for delete using (auth.role() = 'authenticated');


-- 3. PRODUCE (Market Listings)
create table if not exists public.produce (
  id text primary key,
  date text,
  crop_type text,
  units_available numeric,
  unit_type text,
  selling_price numeric,
  supplier_name text,
  supplier_phone text,
  cluster text,
  status text,
  images text,
  agent_id uuid references public.profiles(id)
);

alter table public.produce enable row level security;

-- Policies for Produce
drop policy if exists "Produce viewable by everyone" on public.produce;
create policy "Produce viewable by everyone" on public.produce for select using (true);

drop policy if exists "Agents can insert produce" on public.produce;
create policy "Agents can insert produce" on public.produce for insert with check (true);

drop policy if exists "Agents can update produce" on public.produce;
create policy "Agents can update produce" on public.produce for update using (true);

drop policy if exists "Agents can delete produce" on public.produce;
create policy "Agents can delete produce" on public.produce for delete using (true);


-- 4. ORDERS (Market Requests)
create table if not exists public.orders (
  id text primary key,
  date text,
  crop_type text,
  units_requested numeric,
  unit_type text,
  customer_name text,
  customer_phone text,
  status text,
  agent_phone text,
  cluster text,
  agent_id uuid references public.profiles(id)
);

alter table public.orders enable row level security;

-- Policies for Orders
drop policy if exists "Orders viewable by everyone" on public.orders;
create policy "Orders viewable by everyone" on public.orders for select using (true);

drop policy if exists "Agents can insert orders" on public.orders;
create policy "Agents can insert orders" on public.orders for insert with check (true);

drop policy if exists "Agents can update orders" on public.orders;
create policy "Agents can update orders" on public.orders for update using (true);

drop policy if exists "Agents can delete orders" on public.orders;
create policy "Agents can delete orders" on public.orders for delete using (true);
