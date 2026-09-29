import { invoiceMonthForExpense } from './closing'
import { cents, type Cents } from './money'
import {
  addMonths,
  daysInMonth,
  isoDate,
  type ISODate,
  type Month,
} from './months'

// Fase 13.2: the dates of a card's invoice, like a bank app shows them. An
// invoice month is the month it is paid in, so its due date is in that month.

/** The due date of the invoice of `target` (day clamped to the month's end). */
export function dueDate(target: Month, dueDay: number): ISODate {
  const day = Math.min(dueDay, daysInMonth(target))
  return isoDate(`${target}-${String(day).padStart(2, '0')}`)
}

const noon = (value: ISODate) => Date.parse(`${value}T12:00:00Z`)

/** Whole days from `from` to `to` (negative when `to` is before). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((noon(to) - noon(from)) / 86_400_000)
}

/** "faltam 9 dias", "vence amanhã", "vence hoje", "venceu há 2 dias". */
export function dueText(due: ISODate, today: ISODate): string {
  const days = daysBetween(today, due)
  if (days > 1) return `faltam ${days} dias`
  if (days === 1) return 'vence amanhã'
  if (days === 0) return 'vence hoje'
  if (days === -1) return 'venceu ontem'
  return `venceu há ${-days} dias`
}

/** Buying the day after closing gives the most time until paying. */
export function bestPurchaseDay(closingDay: number): number {
  return closingDay >= 31 ? 1 : closingDay + 1
}

/** How much of the limit is in use, as money and as a share from 0 to 1. */
export function limitUse(limit: Cents, available: Cents) {
  const used = cents(Math.max(0, limit - available))
  return { used, share: limit > 0 ? Math.min(1, used / limit) : 0 }
}

/**
 * The invoice month of a purchase on a card: after closing it goes to the next
 * one; and when the due day comes before the closing day, the invoice that
 * closes this month is only paid next month.
 */
export function invoiceMonthForCard(
  spentOn: ISODate,
  card: { readonly closingDay: number | null; readonly dueDay?: number | null },
): Month {
  const target = invoiceMonthForExpense(spentOn, card.closingDay)
  return card.closingDay && card.dueDay && card.dueDay <= card.closingDay
    ? addMonths(target, 1)
    : target
}
