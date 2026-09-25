import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { seedData } from '../../src/domain/__fixtures__/seed'
import { monthBalance } from '../../src/domain/balance'
import { installmentSchedule } from '../../src/domain/installments'
import { invoiceTotals } from '../../src/domain/invoices'
import { toDecimal } from '../../src/domain/money'
import { month } from '../../src/domain/months'

type Snapshot = {
  schedule: unknown[]
  invoices: unknown[]
  months: Record<string, unknown>[]
}
let snapshot: Snapshot
const data = seedData()

beforeAll(() => {
  const development = JSON.parse(
    readFileSync('supabase/development.json', 'utf8'),
  )
  const linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  if (
    development.purpose !== 'development-only' ||
    linked !== development.projectRef
  )
    throw new Error('O projeto vinculado não é o desenvolvimento registrado.')
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/supabase/dist/supabase.js'),
      'db',
      'query',
      '--linked',
      '--file',
      resolve('tests/db/domain.sql'),
      // Force the CLI's JSON reply: without it, a person's terminal gets a table.
      '--agent',
      'yes',
    ],
    {
      encoding: 'utf8',
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    },
  )
  if (result.error) throw result.error
  const output = JSON.parse(result.stdout)
  if (result.status !== 0 || output.error || output._tag === 'Error')
    throw new Error(
      output.error?.message ||
        result.stderr ||
        'Falha na consulta de paridade.',
    )
  snapshot = output.rows?.find(
    (row: { snapshot?: Snapshot }) => row.snapshot,
  )?.snapshot
  if (
    !snapshot ||
    !Array.isArray(snapshot.schedule) ||
    !Array.isArray(snapshot.invoices) ||
    !Array.isArray(snapshot.months)
  )
    throw new Error(
      'Seed ausente ou consulta sem resultados. Execute npm run db:seed no desenvolvimento.',
    )
}, 60_000)

describe('TypeScript contra views reais do Supabase', () => {
  it('as 17 parcelas coincidem em mês, valor, número e pagamento', () => {
    const expected = data.plans
      .flatMap((plan) => installmentSchedule(plan, data.payments))
      .map((item) => ({ ...item, amount: toDecimal(item.amount) }))
    expect(expected).toHaveLength(17)
    expect(snapshot.schedule).toEqual(expected)
  })
  it('as 12 faturas coincidem em todas as partes, total atual e congelado', () => {
    const expected = data.invoices.map((invoice) => ({
      id: invoice.id,
      ...Object.fromEntries(
        Object.entries(invoiceTotals(invoice, data)).map(([key, value]) => [
          key,
          toDecimal(value),
        ]),
      ),
    }))
    expect(expected).toHaveLength(12)
    expect(snapshot.invoices).toEqual(expected)
  })
  it('os quatro resumos coincidem em entradas, saídas, disponível e falta pagar', () => {
    expect(snapshot.months).toHaveLength(4)
    for (const row of snapshot.months) {
      const ref = month(String(row.month))
      const balance = monthBalance(ref, data)
      expect(row).toMatchObject({
        month: ref,
        incomes: toDecimal(balance.incomes),
        outflows: toDecimal(balance.outflows),
        available: toDecimal(balance.available),
        unpaid: toDecimal(balance.unpaid),
      })
      expect(Number(row.committedRatio)).toBeCloseTo(
        balance.committedRatio!,
        12,
      )
    }
  })
})
