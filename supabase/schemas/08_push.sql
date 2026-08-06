-- Push + realtime delivery for the inbox.
--
-- Foreground: an insert into notifications is broadcast on the recipient's
-- private realtime channel (user:{id}:inbox) so open apps refresh instantly.
-- Background: the same insert POSTs (via pg_net) to the send-push edge
-- function, which fans out to the user's Expo push tokens.

create extension if not exists pg_net with schema extensions;

-- One row per signed-in device. A token moves between users when someone
-- signs out and someone else signs in on the same device, hence token as PK.
create table public.push_tokens (
  token text primary key check (char_length(token) <= 400),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_tokens_insert_own" on public.push_tokens
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_tokens_update_own" on public.push_tokens
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sign-out clears the device's token so a logged-out phone gets no pushes.
create policy "push_tokens_delete_own" on public.push_tokens
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Recipients may read broadcasts only on their own inbox topic.
create policy "inbox_topic_read_own" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'user:' || (select auth.uid())::text || ':inbox');

-- Fan a new notification out to realtime (foreground) and the push edge
-- function (background). The anon key below is the public client key; the
-- edge function does its own authorization with the service role key.
create or replace function public.deliver_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'type', new.type),
    'new_notification',
    'user:' || new.user_id::text || ':inbox',
    true
  );

  perform net.http_post(
    url := 'https://lfoalaodlepdjqebvdga.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmb2FsYW9kbGVwZGpxZWJ2ZGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjA1ODYsImV4cCI6MjEwMTQzNjU4Nn0.Zg4Jl1707QgeRLkHtXQONE4SphpkZTi_0AHcqL3bwfo'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$$;

create trigger notifications_deliver
  after insert on public.notifications
  for each row execute function public.deliver_notification();
