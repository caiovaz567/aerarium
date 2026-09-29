import {
  suggestCategory,
  normalizeText,
  type Category,
  type CategorizedText,
} from './categories'
import { invoiceMonthForCard } from './cardDates'
import { fixedCardAmounts } from './invoices'
import { cents, formatMoney, sumMoney, type Cents } from './money'
import {
  addMonths,
  dateInSaoPaulo,
  daysInMonth,
  isoDate,
  monthLabel,
  monthOf,
  monthsBetween,
  type ISODate,
  type Month,
} from './months'
import type { InstallmentPayment, InstallmentPlan, Subscription } from './types'

// Open Finance import (decisions of the user): bank purchases go straight in
// with a suggested category and never duplicate what was launched by hand;
// installment purchases become (or join) installment plans; charges of a
// registered subscription are recognized; a closed bill sets the invoice
// total, so "outros" is only the difference. Pure: the data layer writes it.

export interface BankAccount {
  readonly pluggyAccountId: string
  /** The app card this bank card feeds; unmapped accounts are skipped. */
  readonly cardId: string | null
  /** Due date of the bill still open at the bank, if the bank says. */
  readonly dueDate: ISODate | null
  readonly closeDate: ISODate | null
}

export interface BankTransaction {
  readonly id: string
  readonly accountId: string
  readonly description: string
  /** Positive is a charge; zero or negative (payments, refunds) is ignored. */
  readonly amount: Cents
  /** The instant as the bank sends it (ISO). Midnight in São Paulo = no time. */
  readonly date: string
  readonly installmentNumber: number | null
  readonly totalInstallments: number | null
  readonly billId: string | null
}

export interface BankBill {
  readonly id: string
  readonly accountId: string
  readonly dueDate: ISODate
  readonly total: Cents
}

export interface ImportCard {
  readonly id: string
  readonly closingDay: number | null
  readonly dueDay?: number | null
}
export interface ImportInvoice {
  readonly id: string
  readonly cardId: string
  readonly month: Month
  readonly paid: boolean
  /** "Outros" typed by the person. */
  readonly otherAmount: Cents
}
export interface ImportExpense {
  readonly id: string
  readonly invoiceId: string
  readonly description: string
  readonly amount: Cents
  readonly spentOn: ISODate
  readonly categoryId?: string | null
  readonly externalId?: string | null
  readonly note?: string | null
  readonly forOther?: boolean
}
export interface ImportPlan extends InstallmentPlan {
  readonly externalKey?: string | null
}
export interface ImportSubscription extends Subscription {
  readonly name: string
}

export interface ImportState {
  readonly cards: readonly ImportCard[]
  readonly months: readonly { readonly id: string; readonly ref: Month }[]
  readonly invoices: readonly ImportInvoice[]
  readonly expenses: readonly ImportExpense[]
  readonly plans: readonly ImportPlan[]
  readonly payments: readonly InstallmentPayment[]
  readonly subscriptions: readonly ImportSubscription[]
  readonly categories: readonly Category[]
  /** Descriptions already categorized, oldest first, for the suggestion. */
  readonly history: readonly CategorizedText[]
  /** Bank ids already handled (transactions, and "bill:ID" with the total). */
  readonly records: ReadonlyMap<string, { readonly amount: Cents | null }>
  /** Fase 13.3: someone else uses the cards (only for the owner). */
  readonly otherPerson?: boolean
}

export type RecordKind =
  | 'expense'
  | 'matched'
  | 'installment'
  | 'subscription'
  | 'ignored'
  | 'closed'
  | 'bill'

