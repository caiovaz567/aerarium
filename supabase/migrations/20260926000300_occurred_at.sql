-- Fase 12 (pedido do usuário): data e hora exatas de cada gasto lançado e de
-- cada conta, para a visão "Por data" em Meses. Opcional: o que já existia
-- (import da v1) não tem hora e continua sem.

alter table public.invoice_expenses add column occurred_at timestamptz;
alter table public.bills add column occurred_at timestamptz;

-- A card expense's date follows its time (São Paulo), so the two never disagree.
create function private.expense_date_from_time() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.occurred_at is not null then
    new.spent_on := (new.occurred_at at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end;
$$;
revoke all on function private.expense_date_from_time() from public, anon, authenticated;

create trigger expense_date_from_time before insert or update of occurred_at, spent_on
  on public.invoice_expenses for each row execute function private.expense_date_from_time();
