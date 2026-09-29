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
  it('vencimento no mês da fatura, sem passar do fim do mês', () => {
    expect(dueDate(month('2026-10'), 9)).toBe('2026-10-09')
    expect(dueDate(month('2027-02'), 31)).toBe('2027-02-28')
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

  it('mês da fatura: fechamento e vencimento antes do fechamento', () => {
    const day = isoDate('2026-09-20')
    expect(invoiceMonthForCard(day, { closingDay: null })).toBe('2026-09')
    expect(invoiceMonthForCard(day, { closingDay: 10, dueDay: 17 })).toBe(
      '2026-10',
    )
    // Closes on the 28th, due on the 5th: paid the month after.
    expect(invoiceMonthForCard(day, { closingDay: 28, dueDay: 5 })).toBe(
      '2026-10',
    )
    expect(invoiceMonthForCard(day, { closingDay: 28, dueDay: null })).toBe(
      '2026-09',
    )
  })
})
