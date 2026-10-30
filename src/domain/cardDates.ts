import { invoiceMonthForExpense } from './closing'
import { cents, type Cents } from './money'
import {
  addMonths,
  daysInMonth,
  isoDate,
  monthOf,
  type ISODate,
  type Month,
} from './months'
import type { Subscription } from './types'

// The dates of a card's invoice, like a bank app shows them. For everyone, an
// invoice is due in its own month. Only the owner (dueNextMonth) counts an
// invoice as the month before it is due: the bill due in October is their
// September's; nothing changes for anyone else.

/** The due date of the invoice of `target` (day clamped to the month's end). */
export function dueDate(
  target: Month,
  dueDay: number,
  nextMonth = false,
): ISODate {
  const due = nextMonth ? addMonths(target, 1) : target
  const day = Math.min(dueDay, daysInMonth(due))
  return isoDate(`${due}-${String(day).padStart(2, '0')}`)
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

/** How much of the limit is in use, as money and as a share from 0 to 1. */
export function limitUse(limit: Cents, available: Cents) {
  const used = cents(Math.max(0, limit - available))
  return { used, share: limit > 0 ? Math.min(1, used / limit) : 0 }
}

/**
 * The invoice month of a purchase on a card: from the closing day on it goes
 * to the next one (everyone). With the owner's convention: that bill is due the
 * month it closes when the due day comes after the closing day, else the
 * month after, and the invoice is the month before it is due. Without a due
 * day, it is taken as a week after closing.
 */
export function invoiceMonthForCard(
  spentOn: ISODate,
  card: { readonly closingDay: number | null; readonly dueDay?: number | null },
  nextMonth = false,
): Month {
  const closes = invoiceMonthForExpense(spentOn, card.closingDay)
  if (!nextMonth || !card.closingDay) return closes
  const dueDay = card.dueDay ?? card.closingDay + 7
  return dueDay > card.closingDay && dueDay <= 31
    ? addMonths(closes, -1)
    : closes
}

type CardDays = {
  readonly closingDay: number | null
  readonly dueDay?: number | null
}

/**
 * The first month a subscription is charged in: a start after the card's
 * closing goes to the next invoice, like a purchase. Off a card, its own month.
 */
export function subscriptionFirstMonth(
  startedOn: ISODate | null | undefined,
  card: CardDays | null,
  nextMonth = false,
): Month | null {
  if (!startedOn) return null
  return card
    ? invoiceMonthForCard(startedOn, card, nextMonth)
    : monthOf(startedOn)
}

/** Whether a subscription is charged in `target` (active and already started). */
export function chargedIn(item: Subscription, target: Month): boolean {
  return item.active && (!item.firstMonth || item.firstMonth <= target)
}

/** A card's subscriptions whose first month changes with its closing and due days. */
export function movedSubscriptions<T extends Subscription>(
  subscriptions: readonly T[],
  card: CardDays & { readonly id: string },
  nextMonth = false,
): T[] {
  return subscriptions.flatMap((item) => {
    if (item.cardId !== card.id || !item.startedOn) return []
    const firstMonth = subscriptionFirstMonth(item.startedOn, card, nextMonth)
    return firstMonth === item.firstMonth ? [] : [{ ...item, firstMonth }]
  })
}
