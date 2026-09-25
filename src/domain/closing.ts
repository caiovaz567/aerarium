import {
  addMonths,
  daysInMonth,
  isoDate,
  month,
  monthOf,
  type ISODate,
  type Month,
} from './months'

export function invoiceMonthForExpense(
  spentOn: ISODate,
  closingDay: number | null,
  selectedMonth?: Month,
): Month {
  isoDate(spentOn)
  if (
    closingDay !== null &&
    (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31)
  )
    throw new RangeError('O fechamento deve ser entre os dias 1 e 31.')
  if (selectedMonth !== undefined) return month(selectedMonth)
  const current = monthOf(spentOn)
  const day = Number(spentOn.slice(8))
  return closingDay !== null && day > Math.min(closingDay, daysInMonth(current))
    ? addMonths(current, 1)
    : current
}