export interface ImportResult {
  readonly invoices: readonly {
    readonly id: string
    readonly cardId: string
    readonly monthId: string
    readonly month: Month
  }[]
  readonly expenses: readonly {
    readonly id: string
    readonly invoiceId: string
    readonly description: string
    readonly amount: Cents
    readonly spentOn: ISODate
    readonly occurredAt: string | null
    readonly categoryId: string | null
    readonly externalId: string
    /** Fase 13.3: the other person's, as guessed (the owner reviews it). */
    readonly forOther: boolean
  }[]
  /**
   * Expenses launched by hand that are the same purchase. They take the
   * bank's name; what was typed stays as the note when it says more.
   */
  readonly links: readonly {
    readonly expenseId: string
    readonly externalId: string
    readonly description: string
    readonly note: string | null
  }[]
  readonly plans: readonly {
    readonly id: string
    readonly cardId: string
    readonly description: string
    readonly installmentAmount: Cents
    readonly totalInstallments: number
    readonly firstMonth: Month
    readonly categoryId: string | null
    readonly externalKey: string
    readonly forOther: boolean
  }[]
  /** Plans made by hand that are the same purchase. */
  readonly planLinks: readonly {
    readonly planId: string
    readonly externalKey: string
  }[]
  /** "Outros" of an open invoice, from the bank's closed bill. */
  readonly invoiceTotals: readonly {
    readonly invoiceId: string
    readonly otherAmount: Cents
  }[]
  readonly records: readonly {
    readonly externalId: string
    readonly kind: RecordKind
    readonly refId: string | null
    readonly amount: Cents | null
  }[]
  /** Things worth telling the person, in plain words. */
  readonly notices: readonly string[]
  /**
   * Each closed bill against what the app knows of that invoice, so the
   * preview can show where a difference comes from.
   */
  readonly billChecks: readonly {
    readonly cardId: string
    readonly month: Month
    readonly bank: Cents
    readonly installments: Cents
    readonly subscriptions: Cents
    readonly purchases: Cents
  }[]
}

/** How long the bank's text and the person's can drift apart in days. */
const SAME_PURCHASE_DAYS = 3

/** The bank's name for a purchase, exactly as it comes (spaces tidied). */
export function bankText(description: string) {
  return description.replace(/\s+/g, ' ').trim().slice(0, 200) || 'Compra'
}

/** Installment text without "02/10", "PARC" and alike, for the plan's key. */
export function purchaseText(description: string) {
  return description
    .replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, ' ')
    .replace(/\bparc(ela)?s?\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The day in São Paulo, and the instant only when it is not a bare date. */
export function bankMoment(date: string): { day: ISODate; at: string | null } {
  const instant = new Date(date)
  const day = dateInSaoPaulo(instant)
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
  return { day, at: local === '00:00:00' ? null : instant.toISOString() }
}

/** Which app invoice month a bank charge belongs to. */
export function bankInvoiceMonth(
  transaction: BankTransaction,
  account: BankAccount,
  bills: readonly BankBill[],
  card: Pick<ImportCard, 'closingDay' | 'dueDay'>,
): Month {
  const bill = transaction.billId
    ? bills.find((item) => item.id === transaction.billId)
    : undefined
  if (bill) return monthOf(bill.dueDate)
  const { day } = bankMoment(transaction.date)
  if (!account.dueDate) return invoiceMonthForCard(day, card)
  const open = monthOf(account.dueDate)
  // The open bill's closing: the bank's, else a week before it is due.
  const close =
    account.closeDate ??
    isoDate(
      new Date(Date.parse(`${account.dueDate}T12:00:00Z`) - 7 * 86_400_000)
        .toISOString()
        .slice(0, 10),
    )
  // After it closed, it is already the next one.
  if (day > close) return addMonths(open, 1)
  // Before, walk back one closing a month until the purchase is after it:
  // an old purchase belongs to an old bill, not the open one.
  const closingDay = Number(close.slice(8, 10))
  for (let back = 1; back <= 24; back++) {
    const target = addMonths(monthOf(close), -back)
    const previous = isoDate(
      `${target}-${String(Math.min(closingDay, daysInMonth(target))).padStart(2, '0')}`,
    )
    if (day > previous) return addMonths(open, 1 - back)
  }
  return addMonths(open, -24)
}

const daysApart = (a: ISODate, b: ISODate) =>
  Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) /
  86_400_000

