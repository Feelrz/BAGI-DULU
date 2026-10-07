-- BAGI optional cloud sync schema
-- Run this once in Supabase SQL Editor.

create table if not exists public.bagi_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bagi_user_data enable row level security;

drop policy if exists "Users can read own BAGI data" on public.bagi_user_data;
create policy "Users can read own BAGI data"
on public.bagi_user_data for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own BAGI data" on public.bagi_user_data;
create policy "Users can insert own BAGI data"
on public.bagi_user_data for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own BAGI data" on public.bagi_user_data;
create policy "Users can update own BAGI data"
on public.bagi_user_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
