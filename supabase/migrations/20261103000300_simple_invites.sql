-- A simpler way to add people: one call adds by @username, and the one who
-- invites does not need a username. Changes functions only, no row or table.

drop function public.invite_person(uuid, text);
drop function public.unlink_person(uuid);
drop function public.my_invitations();

-- Answers ok, not-found, self or already. Someone who declined stays in the
-- list as a name; adding them again reuses that row.
create function public.add_person(p_username text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := lower(ltrim(trim(p_username), '@'));
  target uuid;
begin
  select user_id into target from public.usernames where username = clean;
  if target is null then return 'not-found'; end if;
  if target = me then return 'self'; end if;
  if exists (
    select 1 from public.people where user_id = me and linked_user_id = target
  ) then
    return 'already';
  end if;
  update public.people set linked_user_id = target, accepted = false
    where user_id = me and linked_user_id is null and name = clean;
  if not found then
    insert into public.people (user_id, name, linked_user_id)
      values (me, clean, target);
  end if;
  return 'ok';
end $$;

-- Who invited this account: their username, else their Google name, else a
-- masked e-mail. The invited side never sees the full e-mail.
create function public.my_invitations()
returns table (person_id uuid, from_name text, accepted boolean)
language sql stable security definer set search_path = '' as $$
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
  where p.linked_user_id = auth.uid()
  order by p.accepted, p.created_at, p.id
$$;

revoke all on function public.add_person(text) from public, anon;
revoke all on function public.my_invitations() from public, anon;
grant execute on function public.add_person(text) to authenticated;
grant execute on function public.my_invitations() to authenticated;
