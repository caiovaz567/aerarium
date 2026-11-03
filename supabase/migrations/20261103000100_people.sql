-- Usernames, and the people who use someone's cards. Only adds: no existing
-- table or row changes.
--
-- A person is a name in the owner's list. To see what is theirs in their own
-- account they must be invited by exact @username and accept. Nobody can list
-- usernames, and the invited side never reads the owner's row, only who invited
-- them, through the functions below.

create table public.usernames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.usernames enable row level security;
create policy usernames_own_read on public.usernames for select to authenticated
  using (user_id = (select auth.uid()));
create policy usernames_own_insert on public.usernames for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy usernames_own_update on public.usernames for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.usernames from anon, authenticated;
grant select on public.usernames to authenticated;
grant insert (id, user_id, username), update (user_id, username) on public.usernames to authenticated;
grant select, insert, update, delete on public.usernames to service_role;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 30),
  linked_user_id uuid references auth.users on delete set null,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, linked_user_id),
  check (linked_user_id <> user_id)
);
alter table public.people enable row level security;
create policy people_own_read on public.people for select to authenticated
  using (user_id = (select auth.uid()));
create policy people_own_insert on public.people for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy people_own_delete on public.people for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.people from anon, authenticated;
grant select, delete on public.people to authenticated;
grant insert (id, user_id, name) on public.people to authenticated;
grant select, insert, update, delete on public.people to service_role;

-- The owner's list, with each person's current username.
create function public.my_people()
returns table (id uuid, name text, username text, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, u.username, p.accepted
  from public.people p
  left join public.usernames u on u.user_id = p.linked_user_id
  where p.user_id = auth.uid()
  order by p.created_at, p.id
$$;

-- Answers ok, no-person, no-username (the owner has none), not-found, self or
-- already (another person in the list is that account).
create function public.invite_person(p_person uuid, p_username text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if not exists (select 1 from public.people where id = p_person and user_id = me) then
    return 'no-person';
  end if;
  if not exists (select 1 from public.usernames where user_id = me) then
    return 'no-username';
  end if;
  select user_id into target from public.usernames
    where username = lower(ltrim(trim(p_username), '@'));
  if target is null then return 'not-found'; end if;
  if target = me then return 'self'; end if;
  if exists (
    select 1 from public.people
    where user_id = me and linked_user_id = target and id <> p_person
  ) then
    return 'already';
  end if;
  -- Inviting the same account again keeps what it already answered.
  update public.people set linked_user_id = target, accepted = false
    where id = p_person and user_id = me and linked_user_id is distinct from target;
  return 'ok';
end $$;

-- Back to only a name in the owner's list.
create function public.unlink_person(p_person uuid)
returns void
language sql security definer set search_path = '' as $$
  update public.people set linked_user_id = null, accepted = false
    where id = p_person and user_id = auth.uid()
$$;

-- Who invited this account, and whom it accepted.
create function public.my_invitations()
returns table (person_id uuid, from_username text, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, u.username, p.accepted
  from public.people p
  left join public.usernames u on u.user_id = p.user_id
  where p.linked_user_id = auth.uid()
  order by p.accepted, p.created_at, p.id
$$;

-- Accepts an invitation; false declines it or leaves one already accepted.
create function public.answer_invitation(p_person uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_accept then
    update public.people set accepted = true
      where id = p_person and linked_user_id = auth.uid();
  else
    update public.people set linked_user_id = null, accepted = false
      where id = p_person and linked_user_id = auth.uid();
  end if;
end $$;

revoke all on function public.my_people() from public, anon;
revoke all on function public.invite_person(uuid, text) from public, anon;
revoke all on function public.unlink_person(uuid) from public, anon;
revoke all on function public.my_invitations() from public, anon;
revoke all on function public.answer_invitation(uuid, boolean) from public, anon;
grant execute on function public.my_people() to authenticated;
grant execute on function public.invite_person(uuid, text) to authenticated;
grant execute on function public.unlink_person(uuid) to authenticated;
grant execute on function public.my_invitations() to authenticated;
grant execute on function public.answer_invitation(uuid, boolean) to authenticated;
