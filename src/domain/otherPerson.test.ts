import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import { monthBalance } from './balance'
import { monthOutflowItems } from './categories'
import { invoiceTotals } from './invoices'
import { cents, sumMoney } from './money'
import { isoDate, month } from './months'

// Fase 13.3: the owner's father uses some of the same cards. The owner
// launches what is theirs ("outros" included); what the father bought is
// marked, and on the cards he uses, the whole invoice at the bank tells the
// rest of his part.
const sep = month('2026-09')
const data = (bankTotal: number | null = null, withOther = true) =>
  emptyData({
    incomes: [
      {
        month: sep,
        description: 'Salário',
        amount: cents(500000),
        kind: 'normal',
        sortOrder: 0,
      },
    ],
    invoices: [
      invoice({
        otherAmount: cents(3000),
        bankTotal: bankTotal === null ? null : cents(bankTotal),
      }),
    ],
    otherPerson: withOther ? 'Pai' : null,
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
const withIds = (base: ReturnType<typeof data>) => ({
  ...base,
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

describe('gastos de quem usa o cartão junto', () => {
  it('o "outros" é seu; a parte do pai é o que foi marcado dele', () => {
    // 100 + 40 (his) + 20 + 12 + 8 (his) + 30 of "outros" = 210.
    expect(
      invoiceTotals(invoice({ otherAmount: cents(3000) }), data()),
    ).toMatchObject({ total: 21000, mine: 16200, otherShare: 4800 })
  })

  it('com o total do banco, a parte dele é o total menos o seu, em qualquer cartão', () => {
    const totals = (bank: number, withOther = true) => {
      const base = data(bank, withOther)
      return invoiceTotals(base.invoices[0]!, base)
    }
    expect(totals(30000)).toMatchObject({ mine: 16200, otherShare: 13800 })
    // A bank total below the owner's never takes away what was marked his.
    expect(totals(10000).otherShare).toBe(4800)
    // Without anyone else (a normal user): only what was marked.
    expect(totals(30000, false).otherShare).toBe(4800)
  })

  it('fatura paga com total menor que o marcado dele: a sua fica zero', () => {
    const paid = invoice({
      otherAmount: cents(3000),
      paid: true,
      paidOn: isoDate('2026-09-10'),
      closedTotal: cents(4000),
    })
    expect(invoiceTotals(paid, data()).mine).toBe(0)
  })

  it('o saldo conta só a sua parte; o que o pai deve é um lembrete à parte', () => {
    // 162 of the invoice + 7 (yours, outside).
    expect(monthBalance(sep, data())).toMatchObject({
      incomes: 500000,
      outflows: 16900,
      available: 483100,
      otherOwed: 14800,
      otherDue: 14800,
    })
    expect(monthBalance(sep, data(30000)).otherOwed).toBe(23800)
    const paidBack = (...amounts: number[]) => ({
      ...data(),
      incomes: [
        ...data().incomes,
        ...amounts.map((amount, index) => ({
          month: sep,
          description: 'Pai pagou',
          amount: cents(amount),
          kind: 'from_other' as const,
          sortOrder: index + 1,
        })),
      ],
    })
    // What he sends back settles his part; it is not your income.
    expect(monthBalance(sep, paidBack(5000))).toMatchObject({
      incomes: 500000,
      otherDue: 9800,
    })
    expect(monthBalance(sep, paidBack(5000, 20000)).otherDue).toBe(0)
  })

  it('as suas saídas somam o mesmo que o saldo, com o seu "outros"', () => {
    const items = monthOutflowItems(sep, withIds(data()))
    expect(items.map((item) => [item.source, item.id])).toEqual([
      ['installment', 'meu-fora'],
      ['installment', 'meu'],
      ['subscription', 'sub'],
      ['expense', 'gasto-meu'],
      ['other', 'invoice'],
    ])
    expect(sumMoney(items.map((item) => item.amount))).toBe(16900)
  })

  it('vistas pelo pai: o que é dele, e o resto da fatura do banco', () => {
    const seen = (bank: number | null) =>
      monthOutflowItems(sep, { ...withIds(data(bank)), viewAs: 'other' })
    expect(seen(null).map((item) => [item.source, item.id])).toEqual([
      ['installment', 'pai-fora'],
      ['installment', 'do-pai'],
      ['expense', 'gasto-pai'],
    ])
    const withBank = seen(30000)
    expect(withBank.at(-1)).toMatchObject({ source: 'other', amount: 9000 })
    // 100 (outside) + 138 of the bill.
    expect(sumMoney(withBank.map((item) => item.amount))).toBe(23800)
  })
})
