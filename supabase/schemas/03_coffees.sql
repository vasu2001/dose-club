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

-- The catalog is shared: one row per (roaster, name), case-insensitive, so
-- reviews and analytics converge on a single coffee.
create unique index coffees_roaster_name_unique_idx
  on public.coffees (roaster_id, lower(name));

alter table public.coffees enable row level security;

create policy "coffees_select_authenticated" on public.coffees
  for select to authenticated
  using (true);

create policy "coffees_insert_own" on public.coffees
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

-- True when anyone besides `p_user` depends on this coffee (listings, offers,
-- bags, reviews). SECURITY DEFINER because the caller's RLS can't see other
-- people's proposal_items/bags, which would make the check miss references.
create or replace function public.coffee_used_by_others(p_coffee_id uuid, p_user uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return exists (select 1 from public.listings l where l.coffee_id = p_coffee_id and l.owner_id is distinct from p_user)
    or exists (
      select 1 from public.proposal_items pi
      join public.proposals p on p.id = pi.proposal_id
      where pi.coffee_id = p_coffee_id and p.proposer_id is distinct from p_user
    )
    or exists (select 1 from public.bags b where b.coffee_id = p_coffee_id and b.owner_id is distinct from p_user)
    or exists (select 1 from public.coffee_reviews r where r.coffee_id = p_coffee_id and r.author_id is distinct from p_user);
end;
$$;

revoke execute on function public.coffee_used_by_others(uuid, uuid) from public, anon;
grant execute on function public.coffee_used_by_others(uuid, uuid) to authenticated;

-- Once someone else's listing/offer/bag/review points at a coffee, the
-- creator can no longer rename or delete it out from under them.
create policy "coffees_update_own" on public.coffees
  for update to authenticated
  using (
    (select auth.uid()) = created_by
    and not public.coffee_used_by_others(id, (select auth.uid()))
  )
  with check ((select auth.uid()) = created_by);

create policy "coffees_delete_own" on public.coffees
  for delete to authenticated
  using (
    (select auth.uid()) = created_by
    and not public.coffee_used_by_others(id, (select auth.uid()))
  );

-- Case-insensitive get-or-create on (roaster, name) so concurrent clients
-- and near-duplicate typing converge on one catalog row. Metadata fields
-- only apply when the row is created; an existing row wins as-is.
create or replace function public.get_or_create_coffee(
  p_roaster_name text,
  p_name text,
  p_origin text default null,
  p_varietal text default null,
  p_process text default null,
  p_roast_level text default null,
  p_roaster_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_roaster_id uuid;
  v_id uuid;
  v_name text := trim(p_name);
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'Coffee name must be between 1 and 80 characters';
  end if;

  v_roaster_id := public.get_or_create_roaster(p_roaster_name);

  select id into v_id
  from public.coffees
  where roaster_id = v_roaster_id and lower(name) = lower(v_name);
  if v_id is null then
    insert into public.coffees (created_by, roaster_id, name, origin, varietal, process, roast_level, roaster_notes)
    values (
      (select auth.uid()), v_roaster_id, v_name,
      nullif(trim(p_origin), ''), nullif(trim(p_varietal), ''), nullif(trim(p_process), ''),
      p_roast_level, nullif(trim(p_roaster_notes), '')
    )
    on conflict (roaster_id, lower(name)) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id
      from public.coffees
      where roaster_id = v_roaster_id and lower(name) = lower(v_name);
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.get_or_create_coffee(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.get_or_create_coffee(text, text, text, text, text, text, text) to authenticated;

create trigger coffees_set_updated_at
  before update on public.coffees
  for each row execute function public.set_updated_at();
