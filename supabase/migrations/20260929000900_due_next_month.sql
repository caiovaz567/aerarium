-- The owner's convention (29/09/2026): an invoice is the month before it is
-- due (the bill due in October is September's). Off for everyone else, so
-- nothing changes for them. The only account with someone else using its
-- cards is the owner's, so it is turned on there.
alter table public.user_settings add column due_next_month boolean not null default false;
update public.user_settings set due_next_month = true where other_person is not null;
