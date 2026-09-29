import type { Cents } from './money'
import type { ISODate, Month } from './months'

// Inputs belong to ONE authenticated user. Ownership and database IDs are mapped
// at the data boundary; these pure functions do not replace server-side RLS.
export interface InstallmentPlan {
  readonly id: string
  readonly cardId: string | null
  readonly description: string
  readonly installmentAmount: Cents
  readonly finalAdjustment: Cents
  readonly totalInstallments: number
  readonly firstMonth: Month
  /** Fase 11: optional spending category. */
  readonly categoryId?: string | null
  /** Fase 13.3: bought by the other person who uses the cards. */
  readonly forOther?: boolean
}

export interface InstallmentPayment {
  readonly planId: string
  readonly month: Month
  readonly paidOn: ISODate
  readonly source: 'manual' | 'invoice'
  readonly invoiceId: string | null
}

export interface Subscription {
  readonly id: string
  readonly cardId: string | null
  readonly amount: Cents
  readonly active: boolean
  readonly categoryId?: string | null
}

export interface Invoice {
  readonly id: string
  readonly cardId: string
  readonly month: Month
  readonly otherAmount: Cents
  readonly estimated: boolean
  readonly paid: boolean
  readonly paidOn: ISODate | null
  readonly closedTotal: Cents | null
  readonly note: string | null
}

export interface InvoiceExpense {
  readonly invoiceId: string
  readonly amount: Cents
  readonly categoryId?: string | null
  /** Fase 13.3: bought by the other person who uses the cards. */
  readonly forOther?: boolean
}

export interface Income {
  readonly month: Month
  readonly description: string
  readonly amount: Cents
  /** 'from_other': money the other person sent back for their part. */
  readonly kind: 'normal' | 'carryover' | 'from_other'
  readonly sortOrder: number
}

export interface Bill {
  readonly month: Month
  readonly description: string
  readonly amount: Cents
  readonly paid: boolean
  readonly paidOn: ISODate | null
  readonly sortOrder: number
  readonly categoryId?: string | null
}

export interface InvoiceContext {
  readonly plans: readonly InstallmentPlan[]
  readonly payments: readonly InstallmentPayment[]
  readonly subscriptions: readonly Subscription[]
  readonly expenses: readonly InvoiceExpense[]
  /**
   * Fase 13.3 (the owner's choice): someone else uses the cards and the
   * undetailed rest of every invoice ("outros") is theirs.
   */
  readonly restIsOther?: boolean
  /**
   * Fase 13.3, profile "Pai": the month's outflows seen as the other person's
   * (their purchases, plans and the rest of the invoices), not the owner's.
   */
  readonly viewAs?: 'owner' | 'other'
}

export interface FinancialData extends InvoiceContext {
  readonly incomes: readonly Income[]
  readonly bills: readonly Bill[]
  readonly invoices: readonly Invoice[]
}
