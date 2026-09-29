-- Fase 13.2: a bank card's limit as the bank last said it (Open Finance).
alter table public.bank_accounts
  add column credit_limit numeric(12,2) check (credit_limit >= 0),
  add column available_limit numeric(12,2),
  add column limit_at timestamptz;
