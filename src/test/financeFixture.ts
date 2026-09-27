import type { Finance } from '../data/finance'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import { cents } from '../domain/money'
import { isoDate, month } from '../domain/months'

/**
 * Fictitious data, checked by hand. September 2026:
 * incomes 5.000 + 100 (carryover) = 5.100,00
 * Nubank: Notebook 120 + Streaming 39,90 + Uber 12 + outros 271,02 = 442,92
 * long-name card: 0 (estimated) · Dentista (no card) 150 · Luz 180,35 · Internet 99,90 paid
 * outflows 873,17 · available 4.226,83 · unpaid 773,27
 * August: 5.000 − (Nubank paid 359,90 + Dentista paid 150 + Aluguel paid 1.500) = 2.990,10
 * Categories (default list, ids cat-alimentacao…): Luz Moradia, Uber Transporte,
 * Notebook Compras, Streaming Assinaturas; Internet and Dentista have none.
 */
export const categoryId = (name: string) =>
  `cat-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}`

export function financeFixture(): Finance {
  const aug = month('2026-08')
  const sep = month('2026-09')
  return {
    cards: [
      {
        id: 'c1',
        name: 'Nubank Teste',
        color: null,
        closingDay: null,
        sortOrder: 1,
      },
      {
        id: 'c2',
        name: 'Cartão com um nome bem comprido pra quebrar a linha',
        color: '#3140C2',
        closingDay: null,
        sortOrder: 2,
      },
    ],
    categories: DEFAULT_CATEGORIES.map((item, index) => ({
      id: categoryId(item.name),
      name: item.name,
      color: item.color,
      icon: item.icon,
      sortOrder: index,
    })),
    months: [
      { id: 'm8', ref: aug },
      { id: 'm9', ref: sep },
    ],
    incomes: [
      {
        id: 'i8',
        monthId: 'm8',
        month: aug,
        description: 'Salário',
        amount: cents(500000),
        kind: 'normal',
        sortOrder: 0,
      },
      {
        id: 'i9',
        monthId: 'm9',
        month: sep,
        description: 'Salário',
        amount: cents(500000),
        kind: 'normal',
        sortOrder: 0,
      },
      {
        id: 'i9c',
        monthId: 'm9',
        month: sep,
        description: 'Sobrou do mês passado',
        amount: cents(10000),
        kind: 'carryover',
        sortOrder: 1,
      },
    ],
    bills: [
      {
        id: 'b8',
        monthId: 'm8',
        month: aug,
        description: 'Aluguel',
        amount: cents(150000),
        paid: true,
        paidOn: isoDate('2026-08-05'),
        sortOrder: 0,
      },
      {
        id: 'b9a',
        monthId: 'm9',
        month: sep,
        description: 'Conta de luz',
        amount: cents(18035),
        paid: false,
        paidOn: null,
        sortOrder: 0,
        categoryId: categoryId('Moradia'),
      },
      {
        id: 'b9b',
        monthId: 'm9',
        month: sep,
        description: 'Internet',
        amount: cents(9990),
        paid: true,
        paidOn: isoDate('2026-09-10'),
        sortOrder: 1,
      },
    ],
    invoices: [
      {
        id: 'v8a',
        cardId: 'c1',
        monthId: 'm8',
        month: aug,
        otherAmount: cents(20000),
        estimated: false,
        note: null,
        paid: true,
        paidOn: isoDate('2026-08-10'),
        closedTotal: cents(35990),
      },
      {
        id: 'v8b',
        cardId: 'c2',
        monthId: 'm8',
        month: aug,
        otherAmount: cents(0),
        estimated: true,
        note: null,
        paid: false,
        paidOn: null,
        closedTotal: null,
      },
      {
        id: 'v9a',
        cardId: 'c1',
        monthId: 'm9',
        month: sep,
        otherAmount: cents(27102),
        estimated: false,
        note: 'iPhone 2/12',
        paid: false,
        paidOn: null,
        closedTotal: null,
      },
      {
        id: 'v9b',
        cardId: 'c2',
        monthId: 'm9',
        month: sep,
        otherAmount: cents(0),
        estimated: true,
        note: 'Fatura Cartão com um nome bem comprido pra quebrar a linha',
        paid: false,
        paidOn: null,
        closedTotal: null,
      },
    ],
    expenses: [
      {
        id: 'e1',
        invoiceId: 'v9a',
        description: 'Uber',
        amount: cents(1200),
        spentOn: isoDate('2026-09-03'),
        categoryId: categoryId('Transporte'),
      },
    ],
    plans: [
      {
        id: 'p1',
        cardId: 'c1',
        description: 'Notebook',
        installmentAmount: cents(12000),
        finalAdjustment: cents(0),
        totalInstallments: 10,
        firstMonth: aug,
        note: null,
        categoryId: categoryId('Compras'),
      },
      {
        id: 'p2',
        cardId: null,
        description: 'Dentista',
        installmentAmount: cents(15000),
        finalAdjustment: cents(0),
        totalInstallments: 4,
        firstMonth: aug,
        note: 'aparelho',
      },
    ],
    payments: [
      {
        id: 'pay1',
        planId: 'p1',
        month: aug,
        paidOn: isoDate('2026-08-10'),
        source: 'invoice',
        invoiceId: 'v8a',
      },
      {
        id: 'pay2',
        planId: 'p2',
        month: aug,
        paidOn: isoDate('2026-08-12'),
        source: 'manual',
        invoiceId: null,
      },
    ],
    subscriptions: [
      {
        id: 's1',
        cardId: 'c1',
        name: 'Streaming',
        amount: cents(3990),
        chargeDay: 10,
        note: null,
        active: true,
        categoryId: categoryId('Assinaturas'),
      },
    ],
  }
}
