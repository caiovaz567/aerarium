-- 28/10/2026 (the owner's choice): purchases are launched by hand again. From
-- the bank only the total of each closed bill comes in, and the other person's
-- part is that total minus the owner's launches, in every month.

-- Whether bank purchases come into the app (true, as until now) or only the
-- totals of the closed bills (false).
alter table public.user_settings
  add column bank_purchases boolean not null default true;

-- The rule "the other person's part is the bank's total minus the owner's"
-- held only before other_bank_until; with no end it holds in every month.
update public.user_settings
  set other_bank_until = '2100-01-01'
  where other_person is not null;
