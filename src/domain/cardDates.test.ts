import { describe, expect, it } from 'vitest'
import {
  bestPurchaseDay,
  daysBetween,
  dueDate,
  dueText,
  invoiceMonthForCard,
  limitUse,
} from './cardDates'
import { cents } from './money'
import { isoDate, month } from './months'

describe('datas do cartão', () => {
  it('vencimento: no mês da fatura; na convenção do dono, no mês seguinte', () => {
    expect(dueDate(month('2026-10'), 9)).toBe('2026-10-09')
    expect(dueDate(month('2027-02'), 31)).toBe('2027-02-28')
    expect(dueDate(month('2026-09'), 9, true)).toBe('2026-10-09')
    expect(dueDate(month('2027-01'), 31, true)).toBe('2027-02-28')
  })

  it('dias entre datas e o texto do vencimento', () => {
    const today = isoDate('2026-09-29')
    expect(daysBetween(today, isoDate('2026-10-09'))).toBe(10)
    expect(dueText(isoDate('2026-10-09'), today)).toBe('faltam 10 dias')
    expect(dueText(isoDate('2026-09-30'), today)).toBe('vence amanhã')
    expect(dueText(today, today)).toBe('vence hoje')
    expect(dueText(isoDate('2026-09-28'), today)).toBe('venceu ontem')
    expect(dueText(isoDate('2026-09-26'), today)).toBe('venceu há 3 dias')
  })

  it('melhor dia pra comprar é o dia seguinte ao fechamento', () => {
    expect(bestPurchaseDay(3)).toBe(4)
    expect(bestPurchaseDay(31)).toBe(1)
  })

  it('limite usado', () => {
    expect(limitUse(cents(1_000_00), cents(250_00))).toEqual({
      used: 750_00,
      share: 0.75,
    })
    expect(limitUse(cents(1_000_00), cents(1_200_00))).toEqual({
      used: 0,
      share: 0,
    })
    expect(limitUse(cents(0), cents(0)).share).toBe(0)
    expect(limitUse(cents(100), cents(-50)).share).toBe(1)
  })

  it('mês da fatura, para todo mundo: depois do fechamento, a seguinte', () => {
    const day = isoDate('2026-09-20')
    expect(invoiceMonthForCard(day, { closingDay: null })).toBe('2026-09')
    expect(invoiceMonthForCard(day, { closingDay: 10, dueDay: 17 })).toBe(
      '2026-10',
    )
    expect(invoiceMonthForCard(day, { closingDay: 28 })).toBe('2026-09')
  })

  it('mês da fatura, convenção do dono: o mês antes do vencimento', () => {
    const day = isoDate('2026-09-20')
    const card = (closingDay: number | null, dueDay?: number | null) =>
      invoiceMonthForCard(day, { closingDay, dueDay }, true)
    expect(card(null)).toBe('2026-09')
    // Closes on the 10th: the bill closes 10/10, due 17/10, September's.
    expect(card(10, 17)).toBe('2026-09')
    // Before closing: closes 10/09, due 17/09, August's.
    expect(
      invoiceMonthForCard(
        isoDate('2026-09-05'),
        { closingDay: 10, dueDay: 17 },
        true,
      ),
    ).toBe('2026-08')
    // Closes on the 28th, due on the 5th: closes 28/09, due 05/10, September's.
    expect(card(28, 5)).toBe('2026-09')
    // No due day: a week after closing (28 + 7 is next month).
    expect(card(28, null)).toBe('2026-09')
    expect(card(10)).toBe('2026-09')
  })
})
