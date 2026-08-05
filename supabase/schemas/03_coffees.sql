-- Coffees: a shared catalog of coffee beans. Users pick from the catalog when
-- listing or proposing (keeping the data consistent) and can add new entries.
-- Personal opinions live in coffee_reviews — this table is objective metadata.

create table public.coffees (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  roaster_id uuid not null references public.roasters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  origin text check (char_length(origin) <= 80),
  varietal text check (char_length(varietal) <= 80),
  process text check (char_length(process) <= 40),
  roast_level text check (roast_level in ('ultralight', 'light', 'medium', 'medium-dark', 'dark', 'coal')),
  roaster_notes text check (char_length(roaster_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coffees_created_by_idx on public.coffees (created_by);
create index coffees_roaster_id_idx on public.coffees (roaster_id);
create index coffees_name_lower_idx on public.coffees (lower(name));

alter table public.coffees enable row level security;

create policy "coffees_select_authenticated" on public.coffees
  for select to authenticated
  using (true);

create policy "coffees_insert_own" on public.coffees
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "coffees_update_own" on public.coffees
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "coffees_delete_own" on public.coffees
  for delete to authenticated
  using ((select auth.uid()) = created_by);

create trigger coffees_set_updated_at
  before update on public.coffees
  for each row execute function public.set_updated_at();
