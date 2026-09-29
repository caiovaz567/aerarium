-- Fase 13.3, the owner's final choice: their month shows only their part.
-- The other person's purchases and the invoices' rest stay out, and what
-- they send back (from_other) only settles their part, not an income.
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
left join (select month_id, user_id, sum(amount) as amount from public.incomes
  where kind <> 'from_other' group by month_id, user_id) i
  on i.month_id = m.id and i.user_id = m.user_id
left join (select month_id, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.bills group by month_id, user_id) b on b.month_id = m.id and b.user_id = m.user_id
left join (select month_id, user_id, sum(mine) as amount, sum(mine) filter (where not paid) as unpaid
  from public.v_invoice_totals group by month_id, user_id) f on f.month_id = m.id and f.user_id = m.user_id
left join (select month, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.v_installment_schedule where card_id is null and not for_other group by month, user_id) p
  on p.month = m.ref and p.user_id = m.user_id;
