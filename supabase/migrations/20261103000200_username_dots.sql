-- Usernames can have a dot between words (caio.vaz). Only allows more: every
-- username already saved stays valid.
alter table public.usernames drop constraint usernames_username_check;
alter table public.usernames add constraint usernames_username_check check (
  length(username) between 3 and 20
  and username ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'
);
