-- Proposals: offer a bundle of coffees (each a coffee + dose, optionally
-- backed by one of the proposer's own listings) in exchange for a dose of
-- someone else's listing. Lifecycle:
--   pending -> accepted -> completed (both sides confirm the exchange)
--   pending -> declined (owner) | withdrawn (proposer)
--   pending -> listing_closed (auto-archived when the listing is closed)

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'completed', 'listing_closed')),
  proposer_confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposals_listing_id_idx on public.proposals (listing_id);
create index proposals_proposer_id_idx on public.proposals (proposer_id);

-- A double-submit race produced duplicates during testing: one pending
-- proposal per proposer per listing.
create unique index proposals_one_pending_idx
  on public.proposals (listing_id, proposer_id)
  where status = 'pending';

-- What the proposer puts in the jar. `listing_id` is set when the item is
-- offered straight off the proposer's own shelf — that keeps the two
-- listings linked once the trade is accepted.
create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  coffee_id uuid not null references public.coffees (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  dose_grams integer not null check (dose_grams between 5 and 100),
  created_at timestamptz not null default now()
);

create index proposal_items_proposal_id_idx on public.proposal_items (proposal_id);
create index proposal_items_listing_id_idx on public.proposal_items (listing_id);

-- The same shelf listing can appear only once per proposal.
create unique index proposal_items_listing_unique_idx
  on public.proposal_items (proposal_id, listing_id)
  where listing_id is not null;

alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

-- Visible to the proposer and to the owner of the listing being proposed on.
create policy "proposals_select_involved" on public.proposals
  for select to authenticated
  using (
    (select auth.uid()) = proposer_id
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );

-- Items follow their parent proposal's visibility.
create policy "proposal_items_select_involved" on public.proposal_items
  for select to authenticated
  using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and (
          p.proposer_id = (select auth.uid())
          or exists (
            select 1 from public.listings l
            where l.id = p.listing_id and l.owner_id = (select auth.uid())
          )
        )
    )
  );

-- Proposals are created through create_proposal() below (atomic with their
-- items), so there is no direct insert policy. Proposers may withdraw their
-- own pending proposals; owner decisions and confirmations go through the
-- functions below.
create policy "proposals_update_proposer" on public.proposals
  for update to authenticated
  using ((select auth.uid()) = proposer_id)
  with check ((select auth.uid()) = proposer_id);

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- Timeline timestamps, stamped automatically on status change.
create or replace function public.stamp_proposal_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.accepted_at = coalesce(new.accepted_at, now());
    elsif new.status in ('declined', 'listing_closed') then
      new.declined_at = coalesce(new.declined_at, now());
    elsif new.status = 'withdrawn' then
      new.withdrawn_at = coalesce(new.withdrawn_at, now());
    elsif new.status = 'completed' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;
  end if;
  return new;
end;
$$;

create trigger proposals_stamp_status
  before update on public.proposals
  for each row execute function public.stamp_proposal_status();

-- Create a proposal with its offer items in one transaction.
-- p_items: jsonb array of { coffee_id?, listing_id?, dose_grams }.
--   * listing_id set -> item comes off the proposer's own shelf; the coffee
--     and (if dose omitted) the dose are taken from that listing.
--   * otherwise coffee_id + dose_grams are required (library offer).
create or replace function public.create_proposal(
  p_listing_id uuid,
  p_message text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_proposal_id uuid;
  v_item jsonb;
  v_coffee_id uuid;
  v_item_listing_id uuid;
  v_dose integer;
  v_own_listing public.listings%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 then
    raise exception 'Offer at least one coffee';
  end if;
  if jsonb_array_length(p_items) > 5 then
    raise exception 'An offer can hold at most 5 coffees';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and l.owner_id <> v_uid
      and l.status = 'active'
  ) then
    raise exception 'That trade is not allowed — the listing may no longer be active.';
  end if;

  insert into public.proposals (listing_id, proposer_id, message)
  values (p_listing_id, v_uid, nullif(trim(p_message), ''))
  returning id into v_proposal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_listing_id := (v_item ->> 'listing_id')::uuid;
    v_coffee_id := (v_item ->> 'coffee_id')::uuid;
    v_dose := (v_item ->> 'dose_grams')::integer;

    if v_item_listing_id is not null then
      select * into v_own_listing
      from public.listings
      where id = v_item_listing_id;

      if not found or v_own_listing.owner_id <> v_uid
         or v_own_listing.status <> 'active' then
        raise exception 'You can only offer active listings from your own shelf';
      end if;

      v_coffee_id := v_own_listing.coffee_id;
      v_dose := coalesce(v_dose, v_own_listing.dose_grams);
    end if;

    if v_coffee_id is null or v_dose is null then
      raise exception 'Each offered coffee needs a coffee and a dose';
    end if;

    insert into public.proposal_items (proposal_id, coffee_id, listing_id, dose_grams)
    values (v_proposal_id, v_coffee_id, v_item_listing_id, v_dose);
  end loop;

  return v_proposal_id;
