import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import { monthBalance } from './balance'
import { UNCATEGORIZED } from './categories'
import { cents } from './money'
import { isoDate, month } from './months'
import {
  buildTimeline,
  dayLabel,
  instantToSaoPaulo,
  categoryChanges,
  matchesFilter,
  monthTimeline,
  NO_CARD_FILTER,
  saoPauloToInstant,
  timeLabel,
  type TimelineData,
} from './timeline'

const sep = month('2026-09')
const aug = month('2026-08')

describe('hora de São Paulo', () => {
  it('o que se digita vira o instante certo, e volta igual', () => {
    const instant = saoPauloToInstant('2026-09-26T14:30')
    expect(instant).toBe('2026-09-26T17:30:00.000Z')
    expect(instantToSaoPaulo(instant)).toBe('2026-09-26T14:30')
    expect(timeLabel(instant)).toBe('14:30')
  })

  it('perto da meia-noite, o dia é o de São Paulo', () => {
    expect(instantToSaoPaulo('2026-09-04T01:30:00Z')).toBe('2026-09-03T22:30')
  })

  it('recusa o que não é data e hora', () => {
    expect(() => saoPauloToInstant('26/09/2026 14:30')).toThrow(RangeError)
    expect(() => saoPauloToInstant('2026-13-40T99:99')).toThrow(RangeError)
  })

  it.each([
    ['2026-09-26', 'Hoje'],
    ['2026-09-25', 'Ontem'],
    ['2026-09-21', 'seg, 21 set'],
    ['2026-09-06', 'dom, 6 set'],
  ])('%s é "%s"', (day, label) => {
    expect(dayLabel(isoDate(day), isoDate('2026-09-26'))).toBe(label)
  })

  it('"Ontem" atravessa a virada do mês', () => {
    expect(dayLabel(isoDate('2026-09-30'), isoDate('2026-10-01'))).toBe('Ontem')
  })
})

/** September: timed card expenses, a date-only one, a timed bill, fixed things. */
function september(): TimelineData {
  return {
    ...emptyData(),
    bills: [
      {
        id: 'luz',
        month: sep,
        description: 'Luz',
        amount: cents(18035),
        paid: false,
        paidOn: null,
        sortOrder: 0,
        categoryId: 'moradia',
        occurredAt: '2026-09-02T15:00:00Z',
      },
      {
        id: 'antiga',
        month: sep,
        description: 'Conta da v1',
        amount: cents(9990),
        paid: true,
        paidOn: isoDate('2026-09-10'),
        sortOrder: 1,
      },
    ],
    expenses: [
      {
        id: 'uber',
        invoiceId: 'invoice',
        amount: cents(1200),
        categoryId: 'transporte',
        spentOn: isoDate('2026-09-03'),
        occurredAt: '2026-09-04T01:30:00Z',
      },
      {
        id: 'ifood',
        invoiceId: 'invoice',
        amount: cents(4500),
        categoryId: 'alimentacao',
        spentOn: isoDate('2026-09-03'),
        occurredAt: '2026-09-03T15:10:00Z',
      },
      {
        id: 'velho',
        invoiceId: 'invoice',
        amount: cents(800),
        spentOn: isoDate('2026-09-03'),
      },
      { id: 'sem-dia', invoiceId: 'invoice', amount: cents(300) },
    ],
    plans: [
      plan({
        id: 'note',
        categoryId: 'compras',
        installmentAmount: cents(12000),
        firstMonth: aug,
      }),
    ],
    subscriptions: [
      { id: 'stream', cardId: 'card', amount: cents(3990), active: true },
    ],
    invoices: [invoice({ otherAmount: cents(27102) })],
  }
}

