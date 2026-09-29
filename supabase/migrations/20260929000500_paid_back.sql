-- Fase 13.3, corrected by the owner: they pay the whole invoice and the
-- other person sends their part back. The month counts the whole invoice
-- again; money sent back is an income of its own kind.
alter table public.incomes drop constraint incomes_kind_check;
alter table public.incomes add constraint incomes_kind_check
  check (kind in ('normal', 'carryover', 'from_other'));

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
left join (select month_id, user_id, sum(total) as amount, sum(total) filter (where not paid) as unpaid
  from public.v_invoice_totals group by month_id, user_id) f on f.month_id = m.id and f.user_id = m.user_id
left join (select month, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.v_installment_schedule where card_id is null group by month, user_id) p
  on p.month = m.ref and p.user_id = m.user_id;
