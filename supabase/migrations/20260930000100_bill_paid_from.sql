-- Where a bill paid by Pix, boleto or cash came from: a bank key (the same
-- keys as cards.bank, for its logo) or 'cash'. Optional; null = not said.
alter table public.bills
  add column paid_from text check (paid_from ~ '^[a-z0-9]{1,24}$');
