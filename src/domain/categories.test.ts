import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan, seedData } from './__fixtures__/seed'
import { monthBalance } from './balance'
import {
  CATEGORY_KEYWORDS,
  CATEGORY_PALETTE,
  DEFAULT_CATEGORIES,
  groupByCategory,
  keywordCategory,
  monthOutflowItems,
  nextCategoryColor,
  normalizeText,
  suggestCategory,
  suggestExisting,
  UNCATEGORIZED,
  UNDETAILED,
  type Category,
  type CategoryData,
} from './categories'
import { cents } from './money'
import { isoDate, month } from './months'

const categories: Category[] = DEFAULT_CATEGORIES.map((item, index) => ({
  id: `cat-${index}`,
  name: item.name,
  color: item.color,
  sortOrder: index,
}))
const idOf = (name: string) => categories.find((item) => item.name === name)!.id

describe('lista padrão e cores', () => {
  it('nove categorias, com Outros no fim e cores #RRGGBB', () => {
    expect(DEFAULT_CATEGORIES.map((item) => item.name)).toEqual([
      'Alimentação',
      'Transporte',
      'Moradia',
      'Saúde',
      'Lazer',
      'Compras',
      'Educação',
      'Assinaturas',
      'Outros',
    ])
    for (const item of [
      ...DEFAULT_CATEGORIES.map((c) => c.color),
      ...CATEGORY_PALETTE,
    ])
      expect(item).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('palavras-chave só apontam pra categorias da lista padrão', () => {
    const names = DEFAULT_CATEGORIES.map((item) => item.name)
    for (const name of Object.keys(CATEGORY_KEYWORDS))
      expect(names).toContain(name)
  })

  it('cor da próxima categoria: a primeira livre, depois dá a volta', () => {
    expect(nextCategoryColor([])).toBe(CATEGORY_PALETTE[0])
    expect(
      nextCategoryColor(
        DEFAULT_CATEGORIES.map((item) => item.color.toLowerCase()),
      ),
    ).toBe('#AE3EC9')
    const all = [...CATEGORY_PALETTE, '#000000']
    expect(nextCategoryColor(all)).toBe(CATEGORY_PALETTE[1])
  })
})

describe('sugestão pelo nome', () => {
  it('normaliza acentos, maiúsculas e pontuação', () => {
    expect(normalizeText('  Almoço — iFood!! ')).toBe('almoco ifood')
  })

  it.each([
    ['Uber', 'Transporte'],
    ['uber pra casa', 'Transporte'],
    ['iFood', 'Alimentação'],
    ['Conta de luz', 'Moradia'],
    ['Água', 'Moradia'],
    ['Netflix', 'Assinaturas'],
    ['Amazon Prime', 'Assinaturas'],
    ['Amazon', 'Compras'],
    ['Mercado Livre', 'Compras'],
    ['Mercado', 'Alimentação'],
    ['iPhone 2/12', 'Compras'],
    ['Dentista', 'Saúde'],
    ['Curso de inglês', 'Educação'],
    ['Cinema', 'Lazer'],
  ])('"%s" vira %s', (description, name) => {
    expect(keywordCategory(description)).toBe(name)
  })

  it('só palavra inteira: "Netflix" não é "net", "Gasolina" não é "gás"', () => {
    expect(keywordCategory('Barbearia')).toBeNull()
    expect(keywordCategory('Gasolina')).toBe('Transporte')
    expect(keywordCategory('Seguro')).toBeNull()
    expect(keywordCategory('')).toBeNull()
  })

  it('usa a lista da pessoa, pelo nome, mesmo renomeada em caixa diferente', () => {
    const own: Category[] = [
      { id: 'x', name: 'transporte', color: '#000000', sortOrder: 0 },
    ]
    expect(suggestCategory('Uber', own)).toBe('x')
    expect(suggestCategory('iFood', own)).toBeNull()
  })

  it('o que a pessoa escolheu antes pro mesmo nome vence a palavra-chave', () => {
    const history = [
      { description: 'Uber', categoryId: idOf('Lazer') },
      { description: 'Padaria', categoryId: null },
      { description: 'uber', categoryId: idOf('Compras') },
    ]
    expect(suggestCategory('UBER', categories, history)).toBe(idOf('Compras'))
    expect(suggestCategory('Padaria', categories, history)).toBe(
      idOf('Alimentação'),
    )
  })

  it('ignora escolhas antigas de categoria que já foi apagada', () => {
    const history = [{ description: 'Uber', categoryId: 'apagada' }]
    expect(suggestCategory('Uber', categories, history)).toBe(
      idOf('Transporte'),
    )
  })

  it('sem descrição, sem sugestão', () => {
    expect(suggestCategory('   ', categories)).toBeNull()
  })

  it('itens antigos: só os sem categoria e que a palavra-chave reconhece', () => {
    const result = suggestExisting(
      [
        { id: '1', description: 'Conta de luz' },
        { id: '2', description: 'Uber', categoryId: idOf('Lazer') },
        { id: '3', description: 'Coisa qualquer', categoryId: null },
      ],
      categories,
    )
    expect([...result]).toEqual([['1', idOf('Moradia')]])
  })
})

describe('pra onde foi o dinheiro', () => {
  const withIds = (): CategoryData => {
    const data = seedData()
    return {
      ...data,
      bills: data.bills.map((item, index) => ({ ...item, id: `b${index}` })),
      expenses: data.expenses.map((item, index) => ({
        ...item,
        id: `e${index}`,
      })),
    }
  }

  it.each(['2026-08', '2026-09', '2026-10', '2026-11'])(
    '%s: as partes somam exatamente as saídas do mês',
    (ref) => {
      const data = withIds()
      const items = monthOutflowItems(month(ref), data)
      expect(items.reduce((sum, item) => sum + item.amount, 0)).toBe(
        monthBalance(month(ref), data).outflows,
      )
    },
  )

  const sep = month('2026-09')
  const data: CategoryData = emptyData({
    bills: [
      {
        month: sep,
        description: 'Luz',
        amount: cents(18035),
        paid: false,
        paidOn: null,
        sortOrder: 0,
      },
    ],
  }) as CategoryData

  it('cada parte leva a categoria do que veio: conta, gasto, parcela, assinatura', () => {
    const input: CategoryData = {
      ...data,
      bills: [{ ...data.bills[0]!, id: 'luz', categoryId: 'moradia' }],
      plans: [
        plan({
          id: 'note',
          cardId: 'card',
          categoryId: 'compras',
          installmentAmount: cents(12000),
          firstMonth: month('2026-08'),
        }),
        plan({
          id: 'dent',
          cardId: null,
          categoryId: null,
          installmentAmount: cents(15000),
          totalInstallments: 4,
          firstMonth: month('2026-08'),
        }),
      ],
      subscriptions: [
        {
          id: 'stream',
          cardId: 'card',
          amount: cents(3990),
          active: true,
          categoryId: 'assinaturas',
        },
        { id: 'off', cardId: 'card', amount: cents(999), active: false },
      ],
      invoices: [invoice({ otherAmount: cents(27102) })],
      expenses: [
        {
          id: 'uber',
          invoiceId: 'invoice',
          amount: cents(1200),
          categoryId: 'transporte',
        },
      ],
    }
    const items = monthOutflowItems(sep, input)
    expect(
      items.map(({ source, id, amount, categoryId, cardId, number }) => [
        source,
        id,
        amount,
        categoryId,
        cardId,
        number,
      ]),
    ).toEqual([
      ['bill', 'luz', 18035, 'moradia', null, undefined],
      ['installment', 'dent', 15000, null, null, 2],
      ['installment', 'note', 12000, 'compras', 'card', 2],
      ['subscription', 'stream', 3990, 'assinaturas', 'card', undefined],
      ['expense', 'uber', 1200, 'transporte', 'card', undefined],
      ['other', 'invoice', 27102, null, 'card', undefined],
    ])

    const groups = groupByCategory(items)
    expect(groups.map((group) => [group.key, group.amount])).toEqual([
      ['moradia', 18035],
      ['compras', 12000],
      ['assinaturas', 3990],
      ['transporte', 1200],
      [UNCATEGORIZED, 15000],
      [UNDETAILED, 27102],
    ])
    const total = 18035 + 15000 + 12000 + 3990 + 1200 + 27102
    expect(groups[0]!.share).toBeCloseTo(18035 / total)
  })

  it('fatura paga com total congelado: o que sobra vai pra "sem detalhe"', () => {
    const input: CategoryData = {
      ...emptyData(),
      bills: [],
      expenses: [
        { id: 'e', invoiceId: 'invoice', amount: cents(5000), categoryId: 'x' },
      ],
      invoices: [
        invoice({
          otherAmount: cents(0),
          paid: true,
          paidOn: isoDate('2026-09-10'),
          closedTotal: cents(8000),
        }),
      ],
    }
    const groups = groupByCategory(monthOutflowItems(sep, input))
    expect(groups.map((group) => [group.key, group.amount])).toEqual([
      ['x', 5000],
      [UNDETAILED, 3000],
    ])
  })

  it('sem nada detalhado, a fatura inteira fica sem detalhe; grupos zerados somem', () => {
    const input: CategoryData = {
      ...emptyData(),
      bills: [],
      expenses: [],
      invoices: [invoice({ otherAmount: cents(0) })],
    }
    expect(monthOutflowItems(sep, input)).toEqual([])
    expect(groupByCategory([])).toEqual([])
    expect(
      groupByCategory([
        {
          source: 'other',
          id: 'i',
          cardId: 'c',
          amount: cents(-100),
          categoryId: null,
        },
      ]),
    ).toEqual([])
  })

  it('empate de valor: ordem estável pela chave', () => {
    const item = (id: string, categoryId: string) => ({
      source: 'bill' as const,
      id,
      cardId: null,
      amount: cents(100),
      categoryId,
    })
    expect(
      groupByCategory([item('1', 'b'), item('2', 'a')]).map((g) => g.key),
    ).toEqual(['a', 'b'])
  })
})
