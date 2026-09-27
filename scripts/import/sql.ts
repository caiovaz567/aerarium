import { toDecimal, type Cents } from '../../src/domain/money'
import type { Month } from '../../src/domain/months'
import type { ImportData } from './mapBackup'

type Value = string | number | boolean | null

export function lit(value: Value): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new RangeError('Número inválido no SQL.')
    return String(value)
  }
  if (value.includes('\0')) throw new RangeError('Texto com caractere nulo.')
  return `'${value.replaceAll("'", "''")}'`
}
const money = (value: Cents) => toDecimal(value)
const date = (value: string | null) =>
  value === null ? 'null' : `${lit(value)}::date`
const monthDate = (value: Month) => date(`${value}-01`)
const uuidArray = (ids: readonly string[]) =>
  ids.length ? `array[${ids.map(lit).join(',')}]::uuid[]` : `'{}'::uuid[]`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function insert(
  table: string,
  columns: readonly string[],
  rows: readonly Value[][] | readonly string[][],
  conflict: string,
): string[] {
  if (!rows.length) return []
  const values = rows.map((row) => `  (${row.join(', ')})`).join(',\n')
  return [
    `insert into public.${table} (${columns.join(', ')}) values\n${values}\n${conflict};`,
  ]
}
const update = (columns: readonly string[]) =>
  `on conflict (id) do update set ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}`

/** Read-only lookup of the destination account. Runs as the CLI's admin role. */
export function lookupUserSql(email: string): string {
  return [
    'begin read only;',
    `select jsonb_build_object('users', coalesce((select jsonb_agg(jsonb_build_object('id', id::text, 'email', email)) from auth.users where lower(email) = lower(${lit(email.trim())})), '[]'::jsonb)) as lookup;`,
    'rollback;',
  ].join('\n')
}

/**
 * One transaction, written as the destination user (role authenticated + JWT claims),
 * so RLS and every trigger apply. `commit: false` rehearses and rolls back.
 */