const close = (a: Cents, b: Cents, share: number, floor: number) =>
  Math.abs(a - b) <= Math.max(floor, Math.abs(b) * share)

/** A store's name without numbers and "PARC", to learn who buys there. */
const storeKey = (text: string) =>
  normalizeText(purchaseText(text))
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Fase 13.3: whose a purchase from the bank is. The first import is history:
 * the owner launched by hand what was theirs, so the rest was the other
 * person's. Afterwards the store decides (the last choice for it), and a new
 * store follows what most bank purchases on that card were.
 */
function ownerGuess(state: ImportState, firstImport: boolean) {
  const cardOf = new Map(state.invoices.map((item) => [item.id, item.cardId]))
  const seen = state.expenses
    .filter((item) => item.externalId)
    .map((item) => ({
      key: storeKey(item.description),
      cardId: cardOf.get(item.invoiceId),
      forOther: item.forOther === true,
    }))
  return {
    guess(text: string, cardId: string): boolean {
      if (!state.otherPerson) return false
      if (firstImport) return true
      const key = storeKey(text)
      const word = key.split(' ')[0]!
      const latest = [...seen].reverse()
      const same =
        latest.find((item) => item.key === key) ??
        (word.length >= 3
          ? latest.find((item) => item.key.split(' ')[0] === word)
          : undefined)
      if (same) return same.forOther
      const onCard = seen.filter((item) => item.cardId === cardId)
      return onCard.filter((item) => item.forOther).length * 2 > onCard.length
    },
    learn(text: string, cardId: string, forOther: boolean) {
      seen.push({ key: storeKey(text), cardId, forOther })
    },
  }
}

