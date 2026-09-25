import { describe, expect, it } from 'vitest'
import { emptyData, seedData } from './__fixtures__/seed'
import { cents } from './money'
import { month } from './months'
import { advanceCounter, newMonthDraft, type NewMonthOptions } from './newMonth'

const options: NewMonthOptions = {
  target: month('2026-12'),
  previous: month('2026-11'),
  cardIds: ['card-1', 'card-2'],
  copy: true,
  carryover: true,
}

describe('criação de mês', () => {
  it.each([
    ['iPhone 2/12', 'iPhone 3/12'],
    ['iPhone 12/12', 'iPhone 12/12'],
    ['Parcela 119/120', 'Parcela 120/120'],
    ['2/12 e 4/8', '3/12 e 4/8'],
    ['Sem contador', 'Sem contador'],
    ['0/12', '0/12'],
    ['2/999', '2/999'],
  ])('avança %s para %s', (input, expected) =>
    expect(advanceCounter(input)).toBe(expected),
  )
  it('copia valores, limpa pagamentos e cria uma estimativa por cartão sem gastos antigos', () => {
    const data = seedData()
    const before = structuredClone(data)
    const draft = newMonthDraft(options, data)
    expect(draft.incomes.map((item) => item.amount)).toEqual([
      200000, 10000, 124166,
    ])
    expect(
      draft.bills.map((item) => [item.amount, item.paid, item.paidOn]),
    ).toEqual([
      [50000, false, null],
      [8000, false, null],
    ])
    expect(draft.invoices).toHaveLength(2)
    expect(
      draft.invoices.every(
        (item) =>
          item.estimated &&
          !item.paid &&
          item.closedTotal === null &&
          item.otherAmount === 0,
      ),
    ).toBe(true)
    expect(draft).not.toHaveProperty('plans')
    expect(draft).not.toHaveProperty('expenses')
    expect(draft.invoices[0]).not.toHaveProperty('id')
    expect(data).toEqual(before)
  })
  it('avança descrições e observações mas nunca passa da última parcela', () => {
    const data = seedData()
    const updated = {
      ...data,
      incomes: data.incomes.map((item) => ({
        ...item,
        description: 'Freela 2/3',
      })),
      bills: data.bills.map((item) => ({
        ...item,
        description: 'iPhone 12/12',
      })),
      invoices: data.invoices.map((item) => ({
        ...item,
        cardId: 'card-1',
        note: 'Curso 2/12',
      })),
    }
    const draft = newMonthDraft(options, updated)
    expect(draft.incomes[0]?.description).toBe('Freela 3/3')
    expect(draft.bills[0]?.description).toBe('iPhone 12/12')
    expect(draft.invoices[0]?.note).toBe('Curso 3/12')
    expect(draft.invoices[1]?.note).toBeNull()
  })
  it('substitui a sobra antiga pelo saldo atual, inclusive negativo', () => {
    const data = emptyData({
      incomes: [
        {
          month: month('2026-11'),
          description: 'Sobrou',
          amount: cents(-100),
          kind: 'carryover',
          sortOrder: 0,
        },
      ],
    })
    expect(newMonthDraft(options, data).incomes).toEqual([
      {
        month: '2026-12',
        description: 'Sobrou do mês passado',
        amount: -100,
        kind: 'carryover',
        sortOrder: 0,
      },
    ])
    expect(
      newMonthDraft({ ...options, carryover: false }, data).incomes,
    ).toEqual([])
  })
  it('permite copiar sem sobra, levar só sobra, ou criar primeiro mês', () => {
    expect(
      newMonthDraft({ ...options, carryover: false }, seedData()).incomes,
    ).toHaveLength(2)
    const carryOnly = newMonthDraft({ ...options, copy: false }, seedData())
    expect(carryOnly.incomes).toHaveLength(1)
    expect(carryOnly.bills).toEqual([])
    const first = newMonthDraft(
      { ...options, previous: null, copy: false },
      emptyData(),
    )
    expect(first.incomes).toEqual([])
    expect(first.bills).toEqual([])
    expect(first.invoices).toHaveLength(2)
  })
  it('recusa saltar meses ou duplicar cartões', () => {
    expect(() =>
      newMonthDraft({ ...options, previous: month('2026-10') }, seedData()),
    ).toThrow()
    expect(() =>
      newMonthDraft({ ...options, cardIds: ['card', 'card'] }, seedData()),
    ).toThrow()
  })
})
