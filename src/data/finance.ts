import type { Category } from '../domain/categories'
import { fromDecimal, type Cents } from '../domain/money'
import { isoDate, month, type ISODate, type Month } from '../domain/months'
import type {
  Bill,
  Income,
  InstallmentPayment,
  InstallmentPlan,
  Invoice,
  InvoiceExpense,
  Subscription,
} from '../domain/types'
import { supabase } from './supabase'

// Everything one person has, as the domain sees it plus ids and texts.
// Small enough to load at once; RLS guarantees it is only theirs.
export interface Card {
  readonly id: string
  readonly name: string
  readonly color: string | null
  readonly closingDay: number | null
  /** Fase 13.1: invoice due day, when known. */
  readonly dueDay?: number | null
  /** Fase 13.1: bank for the logo; null = guessed from the name, 'none' = no logo. */
  readonly bank?: string | null
  readonly sortOrder: number
}
export interface MonthEntry {
  readonly id: string
  readonly ref: Month
}
export type IncomeRow = Income & {
  readonly id: string
  readonly monthId: string
}
export type BillRow = Bill & {
  readonly id: string
  readonly monthId: string
  /** Fase 12: exact instant (ISO), when known. */
  readonly occurredAt?: string | null
}
export type InvoiceRow = Invoice & { readonly monthId: string }
export type ExpenseRow = InvoiceExpense & {
  readonly id: string
  readonly description: string
  readonly spentOn: ISODate
  /** Fase 12: exact instant (ISO), when known; spentOn follows it. */
  readonly occurredAt?: string | null
  /** Open Finance: the bank transaction it came from or was matched to. */
  readonly externalId?: string | null
  /** The person's own words about a bank purchase (its name is the bank's). */
  readonly note?: string | null
  /** When it was saved (ISO); marks bank purchases as new for a few days. */
  readonly createdAt?: string | null
  /** Fase 13.3: when the owner checked whose it is (bank purchases). */
  readonly reviewedAt?: string | null
}
export type PlanRow = InstallmentPlan & {
  readonly note: string | null
  /** Open Finance: recognizes this purchase's next installments. */
  readonly externalKey?: string | null
  readonly reviewedAt?: string | null
}
/** A credit card account at the bank (Open Finance) and the card it feeds. */
export interface BankAccountRow {
  readonly id: string
  readonly pluggyAccountId: string
  readonly itemId: string
  readonly name: string
  readonly number: string | null
  readonly cardId: string | null
  /** Fase 13.2: the limit as the bank last said it. */
  readonly creditLimit?: Cents | null
  readonly availableLimit?: Cents | null
  readonly limitAt?: string | null
}
/** A bank transaction or bill already handled. */
export interface BankRecordRow {
  readonly externalId: string
  readonly amount: Cents | null
  /** What it became; for "bill:ID", the app invoice. */
  readonly refId?: string | null
}
export type PaymentRow = InstallmentPayment & { readonly id: string }
export type SubscriptionRow = Subscription & {
  readonly name: string
  readonly chargeDay: number
  readonly note: string | null
}

export type { Category }

export interface Finance {
  readonly cards: readonly Card[]
  readonly categories: readonly Category[]
  readonly months: readonly MonthEntry[]
  readonly incomes: readonly IncomeRow[]
  readonly bills: readonly BillRow[]
  readonly invoices: readonly InvoiceRow[]
  readonly expenses: readonly ExpenseRow[]
  readonly plans: readonly PlanRow[]
  readonly payments: readonly PaymentRow[]
  readonly subscriptions: readonly SubscriptionRow[]
  readonly bankAccounts: readonly BankAccountRow[]
  readonly bankRecords: readonly BankRecordRow[]
  /**
   * Fase 13.3, only for the Open Finance owner: who else uses the cards
   * ("Pai").
   */
  readonly otherPerson?: string | null
  /**
   * The owner's convention (user_settings.due_next_month): an invoice is the
   * month before it is due. Everyone else: due in its own month.
   */
  readonly dueNextMonth?: boolean
  /** Owner only (user_settings.other_bank_until): see InvoiceContext. */
  readonly otherBankUntil?: Month | null
  /** Profile "Pai": outflows seen as the other person's (not loaded). */
  readonly viewAs?: 'owner' | 'other'
}

