-- Executed inside a transaction after seed.sql. ALWAYS rolled back by the runner.
-- Real Postgres roles/JWT claims, not queries run with a bypass-RLS administrator.
create temp table phase1_results ("check" text, status text);
grant all on phase1_results to authenticated, anon;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', (select nspname from pg_namespace where oid = pg_my_temp_schema()));
end $$;

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql security invoker as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into phase1_results values (label, 'PASS');
end $$;

create function pg_temp.expect_error(command text, expected text, label text) returns void
language plpgsql security invoker as $$
declare actual text;
begin
  begin
    execute command;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
  end;
  perform pg_temp.assert_true(actual = expected, label || ' [SQLSTATE ' || coalesce(actual, 'none') || ']');
end $$;

select pg_temp.assert_true((select count(*) = 12 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity), 'RLS ativo nas 12 tabelas');
select pg_temp.assert_true((select count(*) = 3 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v' and c.reloptions @> array['security_invoker=true']), '3 views usam security_invoker');
select pg_temp.assert_true((select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.prosecdef), 'Nenhuma funcao ignora RLS com security definer');
select pg_temp.assert_true(not exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))), 'Clientes nao executam funcoes security definer do app ou auxiliares da plataforma');
select pg_temp.assert_true(not exists(select 1 from storage.buckets where id = 'card-photos') and not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cards' and column_name = 'photo_path'), 'Fotos de cartao removidas do banco');

-- Only a temporary test user; no credentials, identity or email is sent.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'aerarium.rls-b@example.test', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Hand-calculated: two incomes 2000+100, bills 500+80, invoices 170+70+5.
-- Invoice 170 = installment 100 + subscription 20 + expenses (12+8) + other 30.
select pg_temp.assert_true((select installments_amount = 100 and subscriptions_amount = 20 and expenses_amount = 20
  and other_amount = 30 and total = 170 from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000021'), 'Composicao sem multiplicar joins');
select pg_temp.assert_true((select incomes = 2100 and outflows = 825 and available = 1275 and unpaid = 575
  from public.v_month_summary where ref = '2026-08-01'), 'Agosto: 2100 - 825 = 1275; pendente 575');
select pg_temp.assert_true((select incomes = 2100 and outflows = 858.33 and available = 1241.67 and unpaid = 778.33
  from public.v_month_summary where ref = '2026-09-01'), 'Setembro: 2100 - 858.33 = 1241.67; pendente 778.33');
select pg_temp.assert_true((select outflows = 858.33 and unpaid = 745 from public.v_month_summary where ref = '2026-10-01'), 'Outubro: parcela avulsa paga reduz pendente');
select pg_temp.assert_true((select outflows = 858.34 and available = 1241.66 and unpaid = 778.34
  from public.v_month_summary where ref = '2026-11-01'), 'Novembro: ultima parcela recebe 1 centavo');
select pg_temp.assert_true((select count(*) = 10 and min(month) = '2026-07-01' and max(month) = '2027-04-01'
  and max(number) = 10 from public.v_installment_schedule where plan_id = '40000000-0000-4000-8000-000000000001'), 'Cronograma fixo tem 10 meses, independente de pagamentos');
select pg_temp.assert_true((select sum(amount) = 100 from public.v_installment_schedule where plan_id = '40000000-0000-4000-8000-000000000003'), '33.33 + 33.33 + 33.34 = 100 exatos');
select pg_temp.assert_true((select count(*) = 2 from public.v_installment_schedule where plan_id = '40000000-0000-4000-8000-000000000001' and paid), 'Pagamentos manuais e automaticos contam sem alterar cronograma');

-- Freeze total even if the plan price subsequently changes.
update public.installment_plans set installment_amount = 110 where id = '40000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select total = 170 and calculated_total = 180 from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000011'), 'Fatura paga conserva total; composicao atual pode divergir');
select pg_temp.assert_true((select total = 180 from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000021'), 'Fatura aberta recalcula ao mudar parcela');
update public.invoices set closed_total = 1 where id = '50000000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select closed_total = 170 from public.invoices where id = '50000000-0000-4000-8000-000000000011'), 'Edicao direta nao altera total congelado');
update public.invoices set paid = false where id = '50000000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select total = 180 and closed_total is null and paid_on is null from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000011'), 'Reabrir limpa congelamento e recalcula');
select pg_temp.assert_true(not exists(select 1 from public.installment_payments where invoice_id = '50000000-0000-4000-8000-000000000011'), 'Reabrir remove pagamento automatico');
select pg_temp.assert_true(exists(select 1 from public.installment_payments where id = '90000000-0000-4000-8000-000000000001' and source = 'manual'), 'Reabrir preserva outros pagamentos manuais');
update public.installment_plans set installment_amount = 100 where id = '40000000-0000-4000-8000-000000000001';
update public.invoices set paid = true, paid_on = '2026-08-15' where id = '50000000-0000-4000-8000-000000000011';
select pg_temp.assert_true((select source = 'invoice' and paid_on = '2026-08-15' from public.installment_payments
  where plan_id = '40000000-0000-4000-8000-000000000001' and month = '2026-08-01'), 'Pagar fatura registra origem e data');
update public.invoices set paid = true where id = '50000000-0000-4000-8000-000000000022';
update public.invoices set paid = false where id = '50000000-0000-4000-8000-000000000022';
select pg_temp.assert_true((select source = 'manual' from public.installment_payments where id = '90000000-0000-4000-8000-000000000002'), 'Pagamento manual da mesma parcela sobrevive a pagar e reabrir fatura');

-- Paid flags/date, estimates, zero incomes and negative carryover.
update public.invoices set estimated = true where id = '50000000-0000-4000-8000-000000000021';
update public.invoices set other_amount = 31 where id = '50000000-0000-4000-8000-000000000021';
select pg_temp.assert_true((select not estimated from public.invoices where id = '50000000-0000-4000-8000-000000000021'), 'Editar outros gastos remove estimativa');
update public.invoices set other_amount = 30 where id = '50000000-0000-4000-8000-000000000021';
update public.bills set paid = false where id = '70000000-0000-4000-8000-000000000012';
select pg_temp.assert_true((select paid_on is null from public.bills where id = '70000000-0000-4000-8000-000000000012'), 'Conta reaberta limpa a data');
update public.bills set paid = true where id = '70000000-0000-4000-8000-000000000012';
insert into public.months (id, ref) values ('30000000-0000-4000-8000-000000000099', '2027-01-01');
select pg_temp.assert_true((select incomes = 0 and available = 0 and committed_ratio is null from public.v_month_summary where ref = '2027-01-01'), 'Mes vazio sem divisao por zero');
insert into public.incomes (month_id, description, amount, kind) values ('30000000-0000-4000-8000-000000000099', 'Deficit anterior', -10, 'carryover');
select pg_temp.assert_true((select available = -10 from public.v_month_summary where ref = '2027-01-01'), 'Sobra negativa transporta deficit');
delete from public.months where id = '30000000-0000-4000-8000-000000000099';

-- Subscriptions without card are informational; active ones recalculate open invoices.
insert into public.subscriptions (name, amount, charge_day) values ('Sem cartao', 999, 31);
select pg_temp.assert_true((select outflows = 858.33 from public.v_month_summary where ref = '2026-09-01'), 'Assinatura sem cartao nao duplica saidas');
update public.subscriptions set active = false where id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select total = 150 from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000021'), 'Desativar assinatura retira de faturas abertas');
select pg_temp.assert_true((select total = 170 from public.v_invoice_totals where invoice_id = '50000000-0000-4000-8000-000000000011'), 'Desativar assinatura nao altera total pago');
update public.subscriptions set active = true where id = 'a0000000-0000-4000-8000-000000000001';

select pg_temp.expect_error($q$insert into public.installment_payments (plan_id, month) values ('40000000-0000-4000-8000-000000000001','2026-06-01')$q$, '23514', 'Recusa pagamento fora do cronograma');
select pg_temp.expect_error($q$insert into public.installment_payments (plan_id, month) values ('40000000-0000-4000-8000-000000000001','2026-07-01')$q$, '23505', 'Recusa pagamento duplicado');
select pg_temp.expect_error($q$update public.installment_plans set first_month = '2026-08-01' where id = '40000000-0000-4000-8000-000000000001'$q$, '23514', 'Nao deixa pagamento fora do cronograma editado');
select pg_temp.expect_error($q$delete from public.installment_payments where invoice_id = '50000000-0000-4000-8000-000000000011'$q$, '23514', 'Pagamento automatico so e removido ao reabrir fatura');
select pg_temp.expect_error($q$update public.months set ref = '2027-08-01' where id = '30000000-0000-4000-8000-000000000001'$q$, '23514', 'Mes criado nao muda de referencia');
select pg_temp.expect_error($q$insert into public.incomes (month_id, description, amount) values ('30000000-0000-4000-8000-000000000001','Negativa',-1)$q$, '23514', 'Entrada normal nao pode ser negativa');
select pg_temp.expect_error($q$insert into public.incomes (month_id, description, amount) values ('30000000-0000-4000-8000-000000000001','NaN','NaN')$q$, '23514', 'Dinheiro rejeita NaN');
select pg_temp.expect_error($q$insert into public.invoice_expenses (invoice_id, description, amount) values ('50000000-0000-4000-8000-000000000011','Zero',0)$q$, '23514', 'Gasto deve ser positivo');
select pg_temp.expect_error($q$insert into public.cards (name, closing_day) values ('Dia invalido',32)$q$, '23514', 'Dia do fechamento limitado a 1..31');

-- Transactional metadata-only Storage fixtures; no physical object is uploaded.

-- Categories (Fase 11): owned like everything else; deleting one keeps its items.
insert into public.categories (id, name, color) values
  ('c0000000-0000-4000-8000-000000000001', 'Moradia', '#7048E8'),
  ('c0000000-0000-4000-8000-000000000002', 'Lazer', '#D6336C');
update public.bills set category_id = 'c0000000-0000-4000-8000-000000000001';
update public.installment_plans set category_id = 'c0000000-0000-4000-8000-000000000002' where id = '40000000-0000-4000-8000-000000000001';
select pg_temp.expect_error($q$insert into public.categories (name, color) values ('Moradia', '#000000')$q$, '23505', 'Categoria nao repete nome');
select pg_temp.expect_error($q$insert into public.categories (name, color) values ('Cor ruim', 'azul')$q$, '23514', 'Categoria exige cor #RRGGBB');
select pg_temp.expect_error($q$insert into public.categories (name, color, icon) values ('Icone ruim', '#000000', 'Carro!')$q$, '23514', 'Categoria exige icone da lista');
select pg_temp.assert_true((select icon = 'tag' from public.categories where id = 'c0000000-0000-4000-8000-000000000002'), 'Categoria nova comeca com a etiqueta');
delete from public.categories where id = 'c0000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select category_id is null from public.installment_plans where id = '40000000-0000-4000-8000-000000000001'), 'Apagar categoria deixa o parcelamento sem categoria');
select pg_temp.assert_true((select count(*) > 0 and bool_and(category_id is not null) from public.bills), 'Contas guardam a categoria');
-- Fase 12: exact time; the expense's date follows it (São Paulo time).
update public.invoice_expenses set occurred_at = '2026-09-04T01:30:00Z' where id = (select id from public.invoice_expenses order by id limit 1);
select pg_temp.assert_true((select spent_on = '2026-09-03' from public.invoice_expenses where occurred_at is not null limit 1), 'Gasto com hora fica no dia de Sao Paulo');
update public.bills set occurred_at = '2026-09-02T15:00:00Z' where id = (select id from public.bills order by id limit 1);
select pg_temp.assert_true((select count(*) = 1 from public.bills where occurred_at is not null), 'Conta guarda data e hora');
-- Open Finance: bank accounts and handled records belong to their owner.
insert into public.bank_accounts (id, pluggy_account_id, item_id, name, card_id) values ('b0000000-0000-4000-8000-000000000001', 'acc-1', 'item-1', 'Cartao do banco', '20000000-0000-4000-8000-000000000002');
insert into public.bank_records (external_id, kind) values ('tx-1', 'ignored');
select pg_temp.expect_error($q$insert into public.bank_records (external_id, kind) values ('tx-1', 'expense')$q$, '23505', 'Registro do banco nao repete');
select pg_temp.expect_error($q$insert into public.bank_records (external_id, kind) values ('tx-2', 'outro')$q$, '23514', 'Registro do banco tem tipo conhecido');
select pg_temp.expect_error($q$insert into public.bank_accounts (pluggy_account_id, item_id, name) values ('acc-1', 'item-1', 'De novo')$q$, '23505', 'Conta do banco nao repete');
update public.invoice_expenses set note = 'Presente' where id = (select id from public.invoice_expenses order by id limit 1);
select pg_temp.assert_true((select count(*) = 1 from public.invoice_expenses where note = 'Presente'), 'Gasto guarda uma descricao propria');
select pg_temp.expect_error($q$update public.invoice_expenses set note = repeat('a', 201)$q$, '23514', 'Descricao do gasto tem limite');
update public.cards set bank = 'nubank', due_day = 10 where id = '20000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select bank = 'nubank' and due_day = 10 from public.cards where id = '20000000-0000-4000-8000-000000000002'), 'Cartao guarda banco e vencimento');
select pg_temp.expect_error($q$update public.cards set bank = 'Banco!'$q$, '23514', 'Banco do cartao e uma chave simples');
select pg_temp.expect_error($q$update public.cards set due_day = 32$q$, '23514', 'Vencimento entre 1 e 31');
update public.bank_accounts set credit_limit = 5000, available_limit = 3200.50, limit_at = now() where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select available_limit = 3200.50 from public.bank_accounts where id = 'b0000000-0000-4000-8000-000000000001'), 'Conta do banco guarda o limite');
select pg_temp.expect_error($q$update public.bank_accounts set credit_limit = -1$q$, '23514', 'Limite nao e negativo');
-- Switch to the second user. Every table and view must be empty to B.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ declare t text; n bigint; begin
  foreach t in array array['cards','months','incomes','bills','invoices','invoice_expenses','installment_plans','installment_payments','subscriptions','categories','bank_accounts','bank_records'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.assert_true(n = 0, 'B nao le A: ' || t);
    execute format('with changed as (update public.%I set user_id = user_id returning id) select count(*) from changed', t) into n;
    perform pg_temp.assert_true(n = 0, 'B nao altera A: ' || t);
    execute format('with changed as (delete from public.%I returning id) select count(*) from changed', t) into n;
    perform pg_temp.assert_true(n = 0, 'B nao apaga A: ' || t);
  end loop;
  foreach t in array array['v_installment_schedule','v_invoice_totals','v_month_summary'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.assert_true(n = 0, 'View respeita RLS: ' || t);
  end loop;
end $$;
insert into public.cards (id, name) values ('20000000-0000-4000-8000-000000000099','Cartao B');
insert into public.months (id, ref) values ('30000000-0000-4000-8000-000000000099','2026-09-01');
select pg_temp.assert_true((select count(*) = 1 from public.cards), 'B cria e le seus proprios dados');
select pg_temp.expect_error($q$insert into public.cards (user_id, name) values ('10000000-0000-4000-8000-000000000001','Forjado')$q$, '42501', 'B nao insere como A');
select pg_temp.expect_error($q$update public.cards set user_id = '10000000-0000-4000-8000-000000000001' where id = '20000000-0000-4000-8000-000000000099'$q$, '23514', 'B nao transfere registro para A');
select pg_temp.expect_error($q$insert into public.incomes (month_id, description, amount) values ('30000000-0000-4000-8000-000000000001','FK A',1)$q$, '23503', 'FK impede entrada de B em mes de A');
select pg_temp.expect_error($q$insert into public.bills (month_id, description, amount) values ('30000000-0000-4000-8000-000000000001','FK A',1)$q$, '23503', 'FK impede conta de B em mes de A');
select pg_temp.expect_error($q$insert into public.invoices (card_id, month_id) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000099')$q$, '23503', 'FK impede fatura de B em cartao de A');
select pg_temp.expect_error($q$insert into public.invoices (card_id, month_id) values ('20000000-0000-4000-8000-000000000099','30000000-0000-4000-8000-000000000001')$q$, '23503', 'FK impede fatura de B em mes de A');
select pg_temp.expect_error($q$insert into public.invoice_expenses (invoice_id, description, amount) values ('50000000-0000-4000-8000-000000000011','FK A',1)$q$, '23503', 'FK impede gasto de B em fatura de A');
select pg_temp.expect_error($q$insert into public.installment_plans (card_id, description, installment_amount,total_installments,first_month) values ('20000000-0000-4000-8000-000000000001','FK A',1,1,'2026-09-01')$q$, '23503', 'FK impede plano de B em cartao de A');
select pg_temp.expect_error($q$insert into public.installment_payments (plan_id, month) values ('40000000-0000-4000-8000-000000000001','2026-09-01')$q$, '23503', 'B nao paga plano de A');
select pg_temp.expect_error($q$insert into public.subscriptions (card_id,name,amount,charge_day) values ('20000000-0000-4000-8000-000000000001','FK A',1,1)$q$, '23503', 'FK impede assinatura de B em cartao de A');
select pg_temp.expect_error($q$insert into public.bills (month_id, description, amount, category_id) values ('30000000-0000-4000-8000-000000000099','FK A',1,'c0000000-0000-4000-8000-000000000001')$q$, '23503', 'FK impede conta de B em categoria de A');
select pg_temp.expect_error($q$insert into public.bank_accounts (pluggy_account_id, item_id, name, card_id) values ('acc-b', 'item-b', 'B', '20000000-0000-4000-8000-000000000002')$q$, '23503', 'FK impede conta do banco de B em cartao de A');
insert into public.categories (name, color) values ('Moradia', '#7048E8');
select pg_temp.assert_true((select count(*) = 1 from public.categories), 'B tem categoria com o mesmo nome da de A');

-- Unauthenticated access is denied even if someone guesses an identifier.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.expect_error('select * from public.cards', '42501', 'Anon sem acesso a tabelas');
select pg_temp.expect_error('select * from public.v_month_summary', '42501', 'Anon sem acesso a views');

reset role;
select pg_temp.assert_true((select count(*) = 3 from public.cards where user_id = '10000000-0000-4000-8000-000000000001'), 'Tentativas de B preservaram os cartoes de A');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
delete from public.cards where id = '20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not exists(select 1 from public.invoices where card_id = '20000000-0000-4000-8000-000000000001'), 'Excluir cartao remove suas faturas');
select pg_temp.assert_true(not exists(select 1 from public.invoice_expenses), 'Excluir cartao remove gastos de suas faturas');
select pg_temp.assert_true((select card_id is null from public.installment_plans where id = '40000000-0000-4000-8000-000000000001'), 'Excluir cartao preserva parcelamento sem cartao');
select pg_temp.assert_true((select card_id is null from public.subscriptions where id = 'a0000000-0000-4000-8000-000000000001'), 'Excluir cartao preserva assinatura sem cartao');
select pg_temp.assert_true((select count(*) = 1 and bool_and(source = 'manual') from public.installment_payments where plan_id = '40000000-0000-4000-8000-000000000001'), 'Excluir cartao remove pagamentos automaticos e preserva manuais');
-- Leave another paid invoice to exercise account cascades with automatic payments.
update public.invoices set paid = true where id = '50000000-0000-4000-8000-000000000012';
reset role;
delete from auth.users where id = '10000000-0000-4000-8000-000000000001';
do $$ declare t text; remaining bigint; begin
  foreach t in array array['cards','months','incomes','bills','invoices','invoice_expenses','installment_plans','installment_payments','subscriptions','categories','bank_accounts','bank_records'] loop
    execute format('select count(*) from public.%I where user_id = %L', t, '10000000-0000-4000-8000-000000000001') into remaining;
    perform pg_temp.assert_true(remaining = 0, 'Excluir conta remove ' || t);
  end loop;
end $$;
select pg_temp.assert_true((select count(*) = 1 from public.cards where user_id = '10000000-0000-4000-8000-000000000002'), 'Excluir A preserva dados de B');
delete from auth.users where id = '10000000-0000-4000-8000-000000000002';
select pg_temp.assert_true(not exists(select 1 from public.cards where user_id = '10000000-0000-4000-8000-000000000002'), 'Excluir usuario remove seus dados');
select "check", status from phase1_results;
