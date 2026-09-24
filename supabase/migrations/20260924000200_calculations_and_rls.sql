-- All aggregates are independently grouped to avoid join multiplication.
create view public.v_installment_schedule with (security_invoker = true) as
select p.id as plan_id, p.user_id, p.card_id, p.description,
  (p.first_month + make_interval(months => n.number - 1))::date as month,
  n.number, p.total_installments,
  p.installment_amount + case when n.number = p.total_installments then p.final_adjustment else 0 end as amount,
  pay.id is not null as paid, pay.paid_on, pay.source, pay.invoice_id
from public.installment_plans p
cross join lateral generate_series(1, p.total_installments) as n(number)
left join public.installment_payments pay on pay.plan_id = p.id and pay.user_id = p.user_id
  and pay.month = (p.first_month + make_interval(months => n.number - 1))::date;

create view public.v_invoice_totals with (security_invoker = true) as
select i.id as invoice_id, i.user_id, i.card_id, i.month_id, m.ref as month,
  coalesce(p.amount, 0) as installments_amount,
  coalesce(s.amount, 0) as subscriptions_amount,
  coalesce(e.amount, 0) as expenses_amount, i.other_amount,
  coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount as calculated_total,
  case when i.paid then i.closed_total
    else coalesce(p.amount, 0) + coalesce(s.amount, 0) + coalesce(e.amount, 0) + i.other_amount end as total,
  i.paid, i.paid_on, i.estimated, i.closed_total
from public.invoices i
join public.months m on m.id = i.month_id and m.user_id = i.user_id
left join (
  select card_id, user_id, month, sum(amount) as amount
  from public.v_installment_schedule group by card_id, user_id, month
) p on p.card_id = i.card_id and p.user_id = i.user_id and p.month = m.ref
left join (
  select card_id, user_id, sum(amount) as amount from public.subscriptions
  where active group by card_id, user_id
) s on s.card_id = i.card_id and s.user_id = i.user_id
left join (
  select invoice_id, user_id, sum(amount) as amount from public.invoice_expenses group by invoice_id, user_id
) e on e.invoice_id = i.id and e.user_id = i.user_id;

create view public.v_month_summary with (security_invoker = true) as
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

-- Trigger functions are not exposed as RPCs. They run with caller privileges/RLS.
create schema if not exists private;
revoke all on schema private from public;

create function private.guard_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
    raise exception 'Identidade e dono do registro nao podem mudar.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.bill_payment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.paid_on := case when new.paid then coalesce(new.paid_on, (now() at time zone 'America/Sao_Paulo')::date) else null end;
  return new;
end;
$$;
create trigger bill_payment before insert or update on public.bills
for each row execute function private.bill_payment();

create function private.invoice_payment() returns trigger
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
    + (select coalesce(sum(amount), 0) from public.subscriptions where card_id = new.card_id and user_id = new.user_id and active)
    + (select coalesce(sum(amount), 0) from public.invoice_expenses where invoice_id = new.id and user_id = new.user_id);
  new.paid_on := coalesce(new.paid_on, (now() at time zone 'America/Sao_Paulo')::date);
  return new;
end;
$$;
create trigger invoice_payment before insert or update on public.invoices
for each row execute function private.invoice_payment();

create function private.sync_invoice_installments() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.paid then
    insert into public.installment_payments (user_id, plan_id, month, paid_on, source, invoice_id)
      select new.user_id, s.plan_id, s.month, new.paid_on, 'invoice', new.id
      from public.v_installment_schedule s join public.months m on m.ref = s.month and m.user_id = s.user_id
      where s.card_id = new.card_id and s.user_id = new.user_id and m.id = new.month_id
      on conflict (plan_id, month) do nothing;
  else
    delete from public.installment_payments where invoice_id = new.id and user_id = new.user_id and source = 'invoice';
  end if;
  return new;
end;
$$;
create trigger sync_invoice_installments after insert or update of paid on public.invoices
for each row execute function private.sync_invoice_installments();