export function planBankImport(
  state: ImportState,
  input: {
    readonly accounts: readonly BankAccount[]
    readonly transactions: readonly BankTransaction[]
    readonly bills: readonly BankBill[]
  },
  newId: () => string = () => crypto.randomUUID(),
): ImportResult {
  const result = {
    invoices: [] as ImportResult['invoices'][number][],
    expenses: [] as ImportResult['expenses'][number][],
    links: [] as ImportResult['links'][number][],
    plans: [] as ImportResult['plans'][number][],
    planLinks: [] as ImportResult['planLinks'][number][],
    invoiceTotals: [] as ImportResult['invoiceTotals'][number][],
    records: [] as ImportResult['records'][number][],
    notices: [] as string[],
    billChecks: [] as ImportResult['billChecks'][number][],
  }
  const record = (
    externalId: string,
    kind: RecordKind,
    refId: string | null = null,
    amount: Cents | null = null,
  ) => result.records.push({ externalId, kind, refId, amount })

  const accounts = new Map(
    input.accounts.map((item) => [item.pluggyAccountId, item]),
  )
  const monthIds = new Map(state.months.map((item) => [item.ref, item.id]))
  const invoices = [...state.invoices]
  const linked = new Set<string>()
  const touched = new Set<string>()
  const plans: ImportPlan[] = [...state.plans]
  const history = [...state.history]
  const owner = ownerGuess(state, state.records.size === 0)

  const invoiceFor = (cardId: string, target: Month) => {
    const existing = invoices.find(
      (item) => item.cardId === cardId && item.month === target,
    )
    if (existing) return existing
    const monthId = monthIds.get(target)!
    const created = { id: newId(), cardId, monthId, month: target }
    result.invoices.push(created)
    const invoice = {
      id: created.id,
      cardId,
      month: target,
      paid: false,
      otherAmount: cents(0),
    }
    invoices.push(invoice)
    return invoice
  }

  // Oldest first, so an installment's first charge makes the plan.
  const ordered = [...input.transactions].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  for (const transaction of ordered) {
    if (state.records.has(transaction.id)) continue
    const account = accounts.get(transaction.accountId)
    if (!account?.cardId) continue
    if (transaction.amount <= 0) {
      record(transaction.id, 'ignored')
      continue
    }
    const cardId = account.cardId
    const card = state.cards.find((item) => item.id === cardId)
    const target = bankInvoiceMonth(
      transaction,
      account,
      input.bills,
      card ?? { closingDay: null },
    )
    // Months are created by the person (they carry over what was left).
    if (!monthIds.has(target)) continue
    const existingInvoice = invoices.find(
      (item) => item.cardId === cardId && item.month === target,
    )
    if (existingInvoice?.paid) {
      record(transaction.id, 'closed')
      continue
    }
    const { day, at } = bankMoment(transaction.date)
    const name = bankText(transaction.description)
    // A plan lasts many invoices: its name leaves out "PARC 02/10".
    const text = purchaseText(name) || name

    const total = transaction.totalInstallments ?? 1
    if (total > 1) {
      const number = Math.min(
        Math.max(transaction.installmentNumber ?? 1, 1),
        total,
      )
      const firstMonth = addMonths(target, -(number - 1))
      const key = `${transaction.accountId}|${normalizeText(text)}|${total}|${transaction.amount}|${firstMonth}`
      let plan = plans.find((item) => item.externalKey === key)
      if (!plan) {
        // Made by hand before: same card, count and value, first month ±1.
        plan = plans.find(
          (item) =>
            !item.externalKey &&
            item.cardId === cardId &&
            item.totalInstallments === total &&
            close(item.installmentAmount, transaction.amount, 0.01, 10) &&
            Math.abs(monthsBetween(item.firstMonth, firstMonth)) <= 1,
        )
        if (plan) {
          result.planLinks.push({ planId: plan.id, externalKey: key })
          plan = { ...plan, externalKey: key }
          plans[plans.findIndex((item) => item.id === plan!.id)] = plan
        } else {
          const categoryId = suggestCategory(text, state.categories, history)
          const created = {
            id: newId(),
            cardId,
            description: text,
            installmentAmount: transaction.amount,
            totalInstallments: total,
            firstMonth,
            categoryId,
            externalKey: key,
            forOther: owner.guess(text, cardId),
          }
          result.plans.push(created)
          plan = {
            ...created,
            finalAdjustment: cents(0),
          }
          plans.push(plan)
          history.push({ description: text, categoryId })
        }
      }
      record(transaction.id, 'installment', plan.id)
      continue
    }

    const subscription = state.subscriptions.find(
      (item) =>
        item.active &&
        item.cardId === cardId &&
        close(item.amount, transaction.amount, 0.1, 0),
    )
    if (subscription) {
      if (!close(subscription.amount, transaction.amount, 0.01, 0))
        result.notices.push(
          `${subscription.name} veio ${formatMoney(transaction.amount)}, e está cadastrada com ${formatMoney(subscription.amount)}.`,
        )
      record(transaction.id, 'subscription', subscription.id)
      continue
    }

    const invoiceIds = new Set(
      invoices.filter((item) => item.cardId === cardId).map((item) => item.id),
    )
    const manual = state.expenses.find(
      (item) =>
        !item.externalId &&
        !linked.has(item.id) &&
        invoiceIds.has(item.invoiceId) &&
        item.amount === transaction.amount &&
        daysApart(item.spentOn, day) <= SAME_PURCHASE_DAYS,
    )
    if (manual) {
      linked.add(manual.id)
      const typed = manual.description.trim()
      result.links.push({
        expenseId: manual.id,
        externalId: transaction.id,
        description: name,
        note:
          manual.note ??
          (normalizeText(typed) === normalizeText(name) ? null : typed),
      })
      record(transaction.id, 'matched', manual.id)
      continue
    }

    const invoice = invoiceFor(cardId, target)
    touched.add(invoice.id)
    const categoryId = suggestCategory(name, state.categories, history)
    const forOther = owner.guess(name, cardId)
    owner.learn(name, cardId, forOther)
    const expense = {
      id: newId(),
      invoiceId: invoice.id,
      forOther,
      description: name,
      amount: transaction.amount,
      spentOn: day,
      occurredAt: at,
      categoryId,
      externalId: transaction.id,
    }
    result.expenses.push(expense)
    history.push({ description: name, categoryId })
    record(transaction.id, 'expense', expense.id)
  }

  // A closed bill sets the total: "outros" is what is left after the rest.
  for (const bill of input.bills) {
    const key = `bill:${bill.id}`
    if (state.records.get(key)?.amount === bill.total) continue
    const account = accounts.get(bill.accountId)
    if (!account?.cardId) continue
    const target = monthOf(bill.dueDate)
    const invoice = invoices.find(
      (item) => item.cardId === account.cardId && item.month === target,
    )
    if (!invoice || invoice.paid) continue
    const fixed = fixedCardAmounts(account.cardId, target, {
      plans,
      payments: state.payments,
      subscriptions: state.subscriptions,
      expenses: [],
    })
    const launched = sumMoney(
      [...state.expenses, ...result.expenses]
        .filter((item) => item.invoiceId === invoice.id)
        .map((item) => item.amount),
    )
    const known = sumMoney([
      fixed.installmentsAmount,
      fixed.subscriptionsAmount,
      launched,
    ])
    result.billChecks.push({
      cardId: account.cardId,
      month: target,
      bank: bill.total,
      installments: fixed.installmentsAmount,
      subscriptions: fixed.subscriptionsAmount,
      purchases: launched,
    })
    const rest = sumMoney([bill.total, cents(-known)])
    if (rest < 0)
      result.notices.push(
        `A fatura de ${monthLabel(target)} veio ${formatMoney(bill.total)} no banco, menos que parcelas, assinaturas e gastos juntos (${formatMoney(known)}).`,
      )
    result.invoiceTotals.push({
      invoiceId: invoice.id,
      otherAmount: rest < 0 ? cents(0) : rest,
    })
    record(key, 'bill', invoice.id, bill.total)
  }

  // An open invoice fed by the bank sums the purchases that arrived: the
  // "outros" typed by hand would count them twice, so it goes to zero, once.
  for (const invoice of invoices) {
    if (!touched.has(invoice.id) || invoice.otherAmount <= 0) continue
    const key = `open:${invoice.id}`
    if (state.records.has(key)) continue
    if (result.invoiceTotals.some((item) => item.invoiceId === invoice.id))
      continue
    result.invoiceTotals.push({ invoiceId: invoice.id, otherAmount: cents(0) })
    record(key, 'bill', invoice.id)
  }
  return result
}

