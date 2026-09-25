import { describe, expect, it } from 'vitest'
import { plan } from './__fixtures__/seed'
import {
  installmentNumber,
  installmentSchedule,
  installmentStatus,
  splitInstallments,
} from './installments'
import { cents, sumMoney } from './money'
import { isoDate, month } from './months'
import type { InstallmentPayment } from './types'

const payment: InstallmentPayment = {
  planId: 'plan',
  month: month('2026-09'),
  paidOn: isoDate('2026-09-24'),
  source: 'manual',
  invoiceId: null,
}

describe('parcelamento de cronograma fixo', () => {
  it('10x em setembro vai até junho mesmo com pagamentos e atrasos', () => {
    const schedule = installmentSchedule(plan(), [payment])
    expect(schedule).toHaveLength(10)
    expect(schedule[0]).toMatchObject({
      month: '2026-09',
      number: 1,
      paid: true,
    })
    expect(schedule[9]).toMatchObject({
      month: '2027-06',
      number: 10,
      paid: false,
    })
    expect(installmentNumber(plan(), month('2026-08'))).toBeNull()
    expect(installmentNumber(plan(), month('2027-07'))).toBeNull()
    expect(installmentNumber(plan(), month('2026-11'))).toBe(3)
    expect(installmentStatus(plan(), [payment])).toMatchObject({
      remaining: 9,
      paidCount: 1,
      settled: false,
      outstanding: 90000,
      settledOn: null,
    })
  })
  it('arredondamento mantém a soma exata para todos os 120 prazos', () => {
    for (let count = 1; count <= 120; count++) {
      for (const total of [count, 10000, 999999999999]) {
        const split = splitInstallments(cents(total), count)
        const schedule = installmentSchedule(
          plan({ totalInstallments: count, ...split }),
        )
        expect(sumMoney(schedule.map((item) => item.amount))).toBe(total)
        expect(schedule.every((item) => item.amount > 0)).toBe(true)
      }
    }
    expect(splitInstallments(cents(10000), 3)).toEqual({
      installmentAmount: 3333,
      finalAdjustment: 1,
    })
  })
  it('aceita ajuste negativo válido e quita só com todos os pagamentos', () => {
    const p = plan({
      totalInstallments: 2,
      installmentAmount: cents(101),
      finalAdjustment: cents(-1),
    })
    expect(installmentSchedule(p).map((item) => item.amount)).toEqual([
      101, 100,
    ])
    expect(
      installmentStatus(p, [
        payment,
        { ...payment, month: month('2026-10'), paidOn: isoDate('2026-09-01') },
      ]),
    ).toEqual({
      remaining: 0,
      paidCount: 2,
      settled: true,
      outstanding: 0,
      lastMonth: '2026-10',
      settledOn: '2026-09-24',
    })
  })
  it.each([0, 121, 2.5, NaN])('recusa prazo %s', (count) =>
    expect(() => splitInstallments(cents(100), count)).toThrow(),
  )
  it('recusa parcelas zeradas e ajustes que não são de arredondamento', () => {
    expect(() => splitInstallments(cents(1), 2)).toThrow()
    expect(() =>
      installmentSchedule(plan({ installmentAmount: cents(0) })),
    ).toThrow()
    expect(() =>
      installmentSchedule(
        plan({ installmentAmount: cents(1), finalAdjustment: cents(-1) }),
      ),
    ).toThrow()
    expect(() =>
      installmentSchedule(plan({ finalAdjustment: cents(10) })),
    ).toThrow()
  })
  it('recusa duplicação, mês fora do prazo e origem inconsistente', () => {
    expect(() => installmentSchedule(plan(), [payment, payment])).toThrow()
    expect(() =>
      installmentSchedule(plan(), [{ ...payment, month: month('2026-08') }]),
    ).toThrow()
    expect(() =>
      installmentSchedule(plan(), [{ ...payment, source: 'invoice' }]),
    ).toThrow()
    expect(
      installmentSchedule(plan(), [{ ...payment, planId: 'outro' }]).every(
        (item) => !item.paid,
      ),
    ).toBe(true)
  })
})
