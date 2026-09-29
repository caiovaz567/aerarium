import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import { monthBalance } from './balance'
import { monthOutflowItems } from './categories'
import { invoiceTotals } from './invoices'
import { cents, sumMoney } from './money'
import { isoDate, month } from './months'

// Fase 13.3: the owner's father uses the same cards. His purchases (and, by
// the owner's choice, the undetailed "outros") are on the invoice but not in
// the owner's month.
const sep = month('2026-09')
const data = (restIsOther: boolean) =>
  emptyData({
    restIsOther,
    incomes: [
      {
        month: sep,
        description: 'Salário',
        amount: cents(500000),
        kind: 'normal',
        sortOrder: 0,
      },
    ],
    invoices: [invoice({ otherAmount: cents(3000) })],
    plans: [
      plan({ id: 'meu' }),
      plan({ id: 'do-pai', installmentAmount: cents(4000), forOther: true }),
      plan({ id: 'pai-fora', cardId: null, forOther: true }),
      plan({ id: 'meu-fora', cardId: null, installmentAmount: cents(700) }),
    ],
    subscriptions: [
      { id: 'sub', cardId: 'card', amount: cents(2000), active: true },
    ],
    expenses: [
      { invoiceId: 'invoice', amount: cents(1200) },
      { invoiceId: 'invoice', amount: cents(800), forOther: true },
    ],
  })

describe('gastos de quem usa o cartão junto', () => {
  it('a fatura é o total do banco; a parte do pai sai da sua', () => {
    // 100 + 40 (pai) + 20 + 12 + 8 (pai) + 30 = 210.
    expect(
      invoiceTotals(invoice({ otherAmount: cents(3000) }), data(true)),
    ).toMatchObject({ total: 21000, otherShare: 7800, mine: 13200 })
    // Without "outros é do pai" the rest stays the owner's.
    expect(
      invoiceTotals(invoice({ otherAmount: cents(3000) }), data(false)),
    ).toMatchObject({ total: 21000, otherShare: 4800, mine: 16200 })
  })

  it('fatura paga com total menor que a parte do pai: a sua fica zero', () => {
    const paid = invoice({
      otherAmount: cents(3000),
      paid: true,
      paidOn: isoDate('2026-09-10'),
      closedTotal: cents(5000),
    })
    expect(invoiceTotals(paid, data(true)).mine).toBe(0)
  })

  it('o saldo do mês conta só a sua parte e as suas parcelas fora do cartão', () => {
    expect(monthBalance(sep, data(true))).toMatchObject({
      outflows: 13900,
      available: 486100,
    })
  })

  it('as saídas do mês somam o mesmo que o saldo, sem nada do pai', () => {
    const items = monthOutflowItems(sep, {
      ...data(true),
      bills: [],
      expenses: [
        { id: 'gasto-meu', invoiceId: 'invoice', amount: cents(1200) },
        {
          id: 'gasto-pai',
          invoiceId: 'invoice',
          amount: cents(800),
          forOther: true,
        },
      ],
    })
    expect(items.map((item) => item.id)).toEqual([
      'meu-fora',
      'meu',
      'sub',
      'gasto-meu',
    ])
    expect(sumMoney(items.map((item) => item.amount))).toBe(13900)
    expect(items.some((item) => item.source === 'other')).toBe(false)
  })

  it('vistas pelo pai: as compras e parcelas dele e o "outros"', () => {
    const items = monthOutflowItems(sep, {
      ...data(true),
      viewAs: 'other',
      bills: [
        {
          id: 'luz',
          month: sep,
          description: 'Luz',
          amount: cents(9000),
          paid: false,
          paidOn: null,
          sortOrder: 0,
        },
      ],
      expenses: [
        { id: 'gasto-meu', invoiceId: 'invoice', amount: cents(1200) },
        {
          id: 'gasto-pai',
          invoiceId: 'invoice',
          amount: cents(800),
          forOther: true,
        },
      ],
    })
    expect(items.map((item) => [item.source, item.id])).toEqual([
      ['installment', 'pai-fora'],
      ['installment', 'do-pai'],
      ['expense', 'gasto-pai'],
      ['other', 'invoice'],
    ])
    // 100 (outside) + 40 + 8 + 30 of "outros".
    expect(sumMoney(items.map((item) => item.amount))).toBe(17800)
  })
})
