-- Fase 13.3, with the owner's exact rule: the other person uses only some
-- cards. On those, their part of an invoice is the whole invoice at the bank
-- (bank_total, from Open Finance or typed) minus the owner's part. On the
-- others, only what was marked theirs.
alter table public.cards add column shared boolean not null default false;
alter table public.invoices add column bank_total numeric(12,2) check (bank_total >= 0);

create or replace view public.v_invoice_totals with (security_invoker = true) as
select i.id as invoice_id, i.user_id, i.card_id, i.month_id, m.ref as month,
  coalesce(p.amount, 0) as installments_amount,
  coalesce(s.amount, 0) as subscriptions_amount,
  coalesce(e.amount, 0) as expenses_amount, i.other_amount,
  coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount as calculated_total,
  case when i.paid then i.closed_total
    else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end as total,
  i.paid, i.paid_on, i.estimated, i.closed_total,
  case when c.shared and i.bank_total is not null
    then greatest(coalesce(p.other, 0) + coalesce(e.other, 0),
      i.bank_total - greatest(0,
        case when i.paid then i.closed_total
          else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
        - coalesce(p.other, 0) - coalesce(e.other, 0)))
    else coalesce(p.other, 0) + coalesce(e.other, 0)
  end as other_share,
  greatest(0,
    case when i.paid then i.closed_total
      else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
    - coalesce(p.other, 0) - coalesce(e.other, 0)
  ) as mine
from public.invoices i
join public.months m on m.id = i.month_id and m.user_id = i.user_id
join public.cards c on c.id = i.card_id and c.user_id = i.user_id
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
