import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import { monthBalance, personBalance } from './balance'
import { monthOutflowItems } from './categories'
import { chartSeries, partOf, partPerson } from './chartSeries'
import { invoiceTotals, peopleParts } from './invoices'
import { cents, sumMoney } from './money'
import { isoDate, month } from './months'
import { isOwners, ME, OTHER, whoFields, whoOf } from './people'

// Besides the other person ("Pai"), who keeps the rest of the bank's total,
// the owner's list has people who only owe what was marked as theirs.
const sep = month('2026-09')
const base = (bankTotal: number | null = null) => ({
  ...emptyData({
    incomes: [
      {
        month: sep,
        description: 'Salário',
        amount: cents(500000),
        kind: 'normal' as const,
        sortOrder: 0,
      },
    ],
    invoices: [
      invoice({
        otherAmount: cents(3000),
        bankTotal: bankTotal === null ? null : cents(bankTotal),
      }),
    ],
    plans: [
      plan({ id: 'meu' }),
      plan({ id: 'do-pai', installmentAmount: cents(4000), forOther: true }),
    ],
    subscriptions: [
      { id: 'sub', cardId: 'card', amount: cents(2000), active: true },
    ],
  }),
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
  otherPerson: 'Pai',
  otherBankUntil: month('2100-01'),
})
const withPeople = (bankTotal: number | null = null) => {
  const data = base(bankTotal)
  return {
    ...data,
    plans: [
      ...data.plans,
      plan({ id: 'do-vini', installmentAmount: cents(5000), personId: 'vini' }),
      plan({
        id: 'vini-fora',
        cardId: null,
        installmentAmount: cents(900),
        personId: 'vini',
      }),
    ],
    expenses: [
      ...data.expenses,
      {
        id: 'gasto-vini',
        invoiceId: 'invoice',
        amount: cents(16151),
        personId: 'vini',
      },
      {
        id: 'gasto-prima',
        invoiceId: 'invoice',
        amount: cents(1000),
        personId: 'prima',
      },
    ],
  }
}
const totals = (
  data: Parameters<typeof invoiceTotals>[1] & ReturnType<typeof emptyData>,
) => invoiceTotals(data.invoices[0]!, data)

describe('compras de outras pessoas', () => {
  it('não mudam a sua parte nem o seu saldo', () => {
    const before = base()
    const after = withPeople()
    expect(totals(after).mine).toBe(totals(before).mine)
    expect(monthBalance(sep, after)).toEqual(monthBalance(sep, before))
    expect(totals(after).total).toBe(totals(before).total + 22151)
    expect(totals(after).peopleShare).toBe(22151)
  })

  it('o Pai fica com o resto do banco depois delas', () => {
    expect(totals(base(60000))).toMatchObject({
      mine: 16200,
      otherShare: 43800,
    })
    expect(totals(withPeople(60000))).toMatchObject({
      mine: 16200,
      peopleShare: 22151,
      otherShare: 21649,
    })
    // A bank total too low never takes away what was marked his.
    expect(totals(withPeople(1000)).otherShare).toBe(4800)
  })

  it('sem total do banco, o Pai é só o que foi marcado dele', () => {
    expect(totals(withPeople()).otherShare).toBe(4800)
  })

  it('a parte de cada pessoa, com parcela e compra somadas', () => {
    const data = withPeople()
    expect(peopleParts(data.invoices[0]!, data)).toEqual([
      { personId: 'vini', amount: 21151 },
      { personId: 'prima', amount: 1000 },
    ])
    expect(peopleParts(base().invoices[0]!, base())).toEqual([])
  })

  it('fatura paga com total menor: a sua fica zero', () => {
    const data = withPeople()
    const paid = {
      ...data,
      invoices: [
        invoice({
          paid: true,
          paidOn: isoDate('2026-09-10'),
          closedTotal: cents(1000),
        }),
      ],
    }
    expect(totals(paid).mine).toBe(0)
  })

  it('as suas saídas e as do Pai não trazem as delas', () => {
    const data = withPeople()
    const mine = monthOutflowItems(sep, data)
    expect(mine.map((item) => item.id)).not.toContain('gasto-vini')
    expect(mine.map((item) => item.id)).not.toContain('do-vini')
    expect(mine.map((item) => item.id)).not.toContain('vini-fora')
    expect(sumMoney(mine.map((item) => item.amount))).toBe(
      monthBalance(sep, data).outflows,
    )
    const his = monthOutflowItems(sep, { ...data, viewAs: 'other' })
    expect(his.map((item) => item.id).sort()).toEqual(['do-pai', 'gasto-pai'])
  })

  it('a previsão do gráfico também separa', () => {
    const data = withPeople()
    const october = (part: 'mine' | 'other' | 'total') =>
      chartSeries('card', sep, data, part).find(
        (item) => item.month === '2026-10',
      )?.total
    expect(october('mine')).toBe(12000)
    expect(october('other')).toBe(4000)
    expect(october('total')).toBe(21000)
  })
})

