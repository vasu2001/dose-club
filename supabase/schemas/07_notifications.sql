-- Inbox: one row per thing a user should pay attention to. Rows are written
-- by triggers on proposals (and the listing-close cascade), never by clients;
-- clients only read them and stamp read_at.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in (
    'proposal_received',
    'proposal_accepted',
    'proposal_declined',
    'proposal_withdrawn',
    'listing_closed',
    'trade_confirmed',
    'trade_completed'
  )),
  title text not null check (char_length(title) <= 300),
  proposal_id uuid references public.proposals (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Marking read is the only client-side write.
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Short human label for a listing, used in notification titles.
create or replace function public.listing_coffee_name(p_listing_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select c.name
  from public.listings l
  join public.coffees c on c.id = l.coffee_id
  where l.id = p_listing_id;
$$;

create or replace function public.username_of(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce('@' || username, 'Someone')
  from public.profiles
  where id = p_user_id;
$$;

-- New proposal -> tell the listing owner.
create or replace function public.notify_proposal_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_coffee text := public.listing_coffee_name(new.listing_id);
begin
  select owner_id into v_owner from public.listings where id = new.listing_id;

  insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
  values (
    v_owner,
    new.proposer_id,
    'proposal_received',
    public.username_of(new.proposer_id) || ' sent you a trade offer on your ' || v_coffee,
    new.id,
    new.listing_id
  );
  return new;
end;
$$;

create trigger proposals_notify_created
  after insert on public.proposals
  for each row execute function public.notify_proposal_created();

-- Status changes and exchange confirmations -> tell the other side.
create or replace function public.notify_proposal_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_coffee text := public.listing_coffee_name(new.listing_id);
begin
  select owner_id into v_owner from public.listings where id = new.listing_id;

  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
      values (new.proposer_id, v_owner, 'proposal_accepted',
        public.username_of(v_owner) || ' accepted your offer on ' || v_coffee || ' — arrange the exchange!',
        new.id, new.listing_id);
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
      values (new.proposer_id, v_owner, 'proposal_declined',
        public.username_of(v_owner) || ' declined your offer on ' || v_coffee,
        new.id, new.listing_id);
    elsif new.status = 'withdrawn' then
      insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
      values (v_owner, new.proposer_id, 'proposal_withdrawn',
        public.username_of(new.proposer_id) || ' withdrew their offer on your ' || v_coffee,
        new.id, new.listing_id);
    elsif new.status = 'listing_closed' then
      insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
      values (new.proposer_id, v_owner, 'listing_closed',
        public.username_of(v_owner) || ' closed the listing ' || v_coffee || ' — your offer was archived',
        new.id, new.listing_id);
    elsif new.status = 'completed' then
      -- Tell the side that did NOT just confirm; the final confirmer watched
      -- it happen. Fall back to both if we can't tell who acted.
      if (select auth.uid()) = new.proposer_id then
        insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
        values (v_owner, new.proposer_id, 'trade_completed',
          'Trade complete: your ' || v_coffee || ' exchange with ' || public.username_of(new.proposer_id),
          new.id, new.listing_id);
      else
        insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
        values (new.proposer_id, v_owner, 'trade_completed',
          'Trade complete: your exchange for ' || v_coffee || ' with ' || public.username_of(v_owner),
          new.id, new.listing_id);
      end if;
    end if;
    return new;
  end if;

  -- One side confirmed but the trade is not complete yet -> nudge the other.
  if new.proposer_confirmed_at is not null and old.proposer_confirmed_at is null
     and new.owner_confirmed_at is null then
    insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
    values (v_owner, new.proposer_id, 'trade_confirmed',
      public.username_of(new.proposer_id) || ' confirmed the exchange for ' || v_coffee || ' — your turn to confirm',
      new.id, new.listing_id);
  elsif new.owner_confirmed_at is not null and old.owner_confirmed_at is null
     and new.proposer_confirmed_at is null then
    insert into public.notifications (user_id, actor_id, type, title, proposal_id, listing_id)
    values (new.proposer_id, v_owner, 'trade_confirmed',
      public.username_of(v_owner) || ' confirmed the exchange for ' || v_coffee || ' — your turn to confirm',
      new.id, new.listing_id);
  end if;

  return new;
end;
$$;

create trigger proposals_notify_updated
  after update on public.proposals
  for each row execute function public.notify_proposal_updated();
