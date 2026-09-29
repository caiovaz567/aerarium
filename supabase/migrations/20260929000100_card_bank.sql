-- Fase 13.1: the bank of a card (for its logo; null = guessed from the name,
-- 'none' = no logo) and the day its invoice is due.
alter table public.cards
  add column bank text check (bank ~ '^[a-z0-9]{1,24}$'),
  add column due_day smallint check (due_day between 1 and 31);