create function private.guard_installment_payment() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare plan public.installment_plans;
begin
  select * into plan from public.installment_plans where id = new.plan_id and user_id = new.user_id for share;
  if not found then raise exception 'Parcelamento nao encontrado.' using errcode = '23503'; end if;
  if new.month < plan.first_month or new.month >= (plan.first_month + make_interval(months => plan.total_installments))::date then
    raise exception 'Pagamento fora do cronograma.' using errcode = '23514';
  end if;
  if new.source = 'invoice' and not exists (
    select 1 from public.invoices i join public.months m on m.id = i.month_id and m.user_id = i.user_id
    where i.id = new.invoice_id and i.user_id = new.user_id and i.card_id = plan.card_id and m.ref = new.month and i.paid
  ) then raise exception 'Pagamento deve corresponder a uma fatura paga.' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger guard_installment_payment before insert or update on public.installment_payments
for each row execute function private.guard_installment_payment();

create function private.guard_plan_schedule() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.installment_payments where plan_id = old.id and user_id = old.user_id
      and (month < new.first_month or month >= (new.first_month + make_interval(months => new.total_installments))::date)) then
    raise exception 'O cronograma deve incluir todos os pagamentos registrados.' using errcode = '23514';
  end if;
  if new.card_id is distinct from old.card_id and exists (select 1 from public.installment_payments
    where plan_id = old.id and user_id = old.user_id and source = 'invoice')
    and exists (select 1 from public.cards where id = old.card_id and user_id = old.user_id) then
    raise exception 'Reabra as faturas antes de mover o parcelamento.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_plan_schedule before update on public.installment_plans
for each row execute function private.guard_plan_schedule();

create function private.guard_payment_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.plan_id is distinct from old.plan_id or new.month is distinct from old.month
      or new.source is distinct from old.source or new.invoice_id is distinct from old.invoice_id then
      raise exception 'Remova e registre novamente o pagamento para mudar sua origem ou parcela.' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.source = 'invoice'
    and exists (select 1 from public.invoices where id = old.invoice_id and user_id = old.user_id and paid)
    and exists (select 1 from public.installment_plans where id = old.plan_id and user_id = old.user_id) then
    raise exception 'Reabra a fatura para desfazer o pagamento automatico.' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger guard_payment_history before update or delete on public.installment_payments
for each row execute function private.guard_payment_history();

create function private.guard_month_ref() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.ref is distinct from old.ref then
    raise exception 'A referencia de um mes criado nao pode mudar.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_month_ref before update on public.months
for each row execute function private.guard_month_ref();

-- Unique carryover and indexes for RLS, joins and FK actions.
create unique index one_carryover_per_month on public.incomes (user_id, month_id) where kind = 'carryover';
create index incomes_month_owner on public.incomes (month_id, user_id);
create index bills_month_owner on public.bills (month_id, user_id);
create index invoices_month_owner on public.invoices (month_id, user_id);
create index invoice_expenses_invoice_owner on public.invoice_expenses (invoice_id, user_id);
create index plans_card_owner on public.installment_plans (card_id, user_id);
create index payments_plan_owner on public.installment_payments (plan_id, user_id);
create index payments_invoice_owner on public.installment_payments (invoice_id, user_id);
create index subscriptions_card_owner on public.subscriptions (card_id, user_id);

do $$
declare t text;
begin
  foreach t in array array['cards','months','incomes','bills','invoices','invoice_expenses','installment_plans','installment_payments','subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_access on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
    execute format('create index %I on public.%I (user_id)', t || '_user_id', t);
    execute format('create trigger guard_identity before update on public.%I for each row execute function private.guard_identity()', t);
  end loop;
end;
$$;
revoke all on public.v_installment_schedule, public.v_invoice_totals, public.v_month_summary from anon, authenticated;
grant select on public.v_installment_schedule, public.v_invoice_totals, public.v_month_summary to authenticated, service_role;
revoke all on all functions in schema private from public, anon, authenticated;
