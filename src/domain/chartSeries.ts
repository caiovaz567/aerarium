import { installmentSchedule } from './installments'
import { fixedCardAmounts, invoiceTotals } from './invoices'
import { cents, divideMoney, sumMoney, type Cents } from './money'
import { addMonths, month, monthRange, type Month } from './months'
import type { FinancialData } from './types'

export interface ChartPoint {
  readonly month: Month
  readonly total: Cents
  readonly kind: 'real' | 'forecast' | 'empty'
  readonly paid: boolean
  readonly invoiceId: string | null
}

/**
 * Whose part of a card's invoices: all of it, the owner's (without what is the
 * other person's) or the other person's (Fase 13.3, the Eu | Pai views).
 */
export type CardPart = 'total' | 'mine' | 'other'

/** At least +/-6 months. As in v1, projections extend at most 12 months. */
export function chartSeries(
  cardId: string,
  current: Month,
  data: FinancialData,
  part: CardPart = 'total',
): ChartPoint[] {
  month(current)
  const invoices = data.invoices.filter((item) => item.cardId === cardId)
  const byMonth = new Map(invoices.map((item) => [item.month, item]))
  if (byMonth.size !== invoices.length)
    throw new RangeError('Mais de uma fatura do cartão no mesmo mês.')
  const schedule = data.plans
    .filter((item) => item.cardId === cardId)
    .flatMap((plan) => installmentSchedule(plan, data.payments))
  const low = invoices.reduce(
    (first, item) => (item.month < first ? item.month : first),
    addMonths(current, -6),
  )
  const limit = addMonths(current, 12)
  const high = [
    ...invoices.map((item) => item.month),
    ...schedule.filter((item) => !item.paid).map((item) => item.month),
  ]
    .filter((value) => value <= limit)
    .reduce(
      (last, value) => (value > last ? value : last),
      addMonths(current, 6),
    )
  return monthRange(low, high).map((target) => {
    const invoice = byMonth.get(target)
    if (invoice)
      return {
        month: target,
        total: partOf(invoiceTotals(invoice, data), part),
        kind: invoice.paid || !invoice.estimated ? 'real' : 'forecast',
        paid: invoice.paid,
        invoiceId: invoice.id,
      }
    const total =
      target >= current ? forecastPart(cardId, target, data, part) : cents(0)
    return {
      month: target,
      total,
      kind: total > 0 ? 'forecast' : 'empty',
      paid: false,
      invoiceId: null,
    }
  })
}

export function chartAverage(points: readonly ChartPoint[], current: Month) {
  month(current)
  const real = points
    .filter((item) => item.kind === 'real' && item.month <= current)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
  if (real.length < 2) return null
  return {
    amount: divideMoney(sumMoney(real.map((item) => item.total)), real.length),
    count: real.length,
  }
}

export function chartComparison(
  points: readonly ChartPoint[],
  selected: Month,
) {
  const current = points.find((item) => item.month === selected)
  const previous = points.find((item) => item.month === addMonths(selected, -1))
  if (
    !current ||
    !previous ||
    current.kind === 'empty' ||
    previous.kind === 'empty'
  )
    return null
  const difference = sumMoney([current.total, cents(-previous.total)])
  return {
    previousMonth: previous.month,
    difference,
    direction:
      difference === 0
        ? ('equal' as const)
        : difference > 0
          ? ('up' as const)
          : ('down' as const),
    percentage:
      previous.total > 0 ? (Math.abs(difference) / previous.total) * 100 : null,
  }
}

/** The part of an invoice's totals. */
export function partOf(
  totals: {
    readonly total: Cents
    readonly mine: Cents
    readonly otherShare: Cents
  },
  part: CardPart,
): Cents {
  return part === 'mine'
    ? totals.mine
    : part === 'other'
      ? totals.otherShare
      : totals.total
}

/**
 * A month with no invoice yet: its installments and subscriptions. The other
 * person's part is only their installments; the subscriptions are the owner's.
 */
function forecastPart(
  cardId: string,
  target: Month,
  data: FinancialData,
  part: CardPart,
): Cents {
  const fixed = fixedCardAmounts(cardId, target, data)
  if (part === 'total') return sumMoney(Object.values(fixed))
  const theirs = sumMoney(
    data.plans
      .filter((plan) => plan.cardId === cardId && plan.forOther)
      .flatMap((plan) => installmentSchedule(plan, data.payments))
      .filter((item) => item.month === target)
      .map((item) => item.amount),
  )
  return part === 'other'
    ? theirs
    : cents(fixed.installmentsAmount - theirs + fixed.subscriptionsAmount)
}
