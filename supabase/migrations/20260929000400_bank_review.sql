-- Fase 13.3 / 14.1: when the owner checked a purchase or plan that came from
-- the bank (whose it is). Null means it still waits in "Chegou do banco".
alter table public.invoice_expenses add column reviewed_at timestamptz;
alter table public.installment_plans add column reviewed_at timestamptz;
