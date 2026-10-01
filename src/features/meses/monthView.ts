import { chargedIn } from '../../domain/cardDates'
import { monthBalance } from '../../domain/balance'
import {
  installmentSchedule,
  installmentStatus,
} from '../../domain/installments'
import { invoiceTotals } from '../../domain/invoices'
import { formatMoneyShort, sumMoney, type Cents } from '../../domain/money'
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

/** The note only shows when it says more than the card's default name (7.4 item 10). */
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

/** "3 parcelas R$ 876", "Netflix R$ 40", "outros R$ 271": short, whole reais. */
export function compositionParts(
  invoice: InvoiceRow,
  finance: Finance,
): string[] {
  // Fase 13.3: the owner's parts; the other person's show as one piece.
  const installments = finance.plans
    .filter((plan) => plan.cardId === invoice.cardId && !plan.forOther)
    .flatMap((plan) =>
      installmentSchedule(plan, finance.payments)
        .filter((item) => item.month === invoice.month)
        .map((item) => ({ name: plan.description, amount: item.amount })),
    )
  const subscriptions = finance.subscriptions.filter(
    (item) => item.cardId === invoice.cardId && chargedIn(item, invoice.month),
  )
  const expenses = finance.expenses.filter(
    (item) => item.invoiceId === invoice.id && !item.forOther,
  )
  const otherShare = invoiceTotals(invoice, finance).otherShare
  const group = (
    items: readonly { name: string; amount: Cents }[],
    many: (count: number) => string,
  ) => {
    if (!items.length) return []
    const total = formatMoneyShort(sumMoney(items.map((item) => item.amount)))
    return [
      `${items.length === 1 ? items[0]!.name : many(items.length)} ${total}`,
    ]
  }
  return [
    ...group(installments, (count) => `${count} parcelas`),
    ...group(
      subscriptions.map((item) => ({ name: item.name, amount: item.amount })),
      () => 'assinaturas',
    ),
    ...group(
      expenses.map((item) => ({ name: item.description, amount: item.amount })),
      (count) => `${count} gastos`,
    ),
    ...(!invoice.estimated && invoice.otherAmount > 0
      ? [`outros ${formatMoneyShort(invoice.otherAmount)}`]
      : []),
    ...(otherShare > 0 && finance.otherPerson
      ? [`${finance.otherPerson} ${formatMoneyShort(otherShare)}`]
      : []),
  ]
}

export interface CardOutflow {
  readonly invoice: InvoiceRow
  readonly card: Card
  readonly total: Cents
  readonly note: string | null
  readonly parts: readonly string[]
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
  const cards: CardOutflow[] = finance.invoices
    .filter((item) => item.month === ref)
    .flatMap((invoice) => {
      const card = finance.cards.find((item) => item.id === invoice.cardId)
      if (!card) return []
      return [
        {
          invoice,
          card,
          // Fase 13.3: the owner's part; the other person's is in the parts.
          total: invoiceTotals(invoice, finance).mine,
          note: visibleNote(invoice.note, card),
          parts: compositionParts(invoice, finance),
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
 * The months that are over go to "Arquivados" (owner's choice, 01/10/2026):
 * once today's month (or a later one) exists, navigation starts at it and the
 * months before it are archived. With nothing from today on, none is.
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
