-- Roasters: shared catalog of coffee roasters. Any authenticated user can add
-- one; names are unique case-insensitively so the catalog stays consistent.

create table public.roasters (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index roasters_name_lower_idx on public.roasters (lower(name));

alter table public.roasters enable row level security;

create policy "roasters_select_authenticated" on public.roasters
  for select to authenticated
  using (true);

create policy "roasters_insert_authenticated" on public.roasters
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

-- Case-insensitive get-or-create, so concurrent clients converge on one row.
create or replace function public.get_or_create_roaster(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(p_name);
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'Roaster name must be between 1 and 80 characters';
  end if;

  select id into v_id from public.roasters where lower(name) = lower(v_name);
  if v_id is null then
    insert into public.roasters (name, created_by)
    values (v_name, (select auth.uid()))
    on conflict (lower(name)) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.roasters where lower(name) = lower(v_name);
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.get_or_create_roaster(text) from public, anon;
grant execute on function public.get_or_create_roaster(text) to authenticated;
