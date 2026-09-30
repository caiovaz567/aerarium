-- The owner shares with the other person's own Aerarium account (29/09/2026).
-- That account keeps working for its own things and gets "Cartões do <owner>",
-- read only. It never reads the owner's tables: the owner's app writes a copy
-- of only what was marked for the other person (purchases, installments, bank
-- rests, the cards they are on, what was paid back) into `data`, and keeps it
-- up to date. The other person reads that row and nothing else.
--
-- A share is created by the Edge Function `share` (it finds the account by
-- e-mail with the service role); here the owner can only change the names,
-- the Pix key and `data`, or delete it. The other person can only read it.
create table public.shares (
  owner_id uuid not null references auth.users on delete cascade,
  viewer_id uuid not null references auth.users on delete cascade,
  viewer_email text not null check (length(viewer_email) between 3 and 320),
  owner_name text not null check (length(trim(owner_name)) between 1 and 30),
  pix_key text check (pix_key is null or length(trim(pix_key)) between 1 and 140),
  pix_bank text check (pix_bank is null or pix_bank ~ '^[a-z0-9-]{1,30}$'),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);
alter table public.shares enable row level security;
create policy share_parties_read on public.shares for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));
create policy share_owner_update on public.shares for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy share_owner_delete on public.shares for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.shares from anon, authenticated;
grant select, delete on public.shares to authenticated;
grant update (owner_name, pix_key, pix_bank, data, updated_at) on public.shares to authenticated;
grant select, insert, update, delete on public.shares to service_role;
