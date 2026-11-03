import { currentMonth } from '../../app/paths'
import { monthBalance, personBalance } from '../../domain/balance'
import {
  installmentSchedule,
  installmentStatus,
} from '../../domain/installments'
import { invoiceTotals, isEstimate, peopleParts } from '../../domain/invoices'
import { isOwners } from '../../domain/people'
import { cents, sumMoney, type Cents } from '../../domain/money'
import { monthOutflowItems, type OutflowItem } from '../../domain/categories'
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

/** One thing an invoice holds: an installment, a subscription, a purchase. */
export interface InvoiceLine {
  readonly key: string
  readonly name: string
  /** "Parcela 3 de 10", "Assinatura", "29/09" or the rest's explanation. */
  readonly detail: string
  readonly categoryId: string | null
  readonly amount: Cents
  /** The invoice's rest, typed without detail. */
  readonly rest: boolean
}

const LINE_ORDER = ['installment', 'subscription', 'expense', 'other']

/** An invoice's pieces as rows: installments, subscriptions, purchases (newest first), the rest. */
function invoiceLines(
  finance: Finance,
  items: readonly OutflowItem[],
): InvoiceLine[] {
  const day = (id: string) =>
    finance.expenses.find((item) => item.id === id)?.spentOn ?? ''
  return [...items]
    .sort(
      (a, b) =>
        LINE_ORDER.indexOf(a.source) - LINE_ORDER.indexOf(b.source) ||
        (a.source === 'expense' ? day(b.id).localeCompare(day(a.id)) : 0),
    )
    .map((item): InvoiceLine => {
      const base = {
        key: `${item.source}:${item.id}`,
        categoryId: item.categoryId,
        amount: item.amount,
        rest: false,
      }
      if (item.source === 'installment') {
        const plan = finance.plans.find((row) => row.id === item.id)
        return {
          ...base,
          name: plan?.description ?? 'Parcela',
          detail: `Parcela ${item.number} de ${plan?.totalInstallments ?? '?'}`,
        }
      }
      if (item.source === 'subscription')
        return {
          ...base,
          name:
            finance.subscriptions.find((row) => row.id === item.id)?.name ??
            'Assinatura',
          detail: 'Assinatura',
        }
      if (item.source === 'expense') {
        const expense = finance.expenses.find((row) => row.id === item.id)
        const spent = expense?.spentOn ?? ''
        return {
          ...base,
          name: expense?.description ?? 'Gasto',
          detail: spent ? `${spent.slice(8, 10)}/${spent.slice(5, 7)}` : '',
        }
      }
      return {
        ...base,
        name: 'Outros gastos',
        detail: 'O resto da fatura, sem detalhe',
        rest: true,
      }
    })
}

/** Each person's part of an invoice, with their name. */
export function namedParts(invoice: InvoiceRow, finance: Finance) {
  return peopleParts(invoice, finance).map((part) => ({
    personId: part.personId,
    name:
      finance.people?.find((item) => item.id === part.personId)?.name ??
      'Outra pessoa',
    amount: part.amount,
  }))
}

export interface CardOutflow {
  readonly invoice: InvoiceRow
  readonly card: Card
  readonly total: Cents
  readonly note: string | null
  /** The other person's part of it (0 without someone else). */
  readonly other: Cents
  /** What each person in the list has in it. */
  readonly people: readonly { readonly name: string; readonly amount: Cents }[]
  /** The owner's part, item by item, to open on the row. */
  readonly lines: readonly InvoiceLine[]
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
          people: namedParts(invoice, finance),
          lines: invoiceLines(
            finance,
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
    .filter((plan) => plan.cardId === null && isOwners(plan))
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

/** Everything paid, and the other person's part of it paid back. */
export function monthDone(finance: Finance, ref: Month): boolean {
  const view = monthView(finance, ref)
  return (
    view.outflowCount > 0 &&
    view.paidCount === view.outflowCount &&
    view.balance.otherDue <= 0 &&
    (finance.people ?? []).every(
      (person) => personBalance(ref, finance, person.id).due <= 0,
    )
  )
}

/**
 * Where the open months start: today's, or later when a month was finished
 * early ("Finalizar": all done and the next one created). Months before it
 * are archived.
 */
export function openFrom(finance: Finance, today: Month): Month {
  const refs = finance.months.map((item) => item.ref)
  let from = today
  while (
    refs.includes(from) &&
    refs.includes(addMonths(from, 1)) &&
    monthDone(finance, from)
  )
    from = addMonths(from, 1)
  return from
}

/** Which month to open for /meses: the first open one, else the closest before, else the first. */
export function defaultMonth(finance: Finance, today: Month): Month | null {
  const refs = finance.months.map((item) => item.ref)
  const from = openFrom(finance, today)
  if (refs.includes(from)) return from
  const before = refs.filter((ref) => ref < from)
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
