import type { Finance } from '../../data/finance'
import { ops, type FinanceOp, type MonthSnapshot } from '../../data/financeOps'
import { addMonths, type Month } from '../../domain/months'
import { buildNewMonth } from './monthView'

/** Forecasts go at most this far past the last month. */
const MAX_AHEAD = 24
/** A launch can open a month this far past the last one. */
const LAUNCH_AHEAD = 12

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
 * The last month a launch can go into: as far as the forecasts go, and at
 * least a year past the last month, even with nothing in it yet.
 */
export function launchUntil(finance: Finance): Month | null {
  const last = finance.months.at(-1)?.ref
  if (!last) return null
  const until = forecastUntil(finance)!
  const year = addMonths(last, LAUNCH_AHEAD)
  return until > year ? until : year
}

/**
 * Every month after the last one up to `target`, each made from the one
 * before it the usual way: its incomes and bills copied and its leftover
 * carried. Nothing is saved.
 */
export function monthsUntil(
  finance: Finance,
  target: Month,
  newId: () => string = () => crypto.randomUUID(),
): MonthSnapshot[] {
  const list: MonthSnapshot[] = []
  let previous = finance.months.at(-1)?.ref
  let data = finance
  while (previous && previous < target) {
    const next = addMonths(previous, 1)
    const snapshot = buildNewMonth(
      data,
      next,
      previous,
      { copy: true, carryover: true },
      newId,
    )
    list.push(snapshot)
    data = ops.createMonth(snapshot).apply(data)
    previous = next
  }
  return list
}

/** Creates the months in order; undoing removes them, the last first. */
export function createMonths(list: readonly MonthSnapshot[]) {
  const all = (steps: readonly FinanceOp[]): FinanceOp => ({
    run: async () => {
      for (const step of steps) await step.run()
    },
    apply: (finance) => steps.reduce((data, step) => step.apply(data), finance),
  })
  return {
    op: all(list.map((item) => ops.createMonth(item))),
    undo: all([...list].reverse().map((item) => ops.removeMonth(item))),
  }
}

/**
 * Finance as if the months up to `target` had been created, the usual way.
 * Nothing is saved; it is only for looking ahead.
 */
export function forecastFinance(finance: Finance, target: Month): Finance {
  let count = 0
  return createMonths(
    monthsUntil(finance, target, () => `previsao-${++count}`),
  ).op.apply(finance)
}
