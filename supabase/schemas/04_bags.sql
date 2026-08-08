-- Bags: a user's physical inventory ("stash") — one row per bag of coffee
-- they own. Listings are created from bags; the bag tracks freshness state
-- (shelf / frozen / finished) while bag_events records the timeline.
--
-- Rested days are computed client-side from events: freezing PAUSES the
-- rest clock, so rested = (today - roast_date) - total days spent frozen.

create table public.bags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  coffee_id uuid not null references public.coffees (id) on delete cascade,
  roast_date date,
  size_grams integer check (size_grams between 5 and 2000),
  status text not null default 'shelf' check (status in ('shelf', 'frozen', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bags_owner_id_idx on public.bags (owner_id, created_at desc);
create index bags_coffee_id_idx on public.bags (coffee_id);

-- Timeline of what happened to a bag. `happened_at` is user-editable so a
-- bag frozen before the app existed can be backdated; multiple freeze/thaw
-- cycles are expected (dose tubes go in and out of the freezer).
create table public.bag_events (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags (id) on delete cascade,
  type text not null check (type in ('added', 'frozen', 'thawed', 'opened', 'finished')),
  happened_at timestamptz not null default now(),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

create index bag_events_bag_id_idx on public.bag_events (bag_id, happened_at);

alter table public.bags enable row level security;
alter table public.bag_events enable row level security;

-- The stash is private: only the owner sees or touches their bags.
create policy "bags_select_own" on public.bags
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "bags_insert_own" on public.bags
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "bags_update_own" on public.bags
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "bags_delete_own" on public.bags
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "bag_events_select_own" on public.bag_events
  for select to authenticated
  using (
    exists (
      select 1 from public.bags b
      where b.id = bag_id and b.owner_id = (select auth.uid())
    )
  );

create policy "bag_events_insert_own" on public.bag_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.bags b
      where b.id = bag_id and b.owner_id = (select auth.uid())
    )
  );

create policy "bag_events_delete_own" on public.bag_events
  for delete to authenticated
  using (
    exists (
      select 1 from public.bags b
      where b.id = bag_id and b.owner_id = (select auth.uid())
    )
  );

create trigger bags_set_updated_at
  before update on public.bags
  for each row execute function public.set_updated_at();

-- Log a lifecycle event and move the bag's status in one atomic step, with
-- transition checks so the timeline stays coherent.
create or replace function public.log_bag_event(
  p_bag_id uuid,
  p_type text,
  p_happened_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_new_status text;
  v_event_id uuid;
begin
  select status into v_status
  from public.bags
  where id = p_bag_id and owner_id = (select auth.uid())
  for update;
  if v_status is null then
    raise exception 'Bag not found';
  end if;

  if p_type = 'frozen' then
    if v_status = 'frozen' then raise exception 'Bag is already frozen'; end if;
    if v_status = 'finished' then raise exception 'Bag is finished'; end if;
    v_new_status := 'frozen';
  elsif p_type = 'thawed' then
    if v_status <> 'frozen' then raise exception 'Bag is not frozen'; end if;
    v_new_status := 'shelf';
  elsif p_type = 'opened' then
    if v_status = 'finished' then raise exception 'Bag is finished'; end if;
    v_new_status := v_status;
  elsif p_type = 'finished' then
    if v_status = 'finished' then raise exception 'Bag is already finished'; end if;
    v_new_status := 'finished';
  else
    raise exception 'Unknown event type %', p_type;
  end if;

  insert into public.bag_events (bag_id, type, happened_at, note)
  values (p_bag_id, p_type, coalesce(p_happened_at, now()), nullif(trim(p_note), ''))
  returning id into v_event_id;

  update public.bags set status = v_new_status where id = p_bag_id;
  return v_event_id;
end;
$$;

revoke execute on function public.log_bag_event(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.log_bag_event(uuid, text, timestamptz, text) to authenticated;
