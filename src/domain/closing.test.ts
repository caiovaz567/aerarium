import { describe, expect, it } from 'vitest'
import { invoiceMonthForExpense } from './closing'
import { isoDate, month } from './months'

describe('fechamento do cartão', () => {
  it.each([
    ['2026-09-04', 5, '2026-09'],
    ['2026-09-05', 5, '2026-09'],
    ['2026-09-06', 5, '2026-10'],
    ['2026-12-31', 5, '2027-01'],
    ['2026-09-30', null, '2026-09'],
    ['2026-02-28', 31, '2026-02'],
    ['2028-02-29', 31, '2028-02'],
    ['2026-04-30', 31, '2026-04'],
    ['2028-02-29', 28, '2028-03'],
    ['2026-09-02', 1, '2026-10'],
  ])('%s com fechamento %s vai para %s', (date, day, expected) =>
    expect(invoiceMonthForExpense(isoDate(date), day)).toBe(expected),
  )
  it('escolha manual vence a sugestão', () =>
    expect(
      invoiceMonthForExpense(isoDate('2026-09-06'), 5, month('2026-08')),
    ).toBe('2026-08'))
  it.each([0, 32, 1.5, NaN])('recusa fechamento %s', (day) =>
    expect(() => invoiceMonthForExpense(isoDate('2026-09-01'), day)).toThrow(),
  )
})
