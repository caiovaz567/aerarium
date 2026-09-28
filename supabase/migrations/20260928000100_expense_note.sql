-- Open Finance: a purchase from the bank keeps the bank's own name; what the
-- person wants to remember about it goes in a note, like plans and
-- subscriptions already have.
alter table public.invoice_expenses add column note text check (length(note) <= 200);
