-- A purchase or a plan can be of someone in the owner's list. It is not the
-- owner's outflow, and the other person ("Pai") keeps only the rest of the
-- bank's total after it. Only adds columns, empty in every row, so nothing
-- changes until someone marks a purchase.
-- The keys are checked at the end, so deleting an account (which removes its
-- people and its purchases in any order) still works; removing only a person
-- with purchases is still refused.
alter table public.invoice_expenses
  add column person_id uuid,
  add constraint invoice_expenses_person_fkey foreign key (user_id, person_id)
    references public.people (user_id, id) deferrable initially deferred,
  add constraint invoice_expenses_one_owner check (not (for_other and person_id is not null));
alter table public.installment_plans
  add column person_id uuid,
  add constraint installment_plans_person_fkey foreign key (user_id, person_id)
    references public.people (user_id, id) deferrable initially deferred,
  add constraint installment_plans_one_owner check (not (for_other and person_id is not null));
create index invoice_expenses_person_idx on public.invoice_expenses (user_id, person_id)
  where person_id is not null;
create index installment_plans_person_idx on public.installment_plans (user_id, person_id)
  where person_id is not null;

create or replace view public.v_installment_schedule with (security_invoker = true) as
select p.id as plan_id, p.user_id, p.card_id, p.description,
  (p.first_month + make_interval(months => n.number - 1))::date as month,
  n.number, p.total_installments,
  p.installment_amount + case when n.number = p.total_installments then p.final_adjustment else 0 end as amount,
  pay.id is not null as paid, pay.paid_on, pay.source, pay.invoice_id,
  p.for_other, p.person_id
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
  case when us.other_person is not null and m.ref < us.other_bank_until
      and i.bank_total is not null
    then greatest(coalesce(p.other, 0) + coalesce(e.other, 0),
      i.bank_total - coalesce(p.people, 0) - coalesce(e.people, 0) - greatest(0,
        case when i.paid then i.closed_total
          else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
        - coalesce(p.other, 0) - coalesce(e.other, 0)
        - coalesce(p.people, 0) - coalesce(e.people, 0)))
    else coalesce(p.other, 0) + coalesce(e.other, 0)
  end as other_share,
  greatest(0,
    case when i.paid then i.closed_total
      else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
    - coalesce(p.other, 0) - coalesce(e.other, 0)
    - coalesce(p.people, 0) - coalesce(e.people, 0)
  ) as mine,
  coalesce(p.people, 0) + coalesce(e.people, 0) as people_share
from public.invoices i
join public.months m on m.id = i.month_id and m.user_id = i.user_id
left join public.user_settings us on us.user_id = i.user_id
left join (
  select card_id, user_id, month, sum(amount) as amount,
    sum(amount) filter (where for_other) as other,
    sum(amount) filter (where person_id is not null) as people
  from public.v_installment_schedule group by card_id, user_id, month
) p on p.card_id = i.card_id and p.user_id = i.user_id and p.month = m.ref
left join lateral (
  select sum(sub.amount) as amount from public.subscriptions sub
  where sub.card_id = i.card_id and sub.user_id = i.user_id and sub.active
    and (sub.first_month is null or sub.first_month <= m.ref)
) s on true
left join (
  select invoice_id, user_id, sum(amount) as amount,
    sum(amount) filter (where for_other) as other,
    sum(amount) filter (where person_id is not null) as people
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
left join (select month_id, user_id, sum(amount) as amount from public.incomes
  where kind <> 'from_other' group by month_id, user_id) i
  on i.month_id = m.id and i.user_id = m.user_id
left join (select month_id, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.bills group by month_id, user_id) b on b.month_id = m.id and b.user_id = m.user_id
left join (select month_id, user_id, sum(mine) as amount, sum(mine) filter (where not paid) as unpaid
  from public.v_invoice_totals group by month_id, user_id) f on f.month_id = m.id and f.user_id = m.user_id
left join (select month, user_id, sum(amount) as amount, sum(amount) filter (where not paid) as unpaid
  from public.v_installment_schedule where card_id is null and not for_other and person_id is null group by month, user_id) p
  on p.month = m.ref and p.user_id = m.user_id;
