import type { Finance, IncomeRow } from '../../data/finance'
import type { Cents } from '../../domain/money'
import type { Month } from '../../domain/months'

/** "Pai pagou": what is due, as an income that only settles their part. */
export function paidIncome(
  finance: Finance,
  month: Month,
  due: Cents,
): IncomeRow {
  return {
    id: crypto.randomUUID(),
    monthId: finance.months.find((item) => item.ref === month)!.id,
    month,
    description: `${finance.otherPerson} pagou`,
    amount: due,
    kind: 'from_other',
    sortOrder:
      Math.max(
        0,
        ...finance.incomes
          .filter((item) => item.month === month)
          .map((item) => item.sortOrder),
      ) + 1,
  }
}

/** What the other person sent back this month (to undo "Pai pagou"). */
export const paidBack = (finance: Finance, month: Month) =>
  finance.incomes.filter(
    (item) => item.month === month && item.kind === 'from_other',
  )
