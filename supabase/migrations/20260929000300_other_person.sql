-- Fase 13.3: someone else (the owner's father) uses the same cards. What they
-- bought is marked, and with other_person set the undetailed rest of every
-- invoice ("outros") is theirs too. Only the owner's part is their outflow.

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  other_person text check (length(trim(other_person)) between 1 and 30),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy owner_access on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.user_settings from anon, authenticated;
grant select, insert, update, delete on public.user_settings to authenticated, service_role;

alter table public.invoice_expenses add column for_other boolean not null default false;
alter table public.installment_plans add column for_other boolean not null default false;

-- The schedule carries for_other; the totals split the other person's share.
create or replace view public.v_installment_schedule with (security_invoker = true) as
select p.id as plan_id, p.user_id, p.card_id, p.description,
  (p.first_month + make_interval(months => n.number - 1))::date as month,
  n.number, p.total_installments,
  p.installment_amount + case when n.number = p.total_installments then p.final_adjustment else 0 end as amount,
  pay.id is not null as paid, pay.paid_on, pay.source, pay.invoice_id,
  p.for_other
from public.installment_plans p
cross join lateral generate_series(1, p.total_installments) as n(number)
left join public.installment_payments pay on pay.plan_id = p.id and pay.user_id = p.user_id
  and pay.month = (p.first_month + make_interval(months => n.number - 1))::date;

create or replace view public.v_invoice_totals with (security_invoker = true) as
select i.id as invoice_id, i.user_id, i.card_id, i.month_id, m.ref as month,
  coalesce(p.amount, 0) as installments_amount,
  coalesce(s.amount, 0) as subscriptions_amount,
  coalesce(e.amount, 0) as expenses_amount, i.other_amount,
  coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount as calculated_total,
  case when i.paid then i.closed_total
    else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end as total,
  i.paid, i.paid_on, i.estimated, i.closed_total,
  coalesce(p.other, 0) + coalesce(e.other, 0) + case when us.other_person is not null then i.other_amount else 0 end as other_share,
  greatest(0,
    case when i.paid then i.closed_total
      else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
    - (coalesce(p.other, 0) + coalesce(e.other, 0) + case when us.other_person is not null then i.other_amount else 0 end)
  ) as mine
from public.invoices i
join public.months m on m.id = i.month_id and m.user_id = i.user_id
left join public.user_settings us on us.user_id = i.user_id
left join (
  select card_id, user_id, month, sum(amount) as amount,
    sum(amount) filter (where for_other) as other
  from public.v_installment_schedule group by card_id, user_id, month
) p on p.card_id = i.card_id and p.user_id = i.user_id and p.month = m.ref
left join (
  select card_id, user_id, sum(amount) as amount from public.subscriptions
  where active group by card_id, user_id
) s on s.card_id = i.card_id and s.user_id = i.user_id
left join (
  select invoice_id, user_id, sum(amount) as amount,
    sum(amount) filter (where for_other) as other
  from public.invoice_expenses group by invoice_id, user_id
) e on e.invoice_id = i.id and e.user_id = i.user_id;

create or replace view public.v_month_summary with (security_invoker = true) as
select m.id as month_id, m.user_id, m.ref,
  coalesce(i.amount, 0) as incomes,
  coalesce(b.amount, 0) + coalesce(f.amount, 0) + coalesce(p.amount, 0) as outflows,
  coalesce(i.amount, 0) - coalesce(b.amount, 0) - coalesce(f.amount, 0) - coalesce(p.amount, 0) as available,
  coalesce(b.unpaid, 0) + coalesce(f.unpaid, 0) + coalesce(p.unpaid, 0) as unpaid,
  case when coalesce(i.amount, 0) > 0 then
    (coalesce(b.amount, 0) + coalesce(f.amount, 0) + coalesce(p.amount, 0)) / i.amount
    else null end as committed_ratio
from public.months m
left join (select month_id, user_id, sum(amount) as amount from public.incomes group by month_id, user_id) i
  on i.month_id = m.id and i.user_id = m.user_id
left join (select month_id, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.bills group by month_id, user_id) b on b.month_id = m.id and b.user_id = m.user_id
left join (select month_id, user_id, sum(mine) as amount, sum(mine) filter (where not paid) as unpaid
  from public.v_invoice_totals group by month_id, user_id) f on f.month_id = m.id and f.user_id = m.user_id
left join (select month, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.v_installment_schedule where card_id is null and not for_other group by month, user_id) p
  on p.month = m.ref and p.user_id = m.user_id;
