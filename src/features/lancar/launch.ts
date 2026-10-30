import type {
  Card,
  ExpenseRow,
  Finance,
  InvoiceRow,
  PlanRow,
} from '../../data/finance'
import { ops, type FinanceOp, type MonthSnapshot } from '../../data/financeOps'
import { invoiceMonthForCard } from '../../domain/cardDates'
import { splitInstallments } from '../../domain/installments'
import { cents, formatMoney, sumMoney, type Cents } from '../../domain/money'
import {
  addMonths,
  dateInSaoPaulo,
  monthName,
  monthOf,
  type ISODate,
  type Month,
} from '../../domain/months'
import { buildNewMonth } from '../meses/monthView'

export type LaunchKind = 'gasto' | 'parcelado' | 'entrada'
/** A card id, or NO_CARD for Pix, boleto ou dinheiro. */
export const NO_CARD = 'none'

/**
 * Cards a purchase can be typed on: the ones whose purchases come from the bank
 * (Open Finance) stay out, so nothing is typed and then brought by the bank
 * again; with only the bank's totals, all of them. The card with the most
 * purchases typed by hand comes first: Lançar opens on it.
 */
export function launchCards(finance: Finance): readonly Card[] {
  const fed = new Set(
    finance.bankPurchases === false
      ? []
      : finance.bankAccounts.map((item) => item.cardId),
  )
  const cardOf = new Map(finance.invoices.map((item) => [item.id, item.cardId]))
  const typed = new Map<string, number>()
  for (const expense of finance.expenses) {
    const cardId = cardOf.get(expense.invoiceId)
    if (cardId && !expense.externalId)
      typed.set(cardId, (typed.get(cardId) ?? 0) + 1)
  }
  return finance.cards
    .filter((card) => !fed.has(card.id))
    .sort((a, b) => (typed.get(b.id) ?? 0) - (typed.get(a.id) ?? 0))
}

/** Months Lançar can put something in: the existing ones and the next one. */
export function launchMonths(finance: Finance): Month[] {
  const refs = finance.months.map((item) => item.ref)
  const last = refs[refs.length - 1]
  return last ? [...refs, addMonths(last, 1)] : []
}

/**
 * "Entra em": the month open in Meses, otherwise this month; when
 * that is this month, a card's closing day can move the expense to the next.
 */
export function suggestMonth(
  finance: Finance,
  options: {
    readonly openMonth: Month | null
    readonly card: Card | null
    readonly today: ISODate
  },
): Month | null {
  const allowed = launchMonths(finance)
  if (!allowed.length) return null
  const current = monthOf(options.today)
  let target = options.openMonth ?? current
  if (target === current && options.card?.closingDay)
    target = invoiceMonthForCard(
      options.today,
      options.card,
      finance.dueNextMonth ?? false,
    )
  if (allowed.includes(target)) return target
  // Outside what exists: the closest end.
  return target < allowed[0]! ? allowed[0]! : allowed[allowed.length - 1]!
}

/**
 * "10x de R$ 120,00, começando este mês" (or "começando em outubro"); the last
 * one absorbs the rounding.
 */
export function installmentPreview(
  total: Cents | null,
  count: number,
  start: Month,
  current: Month,
) {
  if (!total || !Number.isInteger(count) || count < 2 || count > 120) return ''
  try {
    const { installmentAmount, finalAdjustment } = splitInstallments(
      total,
      count,
    )
    const last = finalAdjustment
      ? ` (a última de ${formatMoney(sumMoney([installmentAmount, finalAdjustment]))})`
      : ''
    const when =
      start === current
        ? 'este mês'
        : `em ${monthName(start).toLowerCase()}${start.slice(0, 4) === current.slice(0, 4) ? '' : ` de ${start.slice(0, 4)}`}`
    return `${count}x de ${formatMoney(installmentAmount)}${last}, começando ${when}`
  } catch {
    return ''
  }
}

export interface LaunchInput {
  readonly kind: LaunchKind
  readonly amount: Cents
  readonly installments: number
  readonly description: string
  readonly where: string
  readonly paid: boolean
  readonly month: Month
  readonly today: ISODate
  /** Spending category (not for Entrada). */
  readonly categoryId?: string | null
  /** When it happened (ISO instant); its day wins over `today`. */
  readonly occurredAt?: string | null
  /** Owner only: a card purchase or a plan of the other person. */
  readonly forOther?: boolean
  /** A Pix, boleto or cash bill: the bank it came from, or 'cash'. */
  readonly paidFrom?: string | null
}

export interface Launch {
  readonly op: FinanceOp
  readonly undo: FinanceOp
  readonly message: string
}

const DEFAULT_TEXT: Record<LaunchKind, string> = {
  gasto: 'Gasto',
  parcelado: 'Compra parcelada',
  entrada: 'Entrada',
}

