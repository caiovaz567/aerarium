import { cardFinal } from '../../domain/banks'
import {
  chargedIn,
  bestPurchaseDay,
  dueDate,
  dueText,
  limitUse,
} from '../../domain/cardDates'
import type { ChartPoint } from '../../domain/chartSeries'
import {
  installmentSchedule,
  installmentStatus,
} from '../../domain/installments'
import { invoiceTotals } from '../../domain/invoices'
import { cents, sumMoney, type Cents } from '../../domain/money'
import {
  addMonths,
  dayMonth,
  monthName,
  type ISODate,
  type Month,
} from '../../domain/months'
import type {
  Card,
  ExpenseRow,
  Finance,
  InvoiceRow,
  PlanRow,
} from '../../data/finance'

/** The three numbers on the card page. */
export function cardStats(cardId: string, finance: Finance) {
  const statuses = finance.plans
    .filter((plan) => plan.cardId === cardId)
    .map((plan) => installmentStatus(plan, finance.payments))
  const open = statuses.filter((item) => !item.settled)
  return {
    outstanding: sumMoney(open.map((item) => item.outstanding)),
    lastMonth:
      open
        .map((item) => item.lastMonth)
        .sort()
        .pop() ?? null,
    subscriptions: sumMoney(
      finance.subscriptions
        .filter((item) => item.cardId === cardId && item.active)
        .map((item) => item.amount),
    ),
  }
}

/** "9 out" and "9 de outubro". */
export const shortDate = (date: ISODate) =>
  `${Number(date.slice(8, 10))} ${monthName(date.slice(0, 7) as Month)
    .slice(0, 3)
    .toLowerCase()}`
export const longDate = (date: ISODate) =>
  `${Number(date.slice(8, 10))} de ${monthName(
    date.slice(0, 7) as Month,
  ).toLowerCase()}`

/**
 * Fase 13.2, top of the card page like a bank app: this month's invoice with
 * its due date, the limit (Open Finance), next invoice, best day to buy and
 * what the invoice is made of.
 */
export function cardInvoiceView(
  card: Card,
  finance: Finance,
  current: Month,
  today: ISODate,
) {
  const invoice =
    finance.invoices.find(
      (item) => item.cardId === card.id && item.month === current,
    ) ?? null
  const totals = invoice ? invoiceTotals(invoice, finance) : null
  const account = finance.bankAccounts.find((item) => item.cardId === card.id)
  const next = finance.dueNextMonth ?? false
  const due = card.dueDay ? dueDate(current, card.dueDay, next) : null
  const limit =
    account?.creditLimit != null && account.availableLimit != null
      ? {
          total: account.creditLimit,
          available: account.availableLimit,
          ...limitUse(account.creditLimit, account.availableLimit),
        }
      : null
  return {
    invoice,
    bankTotal: invoice?.bankTotal ?? null,
    otherShare: totals?.otherShare ?? cents(0),
    final: cardFinal(account?.number),
    status: !invoice ? 'none' : invoice.paid ? 'paid' : 'open',
    total: totals?.total ?? cents(0),
    due,
    dueText: due && invoice && !invoice.paid ? dueText(due, today) : null,
    nextDue: card.dueDay
      ? dueDate(addMonths(current, 1), card.dueDay, next)
      : null,
    bestDay: card.closingDay ? bestPurchaseDay(card.closingDay) : null,
    limit,
    parts: totals
      ? [
          { label: 'Compras', amount: totals.expensesAmount },
          { label: 'Parcelamentos', amount: totals.installmentsAmount },
          { label: 'Assinaturas', amount: totals.subscriptionsAmount },
          { label: 'Outros', amount: totals.otherAmount },
        ].filter((item) => item.amount > 0)
      : [],
  } as const
}

