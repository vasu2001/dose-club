-- Coffees: a user's saved coffee library. Listings and proposal offers
-- both reference a coffee instead of duplicating metadata.

create table public.coffees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  roaster text not null check (char_length(roaster) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  origin text check (char_length(origin) <= 80),
  process text check (char_length(process) <= 40),
  roast_level text check (char_length(roast_level) <= 40),
  tasting_notes text check (char_length(tasting_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coffees_owner_id_idx on public.coffees (owner_id);

alter table public.coffees enable row level security;

create policy "coffees_select_authenticated" on public.coffees
  for select to authenticated
  using (true);

create policy "coffees_insert_own" on public.coffees
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "coffees_update_own" on public.coffees
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "coffees_delete_own" on public.coffees
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create trigger coffees_set_updated_at
  before update on public.coffees
  for each row execute function public.set_updated_at();
