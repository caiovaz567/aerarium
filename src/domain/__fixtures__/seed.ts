import { cents } from '../money'
import { isoDate, month } from '../months'
import type { FinancialData, InstallmentPlan, Invoice } from '../types'

export const fixtureId = (prefix: number, suffix: number) =>
  `${prefix}0000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

export function plan(
  overrides: Partial<InstallmentPlan> = {},
): InstallmentPlan {
  return {
    id: 'plan',
    cardId: 'card',
    description: 'Compra',
    installmentAmount: cents(10000),
    finalAdjustment: cents(0),
    totalInstallments: 10,
    firstMonth: month('2026-09'),
    ...overrides,
  }
}

export function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice',
    cardId: 'card',
    month: month('2026-09'),
    otherAmount: cents(0),
    estimated: true,
    paid: false,
    paidOn: null,
    closedTotal: null,
    note: null,
    ...overrides,
  }
}

export function emptyData(
  overrides: Partial<FinancialData> = {},
): FinancialData {
  return {
    incomes: [],
    bills: [],
    invoices: [],
    plans: [],
    payments: [],
    subscriptions: [],
    expenses: [],
    ...overrides,
  }
}

/** Same fictitious inputs as supabase/seed.sql, independently expressed in cents. */
export function seedData(): FinancialData {
  const months = ['2026-08', '2026-09', '2026-10', '2026-11'].map(month)
  return {
    plans: [
      plan({
        id: fixtureId(4, 1),
        cardId: fixtureId(2, 1),
        description: 'Notebook ficticio',
        firstMonth: month('2026-07'),
      }),
      plan({
        id: fixtureId(4, 2),
        cardId: fixtureId(2, 2),
        description: 'Telefone ficticio',
        installmentAmount: cents(6000),
        totalInstallments: 4,
        firstMonth: month('2026-08'),
      }),
      plan({
        id: fixtureId(4, 3),
        cardId: null,
        description: 'Curso ficticio',
        installmentAmount: cents(3333),
        totalInstallments: 3,
        finalAdjustment: cents(1),
      }),
    ],
    payments: [
      {
        planId: fixtureId(4, 1),
        month: month('2026-07'),
        paidOn: isoDate('2026-07-01'),
        source: 'manual',
        invoiceId: null,
      },
      {
        planId: fixtureId(4, 1),
        month: month('2026-08'),
        paidOn: isoDate('2026-08-15'),
        source: 'invoice',
        invoiceId: fixtureId(5, 11),
      },
      {
        planId: fixtureId(4, 2),
        month: month('2026-09'),
        paidOn: isoDate('2026-09-01'),
        source: 'manual',
        invoiceId: null,
      },
      {
        planId: fixtureId(4, 3),
        month: month('2026-10'),
        paidOn: isoDate('2026-10-01'),
        source: 'manual',
        invoiceId: null,
      },
    ],
    subscriptions: [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        cardId: fixtureId(2, 1),
        amount: cents(2000),
        active: true,
      },
    ],
    invoices: months.flatMap((target, index) =>
      [1, 2, 3].map((card) =>
        invoice({
          id: fixtureId(5, (index + 1) * 10 + card),
          cardId: fixtureId(2, card),
          month: target,
          otherAmount: cents(card === 1 ? 3000 : card === 2 ? 1000 : 500),
          estimated: false,
          paid: index === 0 && card === 1,
          paidOn: index === 0 && card === 1 ? isoDate('2026-08-15') : null,
          closedTotal: index === 0 && card === 1 ? cents(17000) : null,
        }),
      ),
    ),
    incomes: months.flatMap((target) => [
      {
        month: target,
        description: 'Salario ficticio',
        amount: cents(200000),
        kind: 'normal' as const,
        sortOrder: 0,
      },
      {
        month: target,
        description: 'Freela ficticio',
        amount: cents(10000),
        kind: 'normal' as const,
        sortOrder: 0,
      },
    ]),
    bills: months.flatMap((target) => [
      {
        month: target,
        description: 'Aluguel ficticio',
        amount: cents(50000),
        paid: false,
        paidOn: null,
        sortOrder: 0,
      },
      {
        month: target,
        description: 'Internet ficticia',
        amount: cents(8000),
        paid: true,
        paidOn: isoDate(`${target}-01`),
        sortOrder: 0,
      },
    ]),
    expenses: months.flatMap((_, index) =>
      [1200, 800].map((amount) => ({
        invoiceId: fixtureId(5, (index + 1) * 10 + 1),
        amount: cents(amount),
      })),
    ),
  }
}
