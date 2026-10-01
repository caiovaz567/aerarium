import type {
  ExpenseRow,
  Finance,
  IncomeRow,
  InvoiceRow,
  PlanRow,
} from '../../data/finance'
import type { SharedView } from '../../data/shared'
import { monthOutflowItems } from '../../domain/categories'
import { installmentSchedule } from '../../domain/installments'
import { cents, sumMoney, type Cents } from '../../domain/money'
import { isoDate, type Month } from '../../domain/months'

const monthId = (ref: Month) => `mes:${ref}`
const invoiceId = (cardId: string, ref: Month) => `fatura:${cardId}:${ref}`

/**
 * What the owner shares, as a Finance seen as the other person's (viewAs
 * 'other'), so Meses' views (Por tipo, Por data, Por categoria) show it as
 * they are. Only their purchases, installments and bank rests are in it.
 */
export function sharedFinance(view: SharedView, today?: Month): Finance {
  const plans: PlanRow[] = view.plans.map((plan) => ({
    ...plan,
    note: null,
    forOther: true,
  }))
  const schedule = plans.flatMap((plan) =>
    installmentSchedule(plan, []).map((item) => ({ plan, item })),
  )
  const refs = [
    ...new Set<Month>([
      ...view.expenses.map((item) => item.month),
      ...view.rests.map((item) => item.month),
      ...view.paidBack.map((item) => item.month),
      ...schedule.map(({ item }) => item.month),
    ]),
  ]
  // Today's month is always there once anything is, even with nothing yet.
  if (today && refs.length && !refs.includes(today)) refs.push(today)
  refs.sort()
  const pairs = new Map<string, { cardId: string; month: Month }>()
  for (const { cardId, month } of [
    ...view.expenses,
    ...view.rests,
    ...schedule.flatMap(({ plan, item }) =>
      plan.cardId ? [{ cardId: plan.cardId, month: item.month }] : [],
    ),
  ])
    pairs.set(invoiceId(cardId, month), { cardId, month })
  const invoices: InvoiceRow[] = [...pairs].map(([id, { cardId, month }]) => ({
    id,
    cardId,
    monthId: monthId(month),
    month,
    otherAmount: cents(0),
    estimated: false,
    note: null,
    paid: false,
    paidOn: null,
    closedTotal: null,
  }))
  const expenses: ExpenseRow[] = [
    ...view.expenses.map((item) => ({
      id: item.id,
      invoiceId: invoiceId(item.cardId, item.month),
      description: item.description,
      note: item.note,
      amount: item.amount,
      spentOn: item.spentOn,
      occurredAt: item.occurredAt,
      categoryId: item.categoryId,
      forOther: true,
    })),
    // The part of an old bank invoice that is theirs but not itemized.
    ...view.rests.map((item) => ({
      id: `resto:${item.cardId}:${item.month}`,
      invoiceId: invoiceId(item.cardId, item.month),
      description: 'Resto da fatura no banco',
      note: null,
      amount: item.amount,
      spentOn: isoDate(`${item.month}-01`),
      occurredAt: null,
      categoryId: null,
      forOther: true,
    })),
  ]
  const incomes: IncomeRow[] = view.paidBack.map((item, index) => ({
    id: `pagou:${index}`,
    monthId: monthId(item.month),
    month: item.month,
    description: 'Pagou',
    amount: item.amount,
    kind: 'from_other',
    sortOrder: index,
  }))
  return {
    cards: view.cards.map((card) => ({
      id: card.id,
      name: card.name,
      color: card.color,
      closingDay: null,
      bank: card.bank,
      sortOrder: card.sortOrder,
    })),
    categories: view.categories,
    months: refs.map((ref) => ({ id: monthId(ref), ref })),
    incomes,
    bills: [],
    invoices,
    expenses,
    plans,
    payments: [],
    subscriptions: [],
    bankAccounts: [],
    bankRecords: [],
    otherPerson: view.ownerName,
    viewAs: 'other',
  }
}

/** A month from the other person's side: what is theirs, card by card, and what is left to pay. */
export function sharedMonth(view: SharedView, finance: Finance, ref: Month) {
  const items = monthOutflowItems(ref, finance)
  const owed = sumMoney(items.map((item) => item.amount))
  const paid = sumMoney(
    view.paidBack
      .filter((item) => item.month === ref)
      .map((item) => item.amount),
  )
  const cards = view.cards.flatMap((card) => {
    const amount = sumMoney(
      items.filter((item) => item.cardId === card.id).map((i) => i.amount),
    )
    return amount > 0 ? [{ card, amount }] : []
  })
  const outside: Cents = sumMoney(
    items.filter((item) => item.cardId === null).map((item) => item.amount),
  )
  return {
    owed,
    paid,
    due: cents(Math.max(0, owed - paid)),
    cards,
    outside,
  }
}

/**
 * The month to open: the oldest one up to today with something still to pay
 * back; with everything paid, today's (the month turned, so it shows the new
 * one); else the closest before, else the first.
 */
export function sharedDefaultMonth(
  view: SharedView,
  finance: Finance,
  today: Month,
): Month | null {
  const refs = finance.months.map((item) => item.ref)
  const owing = refs.find(
    (ref) => ref <= today && sharedMonth(view, finance, ref).due > 0,
  )
  if (owing) return owing
  if (refs.includes(today)) return today
  const before = refs.filter((ref) => ref < today)
  return before.at(-1) ?? refs[0] ?? null
}
