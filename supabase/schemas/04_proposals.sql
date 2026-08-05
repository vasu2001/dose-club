-- Proposals: offer a coffee + dose from your library in exchange for a dose
-- of someone else's listing. Lifecycle:
--   pending -> accepted -> completed (both sides confirm the exchange)
--   pending -> declined (owner) | withdrawn (proposer)

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  offered_coffee_id uuid not null references public.coffees (id) on delete cascade,
  offered_dose_grams integer not null check (offered_dose_grams between 5 and 100),
  message text check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'completed')),
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
create index proposals_offered_coffee_id_idx on public.proposals (offered_coffee_id);

alter table public.proposals enable row level security;

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

-- Offer must be a coffee you own, on someone else's active listing.
create policy "proposals_insert_own_offer" on public.proposals
  for insert to authenticated
  with check (
    (select auth.uid()) = proposer_id
    and exists (
      select 1 from public.coffees c
      where c.id = offered_coffee_id
        and c.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.owner_id <> (select auth.uid())
        and l.status = 'active'
    )
  );

-- Proposers may withdraw their own pending proposals. Owner decisions and
-- confirmations go through the functions below.
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
    elsif new.status = 'declined' then
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

-- Owner accepts a pending proposal. The listing stays active — a bag can
-- serve several trades.
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

revoke execute on function public.accept_proposal(uuid) from public, anon;
revoke execute on function public.decline_proposal(uuid) from public, anon;
revoke execute on function public.confirm_trade(uuid) from public, anon;
grant execute on function public.accept_proposal(uuid) to authenticated;
grant execute on function public.decline_proposal(uuid) to authenticated;
grant execute on function public.confirm_trade(uuid) to authenticated;
