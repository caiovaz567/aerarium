import type { Finance } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { addMonths, type Month } from '../../domain/months'
import { buildNewMonth } from './monthView'

/** Forecasts go at most this far past the last month. */
const MAX_AHEAD = 24

/**
 * The last month Meses can show as a forecast: the month after the last one
 * created, or further while some installment still has months to go.
 */
export function forecastUntil(finance: Finance): Month | null {
  const last = finance.months.at(-1)?.ref
  if (!last) return null
  const ends = finance.plans.map((plan) =>
    addMonths(plan.firstMonth, plan.totalInstallments - 1),
  )
  const far = [addMonths(last, 1), ...ends].sort().at(-1)!
  const cap = addMonths(last, MAX_AHEAD)
  return far > cap ? cap : far
}

/**
 * Finance as if the months up to `target` had been created, the usual way:
 * the previous month's incomes and bills copied and its leftover carried.
 * Nothing is saved; it is only for looking ahead.
 */
export function forecastFinance(finance: Finance, target: Month): Finance {
  let data = finance
  let previous = finance.months.at(-1)!.ref
  let count = 0
  const newId = () => `previsao-${++count}`
  while (previous < target) {
    const next = addMonths(previous, 1)
    const snapshot = buildNewMonth(
      data,
      next,
      previous,
      { copy: true, carryover: true },
      newId,
    )
    data = ops.createMonth(snapshot).apply(data)
    previous = next
  }
  return data
}
