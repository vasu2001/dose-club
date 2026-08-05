-- Coffee reviews: personal notes users attach to a catalog coffee.
--   'listing'  — the sharer's own note, written when listing a dose
--   'proposal' — the proposer's own note, written when offering a dose
--   'received' — written after a completed trade by the side that received it

create table public.coffee_reviews (
  id uuid primary key default gen_random_uuid(),
  coffee_id uuid not null references public.coffees (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  context text not null check (context in ('listing', 'proposal', 'received')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coffee_reviews_coffee_id_idx on public.coffee_reviews (coffee_id, created_at desc);
create index coffee_reviews_author_id_idx on public.coffee_reviews (author_id);

-- One 'received' review per person per trade.
create unique index coffee_reviews_received_unique_idx
  on public.coffee_reviews (author_id, proposal_id)
  where context = 'received';

alter table public.coffee_reviews enable row level security;

create policy "coffee_reviews_select_authenticated" on public.coffee_reviews
  for select to authenticated
  using (true);

-- Anyone can note their own coffee; 'received' reviews require being a
-- participant of the completed trade that delivered the coffee.
create policy "coffee_reviews_insert_own" on public.coffee_reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      context in ('listing', 'proposal')
      or (
        context = 'received'
        and proposal_id is not null
        and exists (
          select 1
          from public.proposals p
          join public.listings l on l.id = p.listing_id
          where p.id = proposal_id
            and p.status = 'completed'
            and (
              p.proposer_id = (select auth.uid())
              or l.owner_id = (select auth.uid())
            )
        )
      )
    )
  );

create policy "coffee_reviews_update_own" on public.coffee_reviews
  for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "coffee_reviews_delete_own" on public.coffee_reviews
  for delete to authenticated
  using ((select auth.uid()) = author_id);

create trigger coffee_reviews_set_updated_at
  before update on public.coffee_reviews
  for each row execute function public.set_updated_at();
