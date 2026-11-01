import { currentMonth } from '../../app/paths'
import { monthBalance } from '../../domain/balance'
import {
  installmentSchedule,
  installmentStatus,
} from '../../domain/installments'
import { invoiceTotals, isEstimate } from '../../domain/invoices'
import { cents, sumMoney, type Cents } from '../../domain/money'
import {
  groupByCategory,
  monthOutflowItems,
  type CategoryGroup,
} from '../../domain/categories'
import { addMonths, type Month } from '../../domain/months'
import { newMonthDraft } from '../../domain/newMonth'
import type { MonthSnapshot } from '../../data/financeOps'
import type {
  BillRow,
  Card,
  Finance,
  IncomeRow,
  InvoiceRow,
  PlanRow,
} from '../../data/finance'

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** The note only shows when it says more than the card's default name. */
export function visibleNote(note: string | null, card: Card): string | null {
  const text = plain(note ?? '')
  if (
    !text ||
    text === plain(card.name) ||
    text === plain(`fatura ${card.name}`)
  )
    return null
  return note!.trim()
}

export interface CardOutflow {
  readonly invoice: InvoiceRow
  readonly card: Card
  readonly total: Cents
  readonly note: string | null
  /** The other person's part of it (0 without someone else). */
  readonly other: Cents
  /** The owner's part by category, biggest first, to open on the row. */
  readonly breakdown: readonly CategoryGroup[]
  /** Still a guess: only before its month starts, while unpaid. */
  readonly estimated: boolean
}
export interface LooseOutflow {
  readonly plan: PlanRow
  readonly number: number
  readonly totalInstallments: number
  readonly remaining: number
  readonly amount: Cents
  readonly paid: boolean
}
export interface CarryHint {
  readonly previous: Month
  readonly available: Cents
  readonly income: IncomeRow
}

export function monthView(finance: Finance, ref: Month) {
  const balance = monthBalance(ref, finance)
  // What the other person sends back is shown in the reminder, not here.
  const incomes = finance.incomes.filter(
    (item) => item.month === ref && item.kind !== 'from_other',
  )
  const items = monthOutflowItems(ref, finance)
  const cards: CardOutflow[] = finance.invoices
    .filter((item) => item.month === ref)
    .flatMap((invoice) => {
      const card = finance.cards.find((item) => item.id === invoice.cardId)
      if (!card) return []
      const totals = invoiceTotals(invoice, finance)
      return [
        {
          invoice,
          card,
          total: totals.mine,
          note: visibleNote(invoice.note, card),
          other: finance.otherPerson ? totals.otherShare : cents(0),
          breakdown: groupByCategory(
            items.filter((item) => item.cardId === card.id),
          ),
          estimated: isEstimate(invoice, currentMonth()),
        },
      ]
    })
    .sort(
      (a, b) =>
        a.card.sortOrder - b.card.sortOrder ||
        a.card.name.localeCompare(b.card.name),
    )
  const loose: LooseOutflow[] = finance.plans
    .filter((plan) => plan.cardId === null && !plan.forOther)
    .flatMap((plan) => {
      const item = installmentSchedule(plan, finance.payments).find(
        (entry) => entry.month === ref,
      )
      if (!item) return []
      return [
        {
          plan,
          number: item.number,
          totalInstallments: item.totalInstallments,
          remaining: installmentStatus(plan, finance.payments).remaining,
          amount: item.amount,
          paid: item.paid,
        },
      ]
    })
    .sort((a, b) => a.plan.description.localeCompare(b.plan.description))
  const bills: BillRow[] = finance.bills.filter((item) => item.month === ref)

  const flags = [
    ...cards.map((item) => item.invoice.paid),
    ...loose.map((item) => item.paid),
    ...bills.map((item) => item.paid),
  ]
  const previous = addMonths(ref, -1)
  const carryIncome = incomes.find((item) => item.kind === 'carryover')
  const previousAvailable = finance.months.some((item) => item.ref === previous)
    ? monthBalance(previous, finance).available
    : null
  const carryHint: CarryHint | null =
    carryIncome &&
    previousAvailable !== null &&
    previousAvailable !== carryIncome.amount
      ? { previous, available: previousAvailable, income: carryIncome }
      : null

  return {
    balance,
    incomes,
    cards,
    loose,
    bills,
    paidCount: flags.filter(Boolean).length,
    outflowCount: flags.length,
    subtotals: {
      cards: sumMoney(cards.map((item) => item.total)),
      loose: sumMoney(loose.map((item) => item.amount)),
      bills: sumMoney(bills.map((item) => item.amount)),
    },
    carryHint,
  }
}

/** Percentage for the bar and caption; null when nothing came in. */
export function committedPercent(ratio: number | null): number | null {
  return ratio === null ? null : Math.round(ratio * 100)
}

/** Which month to open for /meses: today's, else the closest before, else the first. */
export function defaultMonth(finance: Finance, today: Month): Month | null {
  const refs = finance.months.map((item) => item.ref)
  if (refs.includes(today)) return today
  const before = refs.filter((ref) => ref < today)
  return before[before.length - 1] ?? refs[0] ?? null
}

/**
 * The months that are over go to "Arquivados": once today's month (or a later
 * one) exists, navigation starts at it and the months before it are archived.
 * With nothing from today on, none is.
 */
export function archiveSplit(refs: readonly Month[], today: Month) {
  const started = refs.some((ref) => ref >= today)
  return {
    active: started ? refs.filter((ref) => ref >= today) : [...refs],
    archived: started ? refs.filter((ref) => ref < today) : [],
  }
}

/** Rows for a new month, with fresh ids, ready to insert. */
export function buildNewMonth(
  finance: Finance,
  target: Month,
  previous: Month | null,
  options: { copy: boolean; carryover: boolean },
  newId: () => string = () => crypto.randomUUID(),
): MonthSnapshot {
  const draft = newMonthDraft(
    {
      target,
      previous,
      cardIds: finance.cards.map((card) => card.id),
      ...options,
    },
    finance,
  )
  const monthId = newId()
  return {
    entry: { id: monthId, ref: target },
    incomes: draft.incomes.map((item) => ({ ...item, id: newId(), monthId })),
    bills: draft.bills.map((item) => ({ ...item, id: newId(), monthId })),
    invoices: draft.invoices.map((item) => ({ ...item, id: newId(), monthId })),
    expenses: [],
  }
}
