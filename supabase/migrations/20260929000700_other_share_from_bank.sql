-- Fase 13.3, corrected with the owner: the invoice's "outros" is the owner's
-- (they launch only their own use). The other person's part is what was
-- marked theirs, or, once the bank closed the bill, the bill minus the
-- owner's part.
create or replace view public.v_invoice_totals with (security_invoker = true) as
select i.id as invoice_id, i.user_id, i.card_id, i.month_id, m.ref as month,
  coalesce(p.amount, 0) as installments_amount,
  coalesce(s.amount, 0) as subscriptions_amount,
  coalesce(e.amount, 0) as expenses_amount, i.other_amount,
  coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount as calculated_total,
  case when i.paid then i.closed_total
    else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end as total,
  i.paid, i.paid_on, i.estimated, i.closed_total,
  case when bt.amount is null then coalesce(p.other, 0) + coalesce(e.other, 0)
    else greatest(coalesce(p.other, 0) + coalesce(e.other, 0),
      bt.amount - greatest(0,
        case when i.paid then i.closed_total
          else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
        - coalesce(p.other, 0) - coalesce(e.other, 0)))
  end as other_share,
  greatest(0,
    case when i.paid then i.closed_total
      else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end
    - coalesce(p.other, 0) - coalesce(e.other, 0)
  ) as mine
from public.invoices i
join public.months m on m.id = i.month_id and m.user_id = i.user_id
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
) e on e.invoice_id = i.id and e.user_id = i.user_id
left join (
  select ref_id, user_id, max(amount) as amount from public.bank_records
  where external_id like 'bill:%' group by ref_id, user_id
) bt on bt.ref_id = i.id and bt.user_id = i.user_id;
