-- =======================================================
-- PLANTWATCH DATABASE SCHEMA SETUP
-- Paste this script into your Supabase SQL Editor and run it.
-- =======================================================

-- 1. Create Profiles Table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Plants Table
create table public.plants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade default auth.uid() not null,
  name text not null,
  species text,
  emoji text default '🌿',
  status text check (status in ('thriving', 'stable', 'needs-care')) default 'stable' not null,
  health integer check (health >= 0 and health <= 100) default 100 not null,
  height_cm integer,
  potted_date date default current_date,
  soil_type text,
  sunlight text,
  watering_interval_days integer default 7,
  last_watered date default current_date,
  next_water date,
  location_name text,
  location_lat double precision,
  location_lng double precision,
  floor text,
  is_indoor boolean default true,
  color text default '#2D6A4F',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Sensor Readings Table
create table public.sensor_readings (
  id uuid default gen_random_uuid() primary key,
  plant_id uuid references public.plants(id) on delete cascade not null,
  temperature_c double precision,
  humidity_percent double precision,
  soil_moisture text check (soil_moisture in ('Wet', 'Moist', 'Dry', 'Bone Dry')),
  light_level text check (light_level in ('Low', 'Medium', 'Bright')),
  recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Growth Logs Table
create table public.growth_logs (
  id uuid default gen_random_uuid() primary key,
  plant_id uuid references public.plants(id) on delete cascade not null,
  height_cm integer not null,
  note text,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Care Logs Table
create table public.care_logs (
  id uuid default gen_random_uuid() primary key,
  plant_id uuid references public.plants(id) on delete cascade not null,
  action text check (action in ('Watered', 'Fertilized', 'Repotted', 'Pruned', 'Misted', 'Rotated', 'Treated', 'Other')) not null,
  note text,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Issues Table
create table public.issues (
  id uuid default gen_random_uuid() primary key,
  plant_id uuid references public.plants(id) on delete cascade not null,
  title text not null,
  description text,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved boolean default false not null,
  resolved_at timestamp with time zone
);

-- =======================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =======================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.plants enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.growth_logs enable row level security;
alter table public.care_logs enable row level security;
alter table public.issues enable row level security;

-- Profiles Policies
create policy "Users can read profiles" on public.profiles
  for select using (true);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Plants Policies
create policy "Users can perform all operations on their own plants" on public.plants
  for all using (auth.uid() = user_id);

-- Sensor Readings Policies
create policy "Users can perform all operations on readings of their plants" on public.sensor_readings
  for all using (
    exists (
      select 1 from public.plants
      where public.plants.id = public.sensor_readings.plant_id
      and public.plants.user_id = auth.uid()
    )
  );

-- Growth Logs Policies
create policy "Users can perform all operations on growth logs of their plants" on public.growth_logs
  for all using (
    exists (
      select 1 from public.plants
      where public.plants.id = public.growth_logs.plant_id
      and public.plants.user_id = auth.uid()
    )
  );

-- Care Logs Policies
create policy "Users can perform all operations on care logs of their plants" on public.care_logs
  for all using (
    exists (
      select 1 from public.plants
      where public.plants.id = public.care_logs.plant_id
      and public.plants.user_id = auth.uid()
    )
  );

-- Issues Policies
create policy "Users can perform all operations on issues of their plants" on public.issues
  for all using (
    exists (
      select 1 from public.plants
      where public.plants.id = public.issues.plant_id
      and public.plants.user_id = auth.uid()
    )
  );

-- =======================================================
-- PROFILE AUTO-CREATION TRIGGER
-- =======================================================

-- Function to handle new auth user and create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call function on user sign up
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =======================================================
-- REALTIME ENABLEMENT
-- =======================================================

-- Drop publication if exists to reset it
drop publication if exists supabase_realtime;

-- Create publication to subscribe to changes
create publication supabase_realtime for table 
  public.plants, 
  public.sensor_readings, 
  public.issues;