describe('Por data', () => {
  it('dias do mais novo pro mais velho; no dia, a hora mais nova primeiro e sem hora no fim', () => {
    const { days, fixed } = monthTimeline(sep, september())
    expect(
      days.map((day) => [day.day, day.total, day.items.map((item) => item.id)]),
    ).toEqual([
      // 22:30 of the 3rd in São Paulo, though the 4th in UTC.
      ['2026-09-03', 6500, ['uber', 'ifood', 'velho']],
      ['2026-09-02', 18035, ['luz']],
    ])
    expect(days[0]!.items[0]!.at).toBe('2026-09-04T01:30:00Z')
    expect(days[0]!.items[2]!.at).toBeNull()
    expect(fixed.map((item) => [item.source, item.id])).toEqual([
      ['other', 'invoice'],
      ['installment', 'note'],
      ['bill', 'antiga'],
      ['subscription', 'stream'],
      ['expense', 'sem-dia'],
    ])
  })

  it('tudo junto soma exatamente as saídas do mês', () => {
    const data = september()
    const { days, fixed } = monthTimeline(sep, data)
    const total =
      days.reduce((sum, day) => sum + day.total, 0) +
      fixed.reduce((sum, item) => sum + item.amount, 0)
    expect(total).toBe(monthBalance(sep, data).outflows)
  })

  it('filtra por cartão, fora do cartão e categoria', () => {
    const data = september()
    const ids = (filter: Parameters<typeof monthTimeline>[2]) => {
      const { days, fixed } = monthTimeline(sep, data, filter)
      return [
        ...days.flatMap((day) => day.items.map((item) => item.id)),
        ...fixed.map((item) => item.id),
      ]
    }
    expect(ids({ cardId: NO_CARD_FILTER, categoryId: null })).toEqual([
      'luz',
      'antiga',
    ])
    expect(ids({ cardId: 'card', categoryId: 'transporte' })).toEqual(['uber'])
    // The undetailed part has no category, so a category filter hides it.
    expect(ids({ cardId: null, categoryId: UNCATEGORIZED })).toEqual([
      'velho',
      'antiga',
      'stream',
      'sem-dia',
    ])
    expect(
      matchesFilter(
        {
          source: 'other',
          id: 'i',
          cardId: 'card',
          amount: cents(1),
          categoryId: null,
        },
        { cardId: 'card', categoryId: null },
      ),
    ).toBe(true)
  })
})

describe('mudança contra o mês anterior', () => {
  const august = (amount: number): TimelineData => {
    const data = september()
    return {
      ...data,
      expenses: [],
      invoices: [...data.invoices, invoice({ id: 'invoice-ago', month: aug })],
      bills: [
        ...data.bills,
        {
          id: 'luz-ago',
          month: aug,
          description: 'Luz',
          amount: cents(amount),
          paid: true,
          paidOn: isoDate('2026-08-10'),
          sortOrder: 0,
          categoryId: 'moradia',
        },
      ],
    }
  }

  it('subiu, desceu ou ficou igual, por categoria e em "Sem categoria"', () => {
    const result = categoryChanges(sep, august(10000))!
    expect(result.previous).toBe(aug)
    // Moradia 180,35 against 100; Sem categoria gains the v1 bill (99,90);
    // Compras (Notebook) and Assinaturas are the same both months.
    expect([...result.changes]).toEqual([
      ['moradia', 8035],
      [UNCATEGORIZED, 9990],
    ])
    expect([...categoryChanges(sep, august(40000))!.changes]).toContainEqual([
      'moradia',
      -21965,
    ])
  })

  it('mudança pequena não aparece', () => {
    expect(categoryChanges(sep, august(17000))!.changes.has('moradia')).toBe(
      false,
    )
  })

  it('sem mês anterior, nada pra comparar', () => {
    expect(categoryChanges(sep, september())).toBeNull()
  })
})

describe('ordem dentro do dia', () => {
  it('mesma hora: o maior primeiro; sem hora: o maior primeiro, depois dos com hora', () => {
    const item = (id: string, amount: number, at: string | null) => ({
      source: 'expense' as const,
      id,
      cardId: 'card',
      amount: cents(amount),
      categoryId: null,
      day: isoDate('2026-09-03'),
      at,
    })
    const { days } = buildTimeline(
      [
        item('a', 100, null),
        item('b', 300, '2026-09-03T12:00:00Z'),
        item('c', 900, '2026-09-03T12:00:00Z'),
        item('d', 500, null),
      ],
      [],
    )
    expect(days[0]!.items.map((entry) => entry.id)).toEqual([
      'c',
      'b',
      'd',
      'a',
    ])
  })
})