end;
$$;

-- Accepting a proposal affects only that proposal: rival pending proposals
-- survive and can each be accepted too — one listing serves many trades.
-- Listings never close automatically; closing is offered as an option when
-- a trade completes.
create or replace function public.accept_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_owner uuid;
  v_status text;
begin
  select listing_id, status into v_listing_id, v_status
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  select owner_id into v_owner
  from public.listings
  where id = v_listing_id;

  if v_owner is distinct from (select auth.uid()) then
    raise exception 'Only the listing owner can accept a proposal';
  end if;

  if v_status <> 'pending' then
    raise exception 'Proposal is no longer pending';
  end if;

  update public.proposals
  set status = 'accepted'
  where id = p_proposal_id;
end;
$$;

-- Proposals auto-archive ONLY when a listing goes away (owner closes it):
--   * pending proposals ON the listing -> listing_closed ("listing closed")
--   * pending proposals OFFERING the listing as an item -> withdrawn
-- Accepted trades in flight are left alone.
create or replace function public.archive_proposals_on_listing_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'closed' and old.status = 'active' then
    update public.proposals
    set status = 'listing_closed'
    where listing_id = new.id and status = 'pending';

    update public.proposals
    set status = 'withdrawn'
    where status = 'pending'
      and id in (
        select proposal_id from public.proposal_items
        where listing_id = new.id
      );
  end if;
  return new;
end;
$$;

create trigger listings_archive_proposals_on_close
  after update on public.listings
  for each row execute function public.archive_proposals_on_listing_close();

create or replace function public.decline_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_owner uuid;
begin
  select listing_id into v_listing_id
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  select owner_id into v_owner
  from public.listings
  where id = v_listing_id;

  if v_owner is distinct from (select auth.uid()) then
    raise exception 'Only the listing owner can decline a proposal';
  end if;

  update public.proposals
  set status = 'declined'
  where id = p_proposal_id and status = 'pending';
end;
$$;

-- Each side confirms the physical exchange; both confirmations complete it.
create or replace function public.confirm_trade(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_owner uuid;
  v_uid uuid := (select auth.uid());
begin
  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  if v_proposal.status <> 'accepted' then
    raise exception 'Only accepted trades can be confirmed';
  end if;

  select owner_id into v_owner
  from public.listings
  where id = v_proposal.listing_id;

  if v_uid = v_proposal.proposer_id then
    update public.proposals
    set proposer_confirmed_at = coalesce(proposer_confirmed_at, now())
    where id = p_proposal_id;
  elsif v_uid = v_owner then
    update public.proposals
    set owner_confirmed_at = coalesce(owner_confirmed_at, now())
    where id = p_proposal_id;
  else
    raise exception 'Only trade participants can confirm';
  end if;

  update public.proposals
  set status = 'completed'
  where id = p_proposal_id
    and proposer_confirmed_at is not null
    and owner_confirmed_at is not null;
end;
$$;

-- Public profile stats. SECURITY DEFINER because proposal rows are only
-- visible to their participants, but aggregate counts are public.
create or replace function public.profile_stats(p_user_id uuid)
returns table (completed_trades bigint, active_listings bigint)
language sql
security definer
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.proposals p
      join public.listings l on l.id = p.listing_id
      where p.status = 'completed'
        and (p.proposer_id = p_user_id or l.owner_id = p_user_id)
    ) as completed_trades,
    (
      select count(*)
      from public.listings
      where owner_id = p_user_id and status = 'active'
    ) as active_listings;
$$;

revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;

revoke execute on function public.create_proposal(uuid, text, jsonb) from public, anon;
revoke execute on function public.accept_proposal(uuid) from public, anon;
revoke execute on function public.decline_proposal(uuid) from public, anon;
revoke execute on function public.confirm_trade(uuid) from public, anon;
grant execute on function public.create_proposal(uuid, text, jsonb) to authenticated;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.decline_proposal(uuid) to authenticated;
grant execute on function public.confirm_trade(uuid) to authenticated;
