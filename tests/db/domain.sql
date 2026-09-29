-- Read-only parity check. No real-user data, seed writes or administrative RLS bypass.
begin read only;
set local statement_timeout = '20s';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select jsonb_build_object(
  'schedule', (select jsonb_agg(jsonb_build_object(
    'planId', plan_id, 'cardId', card_id, 'description', description,
    'month', to_char(month, 'YYYY-MM'), 'number', number, 'totalInstallments', total_installments,
    'amount', amount::text, 'paid', paid, 'paidOn', paid_on, 'source', source, 'invoiceId', invoice_id
  ) order by plan_id, month) from public.v_installment_schedule),
  'invoices', (select jsonb_agg(jsonb_build_object(
    'id', invoice_id, 'installmentsAmount', installments_amount::numeric(12,2)::text,
    'subscriptionsAmount', subscriptions_amount::numeric(12,2)::text, 'expensesAmount', expenses_amount::numeric(12,2)::text,
    'otherAmount', other_amount::text, 'calculatedTotal', calculated_total::text, 'total', total::text,
    'otherShare', other_share::numeric(12,2)::text, 'mine', mine::numeric(12,2)::text
  ) order by invoice_id) from public.v_invoice_totals),
  'months', (select jsonb_agg(jsonb_build_object(
    'month', to_char(ref, 'YYYY-MM'), 'incomes', incomes::text, 'outflows', outflows::text,
    'available', available::text, 'unpaid', unpaid::text, 'committedRatio', committed_ratio
  ) order by ref) from public.v_month_summary)
) as snapshot;
rollback;
