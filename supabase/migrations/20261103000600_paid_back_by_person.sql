-- "Vini pagou": money sent back says who sent it. Only adds a column, empty in
-- every row, so what the other person ("Pai") sent back stays theirs.
alter table public.incomes
  add column person_id uuid,
  add constraint incomes_person_fkey foreign key (user_id, person_id)
    references public.people (user_id, id) deferrable initially deferred,
  add constraint incomes_person_paid_back check (person_id is null or kind = 'from_other');
create index incomes_person_idx on public.incomes (user_id, person_id)
  where person_id is not null;