/** What one launch writes, how to undo it, and the toast text. */
export function buildLaunch(
  finance: Finance,
  input: LaunchInput,
  newId: () => string = () => crypto.randomUUID(),
): Launch {
  const description = input.description.trim() || DEFAULT_TEXT[input.kind]
  const occurredAt = input.occurredAt ?? null
  const day = occurredAt ? dateInSaoPaulo(new Date(occurredAt)) : input.today
  const card = finance.cards.find((item) => item.id === input.where) ?? null

  if (input.kind === 'parcelado') {
    const split = splitInstallments(input.amount, input.installments)
    const plan: PlanRow = {
      id: newId(),
      cardId: card?.id ?? null,
      description,
      installmentAmount: split.installmentAmount,
      finalAdjustment: split.finalAdjustment,
      totalInstallments: input.installments,
      // The person picks the first month (decision after phase 7).
      firstMonth: input.month,
      note: null,
      categoryId: input.categoryId ?? null,
      ...(input.forOther && { forOther: true }),
    }
    return {
      op: ops.restorePlan(plan, []),
      undo: ops.removePlan(plan),
      message: `${input.installments}x de ${formatMoney(split.installmentAmount)}${card ? ` no ${card.name}` : ''}`,
    }
  }

  // The month may be the next one, not created yet: create it the usual way
  // (copying the previous month and its leftover) with the new item inside.
  let created: MonthSnapshot | null = null
  let monthEntry = finance.months.find((item) => item.ref === input.month)
  if (!monthEntry) {
    const refs = finance.months.map((item) => item.ref)
    const last = refs[refs.length - 1]
    if (!last || addMonths(last, 1) !== input.month)
      throw new RangeError('Esse mês não pode receber lançamentos.')
    created = buildNewMonth(
      finance,
      input.month,
      last,
      { copy: true, carryover: true },
      newId,
    )
    monthEntry = created.entry
  }
  const monthId = monthEntry.id
  const where = monthName(input.month)
  const inMonth = <T extends { monthId: string; sortOrder: number }>(
    rows: readonly T[],
  ) =>
    Math.max(
      -1,
      ...rows
        .filter((row) => row.monthId === monthId)
        .map((row) => row.sortOrder),
    ) + 1
  const finish = (
    add: (snapshot: MonthSnapshot) => MonthSnapshot,
    op: FinanceOp,
    undo: FinanceOp,
    message: string,
  ): Launch =>
    created
      ? {
          op: ops.createMonth(add(created)),
          undo: ops.removeMonth(add(created)),
          message: `${message} (${monthName(input.month)} criado)`,
        }
      : { op, undo, message }

  if (input.kind === 'entrada') {
    const income = {
      id: newId(),
      monthId,
      month: input.month,
      description,
      amount: input.amount,
      kind: 'normal' as const,
      sortOrder: inMonth([...finance.incomes, ...(created?.incomes ?? [])]),
    }
    return finish(
      (snapshot) => ({ ...snapshot, incomes: [...snapshot.incomes, income] }),
      ops.restoreIncome(income),
      ops.removeIncome(income),
      `Entrada de ${formatMoney(input.amount)} em ${where}`,
    )
  }

  if (!card) {
    const bill = {
      id: newId(),
      monthId,
      month: input.month,
      description,
      amount: input.amount,
      paid: input.paid,
      paidOn: input.paid ? day : null,
      sortOrder: inMonth([...finance.bills, ...(created?.bills ?? [])]),
      categoryId: input.categoryId ?? null,
      occurredAt,
      paidFrom: input.paidFrom ?? null,
    }
    return finish(
      (snapshot) => ({ ...snapshot, bills: [...snapshot.bills, bill] }),
      ops.restoreBill(bill),
      ops.removeBill(bill),
      `${formatMoney(input.amount)} lançado em ${where}${input.paid ? ', já como pago' : ', a pagar'}`,
    )
  }

  // Card expense: into that card's invoice for the month, created if missing.
  const existing = [...finance.invoices, ...(created?.invoices ?? [])].find(
    (item) => item.cardId === card.id && item.monthId === monthId,
  )
  const invoice: InvoiceRow = existing ?? {
    id: newId(),
    cardId: card.id,
    monthId,
    month: input.month,
    otherAmount: cents(0),
    estimated: true,
    note: null,
    paid: false,
    paidOn: null,
    closedTotal: null,
  }
  const expense: ExpenseRow = {
    id: newId(),
    invoiceId: invoice.id,
    description,
    amount: input.amount,
    spentOn: day,
    categoryId: input.categoryId ?? null,
    occurredAt,
    ...(input.forOther && { forOther: true }),
  }
  const message = `${formatMoney(input.amount)} na fatura ${card.name}${invoice.paid ? ' (ela já estava paga)' : ''}`
  if (created)
    return finish(
      (snapshot) => ({
        ...snapshot,
        invoices: existing
          ? snapshot.invoices
          : [...snapshot.invoices, invoice],
        expenses: [...snapshot.expenses, expense],
      }),
      ops.restoreExpense(expense),
      ops.removeExpense(expense),
      message,
    )
  return existing
    ? {
        op: ops.restoreExpense(expense),
        undo: ops.removeExpense(expense),
        message,
      }
    : {
        op: ops.restoreInvoice(invoice, [expense], input.today),
        undo: ops.removeInvoice(invoice),
        message,
      }
}