/** "em aberto", "paga", "estimada", "previsão", "sem fatura", "nada previsto". */
export function pointStatus(point: ChartPoint, current: Month) {
  if (point.kind === 'empty')
    return {
      text: point.month > current ? 'nada previsto' : 'sem fatura',
      tone: '',
    }
  if (point.kind === 'forecast')
    return {
      text: point.invoiceId ? 'estimada' : 'previsão',
      tone: 'forecast',
    }
  return point.paid
    ? { text: 'paga', tone: 'ok' }
    : { text: 'em aberto', tone: '' }
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "ter, 29/09". */
export const dayLabel = (day: ISODate) =>
  `${WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()]}, ${dayMonth(day)}`

/**
 * The purchases in a card's invoice for the month, newest first, one group per
 * day. Without a time, a purchase goes after the ones of its day that have one.
 */
export function purchaseDays(cardId: string, target: Month, finance: Finance) {
  const invoice = finance.invoices.find(
    (item) => item.cardId === cardId && item.month === target,
  )
  if (!invoice) return []
  const newest = (a: ExpenseRow, b: ExpenseRow) =>
    b.spentOn.localeCompare(a.spentOn) ||
    (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '') ||
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  const days: { day: ISODate; items: ExpenseRow[] }[] = []
  for (const expense of finance.expenses
    .filter((item) => item.invoiceId === invoice.id)
    .sort(newest)) {
    const last = days[days.length - 1]
    if (last?.day === expense.spentOn) last.items.push(expense)
    else days.push({ day: expense.spentOn, items: [expense] })
  }
  return days
}

export interface PlanLine {
  readonly plan: PlanRow
  readonly number: number
  readonly totalInstallments: number
  readonly amount: Cents
  readonly paid: boolean
  readonly paidOn: ISODate | null
  readonly paidWithInvoice: boolean
  readonly remaining: number
  readonly outstanding: Cents
}

/** A plan as seen in one month (its installment there, if any). */
export function planLine(
  plan: PlanRow,
  target: Month,
  finance: Finance,
): PlanLine | null {
  const item = installmentSchedule(plan, finance.payments).find(
    (entry) => entry.month === target,
  )
  if (!item) return null
  const status = installmentStatus(plan, finance.payments)
  return {
    plan,
    number: item.number,
    totalInstallments: item.totalInstallments,
    amount: item.amount,
    paid: item.paid,
    paidOn: item.paidOn,
    paidWithInvoice: item.source === 'invoice',
    remaining: status.remaining,
    outstanding: status.outstanding,
  }
}

export interface CardBlock {
  readonly card: Card
  readonly invoice: InvoiceRow | null
  readonly total: Cents
  readonly installments: Cents
  readonly subscriptions: Cents
  /** Total minus installments and subscriptions; negative means the invoice is short. */
  readonly other: Cents
  readonly plans: readonly PlanLine[]
  readonly subscriptionNames: readonly string[]
}

/** Aba Cartões for one month. */
export function cardsView(finance: Finance, target: Month) {
  const blocks: CardBlock[] = finance.cards.map((card) => {
    const invoice =
      finance.invoices.find(
        (item) => item.cardId === card.id && item.month === target,
      ) ?? null
    const totals = invoice ? invoiceTotals(invoice, finance) : null
    const plans = finance.plans
      .filter((plan) => plan.cardId === card.id)
      .flatMap((plan) => planLine(plan, target, finance) ?? [])
    const subscriptions = finance.subscriptions.filter(
      (item) => item.cardId === card.id && chargedIn(item, target),
    )
    const total = totals?.total ?? cents(0)
    const installments = sumMoney(plans.map((item) => item.amount))
    const subscriptionTotal = sumMoney(subscriptions.map((item) => item.amount))
    return {
      card,
      invoice,
      total,
      installments,
      subscriptions: subscriptionTotal,
      other: cents(total - installments - subscriptionTotal),
      plans,
      subscriptionNames: subscriptions.map((item) => item.name),
    }
  })
  const withInvoice = blocks.filter((block) => block.invoice)
  const loose = finance.plans
    .filter((plan) => plan.cardId === null)
    .flatMap((plan) => planLine(plan, target, finance) ?? [])
  const statuses = finance.plans.map((plan) => ({
    plan,
    status: installmentStatus(plan, finance.payments),
  }))
  return {
    blocks,
    loose,
    totals: {
      total: sumMoney(withInvoice.map((block) => block.total)),
      installments: sumMoney(withInvoice.map((block) => block.installments)),
      subscriptions: sumMoney(withInvoice.map((block) => block.subscriptions)),
      other: sumMoney(withInvoice.map((block) => block.other)),
    },
    outstanding: sumMoney(statuses.map((item) => item.status.outstanding)),
    archived: statuses
      .filter((item) => item.status.settled)
      .map(({ plan, status }) => ({
        plan,
        settledOn: status.settledOn,
        paidCount: status.paidCount,
        card: finance.cards.find((card) => card.id === plan.cardId) ?? null,
      })),
  }
}
