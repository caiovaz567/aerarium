-- Modelo inicial: todas as entidades pertencem a um usuario.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  photo_path text check (photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg'),
  closing_day smallint check (closing_day between 1 and 31),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ref date not null check (extract(day from ref) = 1),
  created_at timestamptz not null default now(),
  unique (user_id, ref),
  unique (id, user_id)
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 200),
  amount numeric(12,2) not null,
  kind text not null default 'normal' check (kind in ('normal','carryover')),
  check (amount <> 'NaN'::numeric and (amount >= 0 or kind = 'carryover')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (month_id, user_id) references public.months (id, user_id) on delete cascade
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  month_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 200),
  amount numeric(12,2) not null check (amount >= 0 and amount <> 'NaN'::numeric),
  paid boolean not null default false,
  paid_on date,
  check (paid = (paid_on is not null)),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (month_id, user_id) references public.months (id, user_id) on delete cascade
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  card_id uuid not null,
  month_id uuid not null,
  other_amount numeric(12,2) not null default 0 check (other_amount >= 0 and other_amount <> 'NaN'::numeric),
  estimated boolean not null default true,
  note text,
  paid boolean not null default false,
  paid_on date,
  closed_total numeric(12,2) check (closed_total >= 0 and closed_total <> 'NaN'::numeric),
  check (paid = (paid_on is not null)),
  check (paid = (closed_total is not null)),
  unique (card_id, month_id),
  unique (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete cascade,
  foreign key (month_id, user_id) references public.months (id, user_id) on delete cascade
);

create table public.invoice_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  invoice_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 200),
  amount numeric(12,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  spent_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete cascade
);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid,
  description text not null check (length(trim(description)) between 1 and 200),
  installment_amount numeric(12,2) not null check (installment_amount > 0 and installment_amount <> 'NaN'::numeric),
  final_adjustment numeric(12,2) not null default 0,
  check (final_adjustment <> 'NaN'::numeric and installment_amount + final_adjustment > 0
    and abs(final_adjustment) < total_installments * 0.01),
  total_installments smallint not null check (total_installments between 1 and 120),
  first_month date not null check (extract(day from first_month) = 1),
  note text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id)
);

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  plan_id uuid not null,
  month date not null check (extract(day from month) = 1),
  paid_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  source text not null default 'manual' check (source in ('manual','invoice')),
  invoice_id uuid,
  check ((source = 'invoice' and invoice_id is not null) or (source = 'manual' and invoice_id is null)),
  foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete cascade,
  unique (plan_id, month),
  foreign key (plan_id, user_id) references public.installment_plans (id, user_id) on delete cascade
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid,
  name text not null check (length(trim(name)) between 1 and 120),
  amount numeric(12,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  charge_day smallint not null check (charge_day between 1 and 31),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (card_id, user_id) references public.cards (id, user_id) on delete set null (card_id)
);
