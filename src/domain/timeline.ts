import {
  groupByCategory,
  monthOutflowItems,
  UNCATEGORIZED,
  UNDETAILED,
  type CategoryData,
  type OutflowItem,
} from './categories'
import { cents, sumMoney, type Cents } from './money'
import {
  addMonths,
  dateInSaoPaulo,
  isoDate,
  type ISODate,
  type Month,
} from './months'
import type { Bill, InvoiceExpense } from './types'

// Fase 12: the month's outflows by day and time, filters, and two short
// insights. Everything is built on monthOutflowItems, so the list always adds
// up to the month's outflows.

// ---------------------------------------------------------------------------
// São Paulo local time. Brazil has had no daylight saving since 2019, so the
// offset is fixed at -03:00.
const OFFSET = '-03:00'

/** "2026-09-26T14:30" (typed, São Paulo) → the instant, as ISO. */
export function saoPauloToInstant(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new RangeError('Data e hora inválidas.')
  const instant = new Date(`${local}:00${OFFSET}`)
  if (Number.isNaN(instant.getTime()))
    throw new RangeError('Data e hora inválidas.')
  return instant.toISOString()
}

/** The instant as "2026-09-26T14:30" in São Paulo, for a date-time field. */
export function instantToSaoPaulo(instant: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant))
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

/** "14:32" in São Paulo. */
export const timeLabel = (instant: string) =>
  instantToSaoPaulo(instant).slice(11)

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS = 'jan fev mar abr mai jun jul ago set out nov dez'.split(' ')

/** "Hoje", "Ontem" or "seg, 22 set". */
export function dayLabel(day: ISODate, today: ISODate): string {
  if (day === today) return 'Hoje'
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (day === yesterday.toISOString().slice(0, 10)) return 'Ontem'
  const date = new Date(`${isoDate(day)}T12:00:00Z`)
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

// ---------------------------------------------------------------------------

type WithTime = {
  readonly id: string
  readonly categoryId?: string | null
  /** The exact instant (ISO), when known. */
  readonly occurredAt?: string | null
}
export interface TimelineData extends CategoryData {
  readonly bills: readonly (Bill & WithTime)[]
  readonly expenses: readonly (InvoiceExpense &
    WithTime & { readonly spentOn?: ISODate })[]
}

export interface TimedItem extends OutflowItem {
  readonly day: ISODate
  /** The exact instant, when known; null for date only. */
  readonly at: string | null
}

export interface TimelineDay {
  readonly day: ISODate
  readonly total: Cents
  readonly items: readonly TimedItem[]
}

export interface Timeline {
  /** Newest first; inside a day, newest first, date-only last. */
  readonly days: readonly TimelineDay[]
  /** No date: installments, subscriptions, invoices' undetailed part, old bills. */
  readonly fixed: readonly OutflowItem[]
}

/** Where each outflow piece happened in time, when that is known. */
export function timedItems(
  target: Month,
  data: TimelineData,
): { dated: TimedItem[]; fixed: OutflowItem[] } {
  const dated: TimedItem[] = []
  const fixed: OutflowItem[] = []
  for (const item of monthOutflowItems(target, data)) {
    if (item.source === 'expense') {
      const expense = data.expenses.find((row) => row.id === item.id)!
      const at = expense.occurredAt ?? null
      const day = at ? dateInSaoPaulo(new Date(at)) : (expense.spentOn ?? null)
      if (day) {
        dated.push({ ...item, day, at })
        continue
      }
    }
    if (item.source === 'bill') {
      const at =
        data.bills.find((row) => row.id === item.id)!.occurredAt ?? null
      if (at) {
        dated.push({ ...item, day: dateInSaoPaulo(new Date(at)), at })
        continue
      }
    }
    fixed.push(item)
  }
  return { dated, fixed }
}

export function buildTimeline(
  dated: readonly TimedItem[],
  fixed: readonly OutflowItem[],
): Timeline {
  const sorted = [...dated].sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0) ||
      (b.at ?? '').localeCompare(a.at ?? '') ||
      b.amount - a.amount,
  )
  const days: TimelineDay[] = []
  for (const item of sorted) {
    const last = days[days.length - 1]
    if (last?.day === item.day)
      days[days.length - 1] = {
        ...last,
        total: sumMoney([last.total, item.amount]),
        items: [...last.items, item],
      }
    else days.push({ day: item.day, total: item.amount, items: [item] })
  }
  return { days, fixed: [...fixed].sort((a, b) => b.amount - a.amount) }
}

/** Card id, NO_CARD_FILTER for outside cards, or null for all. */
export const NO_CARD_FILTER = 'fora-do-cartao'

export interface TimelineFilter {
  readonly cardId: string | null
  /** A category id, UNCATEGORIZED, or null for all. */
  readonly categoryId: string | null
}

export function matchesFilter(item: OutflowItem, filter: TimelineFilter) {
  if (filter.cardId !== null) {
    const card = item.cardId ?? NO_CARD_FILTER
    if (card !== filter.cardId) return false
  }
  if (filter.categoryId !== null) {
    if (item.source === 'other') return false
    if ((item.categoryId ?? UNCATEGORIZED) !== filter.categoryId) return false
  }
  return true
}

export function monthTimeline(
  target: Month,
  data: TimelineData,
  filter: TimelineFilter = { cardId: null, categoryId: null },
): Timeline {
  const { dated, fixed } = timedItems(target, data)
  return buildTimeline(
    dated.filter((item) => matchesFilter(item, filter)),
    fixed.filter((item) => matchesFilter(item, filter)),
  )
}

// ---------------------------------------------------------------------------
// Category changes against the month before.

/** Changes smaller than this are noise and are not shown. */
export const MIN_CHANGE = cents(2000)

/**
 * For each group of this month (categories and "Sem categoria"), how much it
 * went up (positive) or down against the month before. Null when the month
 * before has nothing to compare with. Small changes are left out.
 */
export function categoryChanges(
  target: Month,
  data: TimelineData,
): { readonly previous: Month; readonly changes: Map<string, Cents> } | null {
  const previous = addMonths(target, -1)
  const hasPrevious =
    data.bills.some((item) => item.month === previous) ||
    data.invoices.some((item) => item.month === previous)
  if (!hasPrevious) return null
  const before = new Map(
    groupByCategory(monthOutflowItems(previous, data)).map((group) => [
      group.key,
      group.amount,
    ]),
  )
  const changes = new Map<string, Cents>()
  for (const group of groupByCategory(monthOutflowItems(target, data))) {
    if (group.key === UNDETAILED) continue
    const change = sumMoney([
      group.amount,
      cents(-(before.get(group.key) ?? 0)),
    ])
    if (Math.abs(change) >= MIN_CHANGE) changes.set(group.key, change)
  }
  return { previous, changes }
}