export function importSql(
  data: ImportData,
  userId: string,
  commit: boolean,
): string {
  if (!UUID.test(userId)) throw new RangeError('user_id inválido.')
  const user = lit(userId)
  const claims = lit(JSON.stringify({ sub: userId, role: 'authenticated' }))
  const monthIds = data.months.map((item) => item.id)
  const monthRefs = data.months.length
    ? `array[${data.months.map((item) => monthDate(item.ref)).join(',')}]`
    : `'{}'::date[]`
  const planIds = data.plans.map((item) => item.id)
  const invoiceIds = data.invoices.map((item) => item.id)
  const decimal = (column: string) =>
    `'${column}', ${column}::numeric(12,2)::text`
  return [
    'begin;',
    "set local statement_timeout = '60s';",
    `select set_config('request.jwt.claim.sub', ${user}, true);`,
    `select set_config('request.jwt.claims', ${claims}, true);`,
    'set local role authenticated;',
    `do $$ begin
  if exists (select 1 from public.months where ref = any(${monthRefs}) and id <> all(${uuidArray(monthIds)})) then
    raise exception 'Essa conta já tem meses criados fora do import. Nada foi gravado.';
  end if;
end $$;`,
    ...insert(
      'cards',
      ['id', 'user_id', 'name', 'color', 'sort_order'],
      data.cards.map((item) => [
        lit(item.id),
        user,
        lit(item.name),
        lit(item.color),
        lit(item.sortOrder),
      ]),
      update(['name', 'color', 'sort_order']),
    ),
    ...insert(
      'months',
      ['id', 'user_id', 'ref'],
      data.months.map((item) => [lit(item.id), user, monthDate(item.ref)]),
      'on conflict (id) do nothing',
    ),
    ...insert(
      'installment_plans',
      [
        'id',
        'user_id',
        'card_id',
        'description',
        'installment_amount',
        'final_adjustment',
        'total_installments',
        'first_month',
        'note',
      ],
      data.plans.map((item) => [
        lit(item.id),
        user,
        lit(item.cardId),
        lit(item.description),
        money(item.installmentAmount),
        money(item.finalAdjustment),
        lit(item.totalInstallments),
        monthDate(item.firstMonth),
        lit(item.note),
      ]),
      update([
        'card_id',
        'description',
        'installment_amount',
        'final_adjustment',
        'total_installments',
        'first_month',
        'note',
      ]),
    ),
    ...insert(
      'installment_payments',
      ['id', 'user_id', 'plan_id', 'month', 'paid_on', 'source'],
      data.payments.map((item) => [
        lit(item.id),
        user,
        lit(item.planId),
        monthDate(item.month),
        date(item.paidOn),
        lit('manual'),
      ]),
      'on conflict do nothing',
    ),
    ...insert(
      'incomes',
      [
        'id',
        'user_id',
        'month_id',
        'description',
        'amount',
        'kind',
        'sort_order',
      ],
      data.incomes.map((item) => [
        lit(item.id),
        user,
        lit(item.monthId),
        lit(item.description),
        money(item.amount),
        lit(item.kind),
        lit(item.sortOrder),
      ]),
      update(['description', 'amount', 'kind', 'sort_order']),
    ),
    ...insert(
      'bills',
      [
        'id',
        'user_id',
        'month_id',
        'description',
        'amount',
        'paid',
        'paid_on',
        'sort_order',
      ],
      data.bills.map((item) => [
        lit(item.id),
        user,
        lit(item.monthId),
        lit(item.description),
        money(item.amount),
        lit(item.paid),
        date(item.paidOn),
        lit(item.sortOrder),
      ]),
      update(['description', 'amount', 'paid', 'paid_on', 'sort_order']),
    ),
    // Invoices go in unpaid; composition first, then the trigger freezes the total.
    ...insert(
      'invoices',
      [
        'id',
        'user_id',
        'card_id',
        'month_id',
        'other_amount',
        'estimated',
        'note',
      ],
      data.invoices.map((item) => [
        lit(item.id),
        user,
        lit(item.cardId),
        lit(item.monthId),
        money(item.otherAmount),
        lit(item.estimated),
        lit(item.note),
      ]),
      update(['other_amount', 'estimated', 'note']),
    ),
    ...insert(
      'invoice_expenses',
      ['id', 'user_id', 'invoice_id', 'description', 'amount', 'spent_on'],
      data.expenses.map((item) => [
        lit(item.id),
        user,
        lit(item.invoiceId),
        lit(item.description),
        money(item.amount),
        date(item.spentOn),
      ]),
      update(['description', 'amount', 'spent_on']),
    ),
    ...insert(
      'subscriptions',
      ['id', 'user_id', 'card_id', 'name', 'amount', 'charge_day', 'note'],
      data.subscriptions.map((item) => [
        lit(item.id),
        user,
        lit(item.cardId),
        lit(item.name),
        money(item.amount),
        lit(item.chargeDay),
        lit(item.note),
      ]),
      update(['card_id', 'name', 'amount', 'charge_day', 'note']),
    ),
    ...data.invoices
      .filter((item) => item.paid)
      .map(
        (item) =>
          `update public.invoices set paid = true, paid_on = ${date(item.paidOn)} where id = ${lit(item.id)} and not paid;`,
      ),
    `select jsonb_build_object(
  'months', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(ref, 'YYYY-MM'), ${decimal('incomes')}, ${decimal('outflows')}, ${decimal('available')}, ${decimal('unpaid')}) order by ref) from public.v_month_summary where ref = any(${monthRefs})), '[]'::jsonb),
  'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', invoice_id, ${decimal('total')})) from public.v_invoice_totals where invoice_id = any(${uuidArray(invoiceIds)})), '[]'::jsonb),
  'payments', (select jsonb_build_object('manual', count(*) filter (where source = 'manual'), 'invoice', count(*) filter (where source = 'invoice')) from public.installment_payments where plan_id = any(${uuidArray(planIds)}))
) as snapshot;`,
    commit ? 'commit;' : 'rollback;',
  ].join('\n')
}
