import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey, type Finance } from '../../data/finance'
import { fakeSupabase } from '../../test/fakeSupabase'
import { categoryId, financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'

// Fase 11: categories in Meses, Lançar, the editors and Ajustes.
const fake = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('../../test/fakeSupabase').fakeSupabase
  > | null,
  latest: null as (() => unknown) | null,
}))
vi.mock('../../data/supabase', () => ({
  supabase: () => fake.current!.client,
}))
vi.mock('../../data/finance', async (original) => ({
  ...(await original<typeof import('../../data/finance')>()),
  loadFinance: () => Promise.resolve(fake.latest!()),
}))

beforeEach(() => {
  fake.current = fakeSupabase()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-15T12:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

function renderApp(...args: Parameters<typeof render>) {
  const result = render(...args)
  fake.latest = () => result.client.getQueryData(financeKey('u1'))
  return result
}
const cached = (client: ReturnType<typeof renderApp>['client']) =>
  client.getQueryData<Finance>(financeKey('u1'))!
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const spaced = (value: string | null | undefined) => value?.replace(/\s/g, ' ')
const writes = () => fake.current!.calls.filter((call) => call.op !== 'select')
const dialog = (name: string) => screen.getByRole('dialog', { name })
const block = () =>
  screen.getByRole('region', { name: 'Para onde foi o dinheiro' })
const rows = () =>
  within(block())
    .getAllByRole('button', { expanded: false })
    .map((row) => spaced(row.textContent))

describe('Para onde foi o dinheiro', () => {
  it('setembro por categoria, somando as saídas do mês (R$ 873,17)', () => {
    renderApp('/meses/2026-09')
    expect(rows()).toEqual([
      'MoradiaR$ 180,3521%',
      'ComprasR$ 120,0014%',
      'AssinaturasR$ 39,905%',
      'TransporteR$ 12,001%',
      'Sem categoriaR$ 249,9029%',
      'Outros gastos das faturasR$ 271,0231%',
    ])
  })

  it('tocar abre a categoria; tocar num item abre pra editar e grava a categoria', async () => {
    const { client } = renderApp('/meses/2026-09')
    fireEvent.click(
      within(block()).getByRole('button', { name: /Sem categoria/ }),
    )
    const open = within(block()).getByRole('button', { expanded: true })
    expect(open).toHaveTextContent('Sem categoria')
    expect(block()).toHaveTextContent('Toca num item pra escolher a categoria.')
    expect(spaced(block().querySelector('.spending-items')!.textContent)).toBe(
      'Dentistaparcela 2/4 · Fora do cartãoR$ 150,00InternetContaR$ 99,90',
    )

    fireEvent.click(within(block()).getByRole('button', { name: /Internet/ }))
    const form = dialog('Editar conta')
    fireEvent.click(within(form).getByLabelText('Moradia'))
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(writes()).toEqual([
      expect.objectContaining({
        table: 'bills',
        op: 'update',
        payload: expect.objectContaining({
          category_id: categoryId('Moradia'),
        }),
        filters: [['id', 'b9b']],
      }),
    ])
    expect(
      cached(client).bills.find((item) => item.id === 'b9b')!.categoryId,
    ).toBe(categoryId('Moradia'))
  })

  it('"Outros gastos das faturas" explica e abre a fatura', () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      within(block()).getByRole('button', {
        name: /Outros gastos das faturas/,
      }),
    )
    expect(block()).toHaveTextContent(
      'Lance os gastos no + pra saber onde foram.',
    )
    fireEvent.click(
      within(block()).getByRole('button', { name: /Fatura Nubank Teste/ }),
    )
    expect(dialog('Fatura Nubank Teste')).toBeVisible()
  })

  it('mês sem saídas não mostra o bloco', () => {
    const finance = financeFixture()
    renderApp('/meses/2026-09', undefined, {
      ...finance,
      bills: [],
      invoices: [],
      plans: [],
    })
    expect(
      screen.queryByRole('region', { name: 'Para onde foi o dinheiro' }),
    ).not.toBeInTheDocument()
  })
})

describe('Lançar com categoria', () => {
  const open = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    return dialog('Lançar')
  }

  it('sugere pelo nome e grava a categoria do gasto', async () => {
    renderApp('/meses/2026-09')
    const form = open()
    fireEvent.change(within(form).getByLabelText('Valor'), {
      target: { value: '25' },
    })
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'iFood' },
    })
    expect(within(form).getByLabelText('Alimentação')).toBeChecked()
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar' }))
    await settle()
    expect(writes()[0]).toMatchObject({
      table: 'invoice_expenses',
      op: 'insert',
      payload: { description: 'iFood', category_id: categoryId('Alimentação') },
    })
  })

  it('o que a pessoa escolhe fica, mesmo mudando a descrição', async () => {
    renderApp('/meses/2026-09')
    const form = open()
    fireEvent.change(within(form).getByLabelText('Valor'), {
      target: { value: '12' },
    })
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'Uber' },
    })
    // Uber was Transporte before (fixture), so that comes first.
    expect(within(form).getByLabelText('Transporte')).toBeChecked()
    fireEvent.click(within(form).getByLabelText('Lazer'))
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'Uber pro show' },
    })
    expect(within(form).getByLabelText('Lazer')).toBeChecked()
    fireEvent.click(within(form).getByLabelText('Pix, boleto ou dinheiro'))
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar' }))
    await settle()
    expect(writes()[0]).toMatchObject({
      table: 'bills',
      op: 'insert',
      payload: { category_id: categoryId('Lazer') },
    })
  })

  it('entrada não tem categoria', () => {
    renderApp('/meses/2026-09')
    const form = open()
    fireEvent.click(within(form).getByRole('button', { name: 'Entrada' }))
    expect(within(form).queryByText('Categoria')).not.toBeInTheDocument()
  })
})