describe('de quem é', () => {
  it('lê e grava os dois campos', () => {
    expect(whoOf({})).toBe(ME)
    expect(whoOf({ forOther: true })).toBe(OTHER)
    expect(whoOf({ personId: 'vini' })).toBe('vini')
    expect(whoFields(ME)).toEqual({ forOther: false, personId: null })
    expect(whoFields(OTHER)).toEqual({ forOther: true, personId: null })
    expect(whoFields('vini')).toEqual({ forOther: false, personId: 'vini' })
  })

  it('é seu só quando não é de mais ninguém', () => {
    expect(isOwners({})).toBe(true)
    expect(isOwners({ forOther: false, personId: null })).toBe(true)
    expect(isOwners({ forOther: true })).toBe(false)
    expect(isOwners({ personId: 'vini' })).toBe(false)
  })
})

describe('vendo como uma pessoa da lista', () => {
  const paidBack = (amount: number, personId?: string) => ({
    month: sep,
    description: 'pagou',
    amount: cents(amount),
    kind: 'from_other' as const,
    sortOrder: 9,
    ...(personId && { personId }),
  })

  it('só o que é dela, sem resto de fatura nem assinatura', () => {
    const data = withPeople()
    const hers = monthOutflowItems(sep, { ...data, viewPerson: 'vini' })
    expect(hers.map((item) => item.id).sort()).toEqual([
      'do-vini',
      'gasto-vini',
      'vini-fora',
    ])
    expect(
      monthOutflowItems(sep, { ...data, viewPerson: 'prima' }).map(
        (item) => item.id,
      ),
    ).toEqual(['gasto-prima'])
  })

  it('quanto deve, com o que ficou fora do cartão', () => {
    const data = withPeople()
    expect(personBalance(sep, data, 'vini')).toEqual({
      owed: 22051,
      due: 22051,
    })
    expect(personBalance(sep, data, 'ninguem')).toEqual({ owed: 0, due: 0 })
  })

  it('o que ela devolve não acerta o Pai nem entra nas suas entradas', () => {
    const data = withPeople()
    const paid = {
      ...data,
      incomes: [...data.incomes, paidBack(10000, 'vini')],
    }
    expect(personBalance(sep, paid, 'vini').due).toBe(12051)
    expect(personBalance(sep, paid, 'prima').due).toBe(1000)
    expect(monthBalance(sep, paid)).toEqual(monthBalance(sep, data))
    const paidMore = {
      ...data,
      incomes: [...data.incomes, paidBack(99999, 'vini')],
    }
    expect(personBalance(sep, paidMore, 'vini').due).toBe(0)
    const fromPai = { ...data, incomes: [...data.incomes, paidBack(1000)] }
    expect(monthBalance(sep, fromPai).otherDue).toBe(
      monthBalance(sep, data).otherDue - 1000,
    )
    expect(personBalance(sep, fromPai, 'vini').due).toBe(22051)
  })

  it('o gráfico e a parte da fatura', () => {
    const data = withPeople()
    expect(partPerson('person:vini')).toBe('vini')
    expect(partPerson('mine')).toBeNull()
    const totalsOf = totals(data)
    expect(partOf(totalsOf, 'person:vini')).toBe(21151)
    expect(partOf(totalsOf, 'person:ninguem')).toBe(0)
    const october = chartSeries('card', sep, data, 'person:vini').find(
      (item) => item.month === '2026-10',
    )
    expect(october?.total).toBe(5000)
  })
})