export const financeKey = (userId: string) => ['finance', userId] as const

type Row = Record<string, unknown>
const text = (value: unknown) => String(value)
const money = (value: unknown) => fromDecimal(String(value))
const date = (value: unknown) => (value == null ? null : isoDate(String(value)))
const monthOfDate = (value: unknown) => month(String(value).slice(0, 7))
const category = (value: unknown) => (value as string | null) ?? null
/** Same instant, always as ISO in UTC, whatever format the database sends. */
const instant = (value: unknown) =>
  value == null ? null : new Date(String(value)).toISOString()

async function select(table: string, columns: string): Promise<Row[]> {
  // TanStack Query already retries the whole load (queryClient.ts); a second
  // layer of retries here made an unreachable server take 15 s to show the error.
  const { data, error } = await supabase()
    .from(table)
    .select(columns)
    .retry(false)
  if (error) throw new Error(`Não consegui carregar ${table}: ${error.message}`)
  return (data ?? []) as unknown as Row[]
}

// Money comes as text (numeric::text) so no cent is lost in floating point.
export async function loadFinance(): Promise<Finance> {
  const [
    cards,
    categories,
    months,
    incomes,
    bills,
    invoices,
    expenses,
    plans,
    payments,
    subscriptions,
    bankAccounts,
    bankRecords,
    settings,
  ] = await Promise.all([
    select('cards', 'id,name,color,closing_day,due_day,bank,sort_order'),
    select('categories', 'id,name,color,icon,sort_order'),
    select('months', 'id,ref'),
    select('incomes', 'id,month_id,description,amount::text,kind,sort_order'),
    select(
      'bills',
      'id,month_id,description,amount::text,paid,paid_on,sort_order,category_id,occurred_at',
    ),
    select(
      'invoices',
      'id,card_id,month_id,other_amount::text,estimated,note,paid,paid_on,closed_total::text,bank_total::text',
    ),
    select(
      'invoice_expenses',
      'id,invoice_id,description,amount::text,spent_on,category_id,occurred_at,external_id,note,for_other,created_at,reviewed_at',
    ),
    select(
      'installment_plans',
      'id,card_id,description,installment_amount::text,final_adjustment::text,total_installments,first_month,note,category_id,external_key,for_other,reviewed_at',
    ),
    select(
      'installment_payments',
      'id,plan_id,month,paid_on,source,invoice_id',
    ),
    select(
      'subscriptions',
      'id,card_id,name,amount::text,charge_day,note,active,category_id',
    ),
    select(
      'bank_accounts',
      'id,pluggy_account_id,item_id,name,number,card_id,credit_limit::text,available_limit::text,limit_at',
    ),
    select('bank_records', 'external_id,amount::text,ref_id'),
    select('user_settings', 'other_person,due_next_month,other_bank_until'),
  ])
  const monthRows = months
    .map((row) => ({ id: text(row.id), ref: monthOfDate(row.ref) }))
    .sort((a, b) => a.ref.localeCompare(b.ref))
  const refOf = new Map(monthRows.map((row) => [row.id, row.ref]))
  const ref = (monthId: unknown) => refOf.get(text(monthId))!

  const otherPerson = (settings[0]?.other_person as string | null) ?? null
  return {
    cards: cards
      .map((row) => ({
        id: text(row.id),
        name: text(row.name),
        color: (row.color as string | null) ?? null,
        closingDay: (row.closing_day as number | null) ?? null,
        dueDay: (row.due_day as number | null) ?? null,
        bank: (row.bank as string | null) ?? null,
        sortOrder: Number(row.sort_order),
      }))
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    categories: categories
      .map((row) => ({
        id: text(row.id),
        name: text(row.name),
        color: text(row.color),
        icon: text(row.icon),
        sortOrder: Number(row.sort_order),
      }))
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    months: monthRows,
    incomes: incomes
      .map((row) => ({
        id: text(row.id),
        monthId: text(row.month_id),
        month: ref(row.month_id),
        description: text(row.description),
        amount: money(row.amount),
        kind: row.kind as IncomeRow['kind'],
        sortOrder: Number(row.sort_order),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    bills: bills
      .map((row) => ({
        id: text(row.id),
        monthId: text(row.month_id),
        month: ref(row.month_id),
        description: text(row.description),
        amount: money(row.amount),
        paid: Boolean(row.paid),
        paidOn: date(row.paid_on),
        sortOrder: Number(row.sort_order),
        categoryId: category(row.category_id),
        occurredAt: instant(row.occurred_at),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    invoices: invoices.map((row) => ({
      id: text(row.id),
      cardId: text(row.card_id),
      monthId: text(row.month_id),
      month: ref(row.month_id),
      otherAmount: money(row.other_amount),
      estimated: Boolean(row.estimated),
      note: (row.note as string | null) ?? null,
      paid: Boolean(row.paid),
      paidOn: date(row.paid_on),
      closedTotal: row.closed_total == null ? null : money(row.closed_total),
      bankTotal: row.bank_total == null ? null : money(row.bank_total),
    })),
    expenses: expenses
      .map((row) => ({
        id: text(row.id),
        invoiceId: text(row.invoice_id),
        description: text(row.description),
        amount: money(row.amount),
        spentOn: isoDate(text(row.spent_on)),
        categoryId: category(row.category_id),
        occurredAt: instant(row.occurred_at),
        externalId: (row.external_id as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        forOther: row.for_other === true,
        createdAt: instant(row.created_at),
        reviewedAt: instant(row.reviewed_at),
      }))
      .sort((a, b) => a.spentOn.localeCompare(b.spentOn)),
    plans: plans.map((row) => ({
      id: text(row.id),
      cardId: (row.card_id as string | null) ?? null,
      description: text(row.description),
      installmentAmount: money(row.installment_amount),
      finalAdjustment: money(row.final_adjustment),
      totalInstallments: Number(row.total_installments),
      firstMonth: monthOfDate(row.first_month),
      note: (row.note as string | null) ?? null,
      categoryId: category(row.category_id),
      externalKey: (row.external_key as string | null) ?? null,
      forOther: row.for_other === true,
      reviewedAt: instant(row.reviewed_at),
    })),
    payments: payments.map((row) => ({
      id: text(row.id),
      planId: text(row.plan_id),
      month: monthOfDate(row.month),
      paidOn: isoDate(text(row.paid_on)),
      source: row.source as PaymentRow['source'],
      invoiceId: (row.invoice_id as string | null) ?? null,
    })),
    subscriptions: subscriptions.map((row) => ({
      id: text(row.id),
      cardId: (row.card_id as string | null) ?? null,
      name: text(row.name),
      amount: money(row.amount),
      chargeDay: Number(row.charge_day),
      note: (row.note as string | null) ?? null,
      active: Boolean(row.active),
      categoryId: category(row.category_id),
    })),
    bankAccounts: bankAccounts.map((row) => ({
      id: text(row.id),
      pluggyAccountId: text(row.pluggy_account_id),
      itemId: text(row.item_id),
      name: text(row.name),
      number: (row.number as string | null) ?? null,
      cardId: (row.card_id as string | null) ?? null,
      creditLimit: row.credit_limit == null ? null : money(row.credit_limit),
      availableLimit:
        row.available_limit == null ? null : money(row.available_limit),
      limitAt: instant(row.limit_at),
    })),
    bankRecords: bankRecords.map((row) => ({
      externalId: text(row.external_id),
      amount: row.amount == null ? null : money(row.amount),
      refId: (row.ref_id as string | null) ?? null,
    })),
    otherPerson,
    dueNextMonth: settings[0]?.due_next_month === true,
    otherBankUntil: settings[0]?.other_bank_until
      ? monthOfDate(settings[0].other_bank_until)
      : null,
  }
}