describe('gasto lançado', () => {
  it('no resumo da fatura, tocar no gasto abre pra editar valor e categoria', async () => {
    const { client } = renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    fireEvent.click(
      within(dialog('Fatura Nubank Teste')).getByRole('button', {
        name: /^Uber/,
      }),
    )
    const form = dialog('Editar gasto')
    expect(within(form).getByLabelText('Transporte')).toBeChecked()
    fireEvent.change(within(form).getByLabelText('Valor (R$)'), {
      target: { value: '15' },
    })
    fireEvent.click(within(form).getByLabelText('Lazer'))
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(writes()).toEqual([
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'update',
        payload: {
          description: 'Uber',
          amount: '15.00',
          category_id: categoryId('Lazer'),
        },
      }),
    ])
    expect(cached(client).expenses[0]).toMatchObject({
      amount: 1500,
      categoryId: categoryId('Lazer'),
    })
  })
})

describe('primeira vez', () => {
  it('cria a lista padrão e sugere categoria pro que já existia', async () => {
    const finance = financeFixture()
    const { client } = renderApp('/meses/2026-09', undefined, {
      ...finance,
      categories: [],
      bills: finance.bills.map((item) => ({ ...item, categoryId: null })),
      expenses: finance.expenses.map((item) => ({ ...item, categoryId: null })),
      plans: finance.plans.map((item) => ({ ...item, categoryId: null })),
      subscriptions: finance.subscriptions.map((item) => ({
        ...item,
        categoryId: null,
      })),
    })
    await settle()
    const [categories, ...links] = writes()
    expect(categories!.table).toBe('categories')
    expect(categories!.payload).toHaveLength(9)
    const after = cached(client)
    const named = (id: string | null | undefined) =>
      after.categories.find((item) => item.id === id)?.name ?? null
    expect(
      after.bills.map((item) => [item.description, named(item.categoryId)]),
    ).toEqual([
      ['Aluguel', 'Moradia'],
      ['Conta de luz', 'Moradia'],
      ['Internet', 'Moradia'],
    ])
    expect(named(after.expenses[0]!.categoryId)).toBe('Transporte')
    expect(after.plans.map((item) => named(item.categoryId))).toEqual([
      'Compras',
      'Saúde',
    ])
    expect(named(after.subscriptions[0]!.categoryId)).toBeNull()
    for (const call of links)
      expect(call.filters).toContainEqual(['category_id', null])
  })
})

describe('Ajustes: categorias', () => {
  const open = () => {
    renderApp('/config')
    fireEvent.click(screen.getByRole('button', { name: 'Editar categorias' }))
    return dialog('Categorias')
  }

  it('renomeia, recusa nome repetido, troca ícone e cor', async () => {
    const form = open()
    const name = within(form).getByLabelText('Nome da categoria Lazer')
    fireEvent.change(name, { target: { value: 'Diversão' } })
    fireEvent.blur(name)
    await settle()
    expect(writes()[0]).toMatchObject({
      table: 'categories',
      op: 'update',
      payload: { name: 'Diversão' },
    })

    const other = within(form).getByLabelText('Nome da categoria Compras')
    fireEvent.change(other, { target: { value: 'moradia' } })
    fireEvent.blur(other)
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Já existe uma categoria com esse nome.',
    )
    expect(other).toHaveValue('Compras')

    const look = within(form).getByRole('button', {
      name: 'Ícone e cor de Compras',
    })
    expect(look).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(look)
    expect(look).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(within(form).getByLabelText('Mercado'))
    await settle()
    expect(writes()[1]).toMatchObject({
      table: 'categories',
      op: 'update',
      payload: { icon: 'cart', color: '#F59F00' },
    })
    fireEvent.click(within(form).getByLabelText('Cor #0CA678'))
    await settle()
    expect(writes()[2]).toMatchObject({
      table: 'categories',
      op: 'update',
      payload: { color: '#0CA678' },
    })
  })

  it('apaga com Desfazer, que devolve a categoria aos itens', async () => {
    const { client } = (() => {
      const result = renderApp('/config')
      fireEvent.click(screen.getByRole('button', { name: 'Editar categorias' }))
      return result
    })()
    const form = dialog('Categorias')
    fireEvent.click(
      within(form).getByRole('button', { name: 'Excluir Moradia' }),
    )
    await settle()
    expect(
      cached(client).bills.find((item) => item.id === 'b9a')!.categoryId,
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(writes().map((call) => [call.table, call.op])).toEqual([
      ['categories', 'delete'],
      ['categories', 'insert'],
      ['bills', 'update'],
    ])
    expect(writes()[2]!.filters).toEqual([['id', ['b9a']]])
    expect(
      cached(client).bills.find((item) => item.id === 'b9a')!.categoryId,
    ).toBe(categoryId('Moradia'))
  })

  it('adiciona uma nova, com a próxima cor', async () => {
    const form = open()
    fireEvent.change(within(form).getByLabelText('Nova categoria'), {
      target: { value: 'Pets' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
    await settle()
    expect(writes()[0]).toMatchObject({
      table: 'categories',
      op: 'insert',
      payload: { name: 'Pets', color: '#AE3EC9', icon: 'tag', sort_order: 9 },
    })
    expect(within(form).getByLabelText('Nova categoria')).toHaveValue('')
    // It opens right away, so the person picks the icon.
    expect(
      within(form).getByRole('button', { name: 'Ícone e cor de Pets' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
