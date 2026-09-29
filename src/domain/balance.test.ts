import { describe, expect, it } from 'vitest'
import { emptyData, fixtureId, seedData } from './__fixtures__/seed'
import { monthBalance } from './balance'
import { invoiceTotals } from './invoices'
import { cents } from './money'
import { month } from './months'

describe('paridade com contas manuais do seed SQL', () => {
  it.each([
    ['2026-08', 82500, 127500, 57500],
    ['2026-09', 85833, 124167, 77833],
    ['2026-10', 85833, 124167, 74500],
    ['2026-11', 85834, 124166, 77834],
  ])(
    '%s: saídas %i, disponível %i, pendente %i',
    (ref, outflows, available, unpaid) => {
      expect(monthBalance(month(ref), seedData())).toEqual({
        incomes: 210000,
        outflows,
        available,
        unpaid,
        committedRatio: outflows / 210000,
        otherOwed: 0,
        otherDue: 0,
      })
    },
  )
  it('composição do cartão 1: 100 + 20 + 12 + 8 + 30 = 170', () => {
    const data = seedData()
    expect(
      invoiceTotals(
        data.invoices.find((item) => item.id === fixtureId(5, 21))!,
        data,
      ),
    ).toEqual({
      installmentsAmount: 10000,
      subscriptionsAmount: 2000,
      expensesAmount: 2000,
      otherAmount: 3000,
      calculatedTotal: 17000,
      total: 17000,
      otherShare: 0,
      mine: 17000,
    })
  })
  it('mês vazio não divide por zero', () =>
    expect(monthBalance(month('2026-09'), emptyData())).toEqual({
      incomes: 0,
      outflows: 0,
      available: 0,
      unpaid: 0,
      committedRatio: null,
      otherOwed: 0,
      otherDue: 0,
    }))
  it('déficit não inventa renda nem um percentual negativo', () => {
    const data = emptyData({
      incomes: [
        {
          month: month('2026-09'),
          description: 'Déficit',
          amount: cents(-1000),
          kind: 'carryover',
          sortOrder: 0,
        },
      ],
    })
    expect(monthBalance(month('2026-09'), data)).toMatchObject({
      incomes: -1000,
      available: -1000,
      committedRatio: null,
    })
    expect(() =>
      monthBalance(month('2026-09'), {
        ...data,
        incomes: [{ ...data.incomes[0]!, kind: 'normal' }],
      }),
    ).toThrow()
  })
})
