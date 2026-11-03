-- Someone in the list who accepted sees what was marked theirs, the way the
-- other person ("Pai") already does: a copy in public.shares, one per person.
-- Adds a column and rows for who accepted; nothing is changed or removed, and
-- the row of the other person keeps person_id empty.
alter table public.shares
  add column person_id uuid,
  add constraint shares_person_fkey foreign key (owner_id, person_id)
    references public.people (user_id, id) on delete cascade,
  add constraint shares_one_per_person unique (owner_id, person_id);

-- A person's copy only takes what is marked for them. An app still on an older
-- version writes the other person's copy to every row of the owner: here that
-- write leaves a person's copy as it was, and the other person's row still saves.
create function private.keep_person_copy()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.person_id is not null
    and (new.data ->> 'forPerson') is distinct from new.person_id::text then
    new.data := old.data;
  end if;
  return new;
end $$;
revoke all on function private.keep_person_copy() from public, anon, authenticated;
create trigger shares_keep_person_copy before update of data on public.shares
  for each row execute function private.keep_person_copy();

-- How the owner shows up to those they invited: their username, else their
-- Google name, else a masked e-mail. The full e-mail never goes.
create function private.owner_display(p_owner uuid)
returns text
language sql stable set search_path = '' as $$
  select left(coalesce(
    '@' || (select username from public.usernames where user_id = p_owner),
    nullif(trim(coalesce(
      a.raw_user_meta_data ->> 'full_name',
      a.raw_user_meta_data ->> 'name'
    )), ''),
    left(split_part(a.email, '@', 1), 2) || '***@' || split_part(a.email, '@', 2),
    'Alguém'
  ), 30)
  from auth.users a where a.id = p_owner
$$;

-- Accepting opens the copy; declining or leaving closes it.
create or replace function private.answer_invitation(p_me uuid, p_person uuid, p_accept boolean)
returns void
language plpgsql set search_path = '' as $$
declare
  owner uuid;
begin
  select user_id into owner from public.people
    where id = p_person and linked_user_id = p_me;
  if owner is null then return; end if;
  if p_accept then
    update public.people set accepted = true where id = p_person;
    insert into public.shares (owner_id, viewer_id, viewer_email, owner_name, person_id)
      select owner, p_me, u.email, private.owner_display(owner), p_person
      from auth.users u where u.id = p_me
      on conflict (owner_id, viewer_id) do nothing;
  else
    delete from public.shares where owner_id = owner and viewer_id = p_me and person_id = p_person;
    update public.people set linked_user_id = null, accepted = false where id = p_person;
  end if;
end $$;

-- Someone the owner already shares with as the other person is not added again.
create or replace function private.add_person(p_me uuid, p_username text)
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
  ) or exists (
    select 1 from public.shares where owner_id = p_me and viewer_id = target
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

revoke all on function private.owner_display(uuid) from public, anon, authenticated;
revoke all on function private.answer_invitation(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function private.add_person(uuid, text) from public, anon, authenticated;

-- Who accepted before this: their copy starts now, empty until the owner's app
-- writes it.
insert into public.shares (owner_id, viewer_id, viewer_email, owner_name, person_id)
  select p.user_id, p.linked_user_id, u.email, private.owner_display(p.user_id), p.id
  from public.people p
  join auth.users u on u.id = p.linked_user_id
  where p.accepted and p.linked_user_id is not null
  on conflict (owner_id, viewer_id) do nothing;
