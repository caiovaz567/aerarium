-- Fase 11 (pedido do usuário depois da Fase 10): categorias de saídas.
-- Gastos lançados, contas, parcelamentos e assinaturas podem ter uma categoria
-- (opcional). A lista é de cada pessoa: o app cria a lista padrão na primeira
-- vez e a pessoa pode renomear, criar e apagar. Apagar uma categoria deixa os
-- itens sem categoria.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

alter table public.categories enable row level security;
create policy owner_access on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.categories from anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated, service_role;
create trigger guard_identity before update on public.categories
  for each row execute function private.guard_identity();

-- Same owner on both sides (composite FK), like card_id.
do $$
declare t text;
begin
  foreach t in array array['invoice_expenses','bills','installment_plans','subscriptions'] loop
    execute format('alter table public.%I add column category_id uuid', t);
    execute format('alter table public.%I add foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)', t);
    execute format('create index %I on public.%I (category_id, user_id)', t || '_category_owner', t);
  end loop;
end;
$$;