/**
 * The app card whose name shares the most words with the bank's card name
 * ("SANTANDER UNIQUE VISA INFINITE" → "Santander Unique"). Null when none do.
 */
/**
 * Closing and due days the bank tells, for cards that do not have them yet
 * (what the person typed is never replaced).
 */
export function cardDaysFromBank(
  cards: readonly {
    readonly id: string
    readonly closingDay: number | null
    readonly dueDay?: number | null
  }[],
  accounts: readonly BankAccount[],
): { cardId: string; closingDay: number | null; dueDay: number | null }[] {
  const day = (date: ISODate | null) =>
    date ? Number(date.slice(8, 10)) : null
  return cards.flatMap((card) => {
    const account = accounts.find((item) => item.cardId === card.id)
    if (!account) return []
    const closingDay = card.closingDay ?? day(account.closeDate)
    const dueDay = card.dueDay ?? day(account.dueDate)
    return closingDay === card.closingDay && dueDay === (card.dueDay ?? null)
      ? []
      : [{ cardId: card.id, closingDay, dueDay }]
  })
}

export function guessCard(
  bankName: string,
  cards: readonly { readonly id: string; readonly name: string }[],
): string | null {
  const words = new Set(normalizeText(bankName).split(' '))
  let best: string | null = null
  let score = 0
  for (const card of cards) {
    const hits = normalizeText(card.name)
      .split(' ')
      .filter((word) => word.length >= 2 && words.has(word)).length
    if (hits > score) {
      best = card.id
      score = hits
    }
  }
  return best
}
