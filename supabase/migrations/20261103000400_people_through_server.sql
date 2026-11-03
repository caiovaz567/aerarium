-- Clients do not run functions that skip RLS. Finding another account and
-- answering an invitation go through the Edge Function `people`, which checks
-- the session and calls these. Changes functions only, no row or table.

drop function public.add_person(text);
drop function public.my_people();
drop function public.my_invitations();
drop function public.answer_invitation(uuid, boolean);

-- The owner's list, with each person's current username.
create function private.my_people(p_me uuid)
returns table (id uuid, name text, username text, accepted boolean)
language sql stable set search_path = '' as $$
  select p.id, p.name, u.username, p.accepted
  from public.people p
  left join public.usernames u on u.user_id = p.linked_user_id
  where p.user_id = p_me
  order by p.created_at, p.id
$$;

-- Answers ok, not-found, self or already. Someone who declined stays in the
-- list as a name; adding them again reuses that row.
create function private.add_person(p_me uuid, p_username text)
returns text
language plpgsql set search_path = '' as $$
declare
  clean text := lower(ltrim(trim(p_username), '@'));
  target uuid;
begin
  select user_id into target from public.usernames where username = clean;
  if target is null then return 'not-found'; end if;
  if target = p_me then return 'self'; end if;
  if exists (
    select 1 from public.people where user_id = p_me and linked_user_id = target
  ) then
    return 'already';
  end if;
  update public.people set linked_user_id = target, accepted = false
    where user_id = p_me and linked_user_id is null and name = clean;
  if not found then
    insert into public.people (user_id, name, linked_user_id)
      values (p_me, clean, target);
  end if;
  return 'ok';
end $$;

-- Who invited this account: their username, else their Google name, else a
-- masked e-mail. The invited side never sees the full e-mail.
create function private.my_invitations(p_me uuid)
returns table (person_id uuid, from_name text, accepted boolean)
language sql stable set search_path = '' as $$
  select p.id,
    coalesce(
      '@' || u.username,
      nullif(trim(coalesce(
        a.raw_user_meta_data ->> 'full_name',
        a.raw_user_meta_data ->> 'name'
      )), ''),
      left(split_part(a.email, '@', 1), 2) || '***@' || split_part(a.email, '@', 2)
    ),
    p.accepted
  from public.people p
  left join public.usernames u on u.user_id = p.user_id
  left join auth.users a on a.id = p.user_id
  where p.linked_user_id = p_me
  order by p.accepted, p.created_at, p.id
$$;

-- Accepts an invitation; false declines it or leaves one already accepted.
create function private.answer_invitation(p_me uuid, p_person uuid, p_accept boolean)
returns void
language plpgsql set search_path = '' as $$
begin
  if p_accept then
    update public.people set accepted = true
      where id = p_person and linked_user_id = p_me;
  else
    update public.people set linked_user_id = null, accepted = false
      where id = p_person and linked_user_id = p_me;
  end if;
end $$;

revoke all on function private.my_people(uuid) from public, anon, authenticated;
revoke all on function private.add_person(uuid, text) from public, anon, authenticated;
revoke all on function private.my_invitations(uuid) from public, anon, authenticated;
revoke all on function private.answer_invitation(uuid, uuid, boolean) from public, anon, authenticated;
