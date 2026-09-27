-- Open Finance import (Meu Pluggy). The app decides what each bank
-- transaction becomes and writes through RLS, like any other change.

-- A credit card account at the bank, and the card it feeds in the app.
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pluggy_account_id text not null check (length(pluggy_account_id) between 1 and 80),
  item_id text not null check (length(item_id) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 120),
  number text check (length(number) <= 20),
  card_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, pluggy_account_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id)
);

-- Every bank transaction or bill already handled, and what it became, so a
-- sync never handles it twice.
create table public.bank_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  external_id text not null check (length(external_id) between 1 and 120),
  kind text not null check (kind in ('expense', 'matched', 'installment', 'subscription', 'ignored', 'closed', 'bill')),
  ref_id uuid,
  amount numeric(12,2),
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

-- Imported expenses keep the bank id; plans created or linked from the bank
-- keep the key that recognizes their next installments.
alter table public.invoice_expenses add column external_id text check (length(external_id) <= 120);
alter table public.installment_plans add column external_key text check (length(external_key) <= 200);
create unique index invoice_expenses_external on public.invoice_expenses (user_id, external_id) where external_id is not null;
create unique index installment_plans_external on public.installment_plans (user_id, external_key) where external_key is not null;

do $$
declare t text;
begin
  foreach t in array array['bank_accounts', 'bank_records'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_access on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
    execute format('create trigger guard_identity before update on public.%I for each row execute function private.guard_identity()', t);
  end loop;
end;
$$;
create index bank_accounts_card_owner on public.bank_accounts (card_id, user_id);
