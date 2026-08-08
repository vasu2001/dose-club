-- Listings ("share requests"): a coffee someone is willing to share doses of.
-- A listing stays active until the owner closes it; one bag can serve
-- several trades.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  coffee_id uuid not null references public.coffees (id) on delete cascade,
  -- The stash bag this listing shares from, when created from inventory.
  -- roast_date is copied from the bag at creation; older listings have no bag.
  bag_id uuid references public.bags (id) on delete set null,
  roast_date date,
  dose_grams integer not null default 18 check (dose_grams between 5 and 100),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_owner_id_idx on public.listings (owner_id);
create index listings_coffee_id_idx on public.listings (coffee_id);
create index listings_bag_id_idx on public.listings (bag_id);
create index listings_status_created_at_idx on public.listings (status, created_at desc);

alter table public.listings enable row level security;

create policy "listings_select_authenticated" on public.listings
  for select to authenticated
  using (true);

create policy "listings_insert_own" on public.listings
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "listings_update_own" on public.listings
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "listings_delete_own" on public.listings
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();
