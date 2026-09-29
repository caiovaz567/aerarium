-- A subscription can have the day it started (29/09/2026). first_month is the
-- first invoice month it is charged in: the app works it out from started_on
-- and the card's closing day (a start after closing goes to the next invoice)
-- and keeps it up to date when the card's days change. Without them, it counts
-- in every month, as before.
alter table public.subscriptions
  add column started_on date,
  add column first_month date
    check (first_month is null or extract(day from first_month) = 1),
  add constraint subscriptions_first_month_with_start
    check (first_month is null or started_on is not null);

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
left join public.user_settings us on us.user_id = i.user_id
left join (
  select card_id, user_id, month, sum(amount) as amount,
    sum(amount) filter (where for_other) as other
  from public.v_installment_schedule group by card_id, user_id, month
) p on p.card_id = i.card_id and p.user_id = i.user_id and p.month = m.ref
left join lateral (
  select sum(sub.amount) as amount from public.subscriptions sub
  where sub.card_id = i.card_id and sub.user_id = i.user_id and sub.active
    and (sub.first_month is null or sub.first_month <= m.ref)
) s on true
left join (
  select invoice_id, user_id, sum(amount) as amount,
    sum(amount) filter (where for_other) as other
  from public.invoice_expenses group by invoice_id, user_id
) e on e.invoice_id = i.id and e.user_id = i.user_id;

-- The frozen total of a paid invoice counts only the subscriptions already started.
create or replace function private.invoice_payment() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ref_month date; fixed numeric;
begin
  if tg_op = 'UPDATE' then
    if new.card_id is distinct from old.card_id or new.month_id is distinct from old.month_id then
      raise exception 'Cartao e mes de uma fatura nao podem mudar.' using errcode = '23514';
    end if;
    if new.other_amount is distinct from old.other_amount then new.estimated := false; end if;
    if old.paid and new.paid then
      new.closed_total := old.closed_total;
      new.paid_on := old.paid_on;
      return new;
    end if;
  end if;
  if not new.paid then
    new.closed_total := null;
    new.paid_on := null;
    return new;
  end if;
  select ref into ref_month from public.months where id = new.month_id and user_id = new.user_id;
  select coalesce(sum(amount), 0) into fixed from public.v_installment_schedule
    where card_id = new.card_id and user_id = new.user_id and month = ref_month;
  new.closed_total := fixed + new.other_amount
    + (select coalesce(sum(amount), 0) from public.subscriptions
       where card_id = new.card_id and user_id = new.user_id and active
         and (first_month is null or first_month <= ref_month))
    + (select coalesce(sum(amount), 0) from public.invoice_expenses where invoice_id = new.id and user_id = new.user_id);
  new.paid_on := coalesce(new.paid_on, (now() at time zone 'America/Sao_Paulo')::date);
  return new;
end;
$$;
