import { monthBalance } from './balance'
import { cents } from './money'
import { addMonths, month, type Month } from './months'
import type { Bill, FinancialData, Income, Invoice } from './types'

/** Only the first counter advances, matching v1; 12/12 stays 12/12. */
export function advanceCounter(text: string): string {
  return text.replace(
    /\b(\d{1,3})\/(\d{1,3})\b/,
    (original, current: string, total: string) =>
      Number(current) >= 1 &&
      Number(current) < Number(total) &&
      Number(total) <= 120
        ? `${Number(current) + 1}/${total}`
        : original,
  )
}

export interface NewMonthOptions {
  readonly target: Month
  readonly previous: Month | null
  readonly cardIds: readonly string[]
  readonly copy: boolean
  readonly carryover: boolean
}

/** Drafts have no IDs. The data layer creates fresh IDs and persists atomically. */
export function newMonthDraft(options: NewMonthOptions, data: FinancialData) {
  const { target, previous, cardIds, copy, carryover } = options
  month(target)
  if (previous !== null && addMonths(previous, 1) !== target)
    throw new RangeError('Copie somente o mês imediatamente anterior.')
  if (new Set(cardIds).size !== cardIds.length)
    throw new RangeError('Cartão duplicado.')
  const incomes: Income[] =
    copy && previous
      ? data.incomes
          .filter((item) => item.month === previous && item.kind === 'normal')
          .map((item) => ({
            month: target,
            description: advanceCounter(item.description),
            amount: item.amount,
            kind: item.kind,
            sortOrder: item.sortOrder,
          }))
      : []
  if (carryover && previous)
    incomes.push({
      month: target,
      description: 'Sobrou do mês passado',
      amount: monthBalance(previous, data).available,
      kind: 'carryover',
      sortOrder: Math.max(-1, ...incomes.map((item) => item.sortOrder)) + 1,
    })
  const bills: Bill[] =
    copy && previous
      ? data.bills
          .filter((item) => item.month === previous)
          .map((item) => ({
            month: target,
            description: advanceCounter(item.description),
            amount: item.amount,
            sortOrder: item.sortOrder,
            paid: false,
            paidOn: null,
            categoryId: item.categoryId ?? null,
          }))
      : []
  const invoices: Omit<Invoice, 'id'>[] = cardIds.map((cardId) => {
    const old =
      copy && previous
        ? data.invoices.find(
            (item) => item.month === previous && item.cardId === cardId,
          )
        : undefined
    return {
      cardId,
      month: target,
      otherAmount: cents(0),
      estimated: true,
      paid: false,
      paidOn: null,
      closedTotal: null,
      note: old?.note ? advanceCounter(old.note) : null,
    }
  })
  return { month: target, incomes, bills, invoices }
}
