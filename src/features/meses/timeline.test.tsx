import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey } from '../../data/finance'
import { fakeSupabase } from '../../test/fakeSupabase'
import { categoryId, financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'

// Saídas by date, the three views and the short summary.
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

// Meses opens "Por tipo"; these tests look at "Por data".
function renderApp(...args: Parameters<typeof render>) {
  const result = render(...args)
  fake.latest = () => result.client.getQueryData(financeKey('u1'))
  const byDate = screen.queryByRole('button', { name: 'Por data' })
  if (byDate) fireEvent.click(byDate)
  return result
}
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const spaced = (value: string | null | undefined) => value?.replace(/\s/g, ' ')
const saidas = () => screen.getByRole('region', { name: 'Saídas' })
const day = (name: string) => within(saidas()).getByRole('region', { name })
const rows = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole('listitem')
    .map((item) => spaced(item.textContent))

describe('Por data', () => {
  it('abre sempre em "Por tipo", o primeiro; "Por data" fica no meio', () => {
    render('/meses/2026-09')
    expect(
      within(saidas()).getByRole('button', { name: 'Por tipo' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(screen.getByRole('group', { name: 'Ver saídas' }))
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Por tipo', 'Por data', 'Por categoria'])
    expect(within(saidas()).getByText('Cartões')).toBeVisible()
  })

  it('o gasto com data no dia dele; o resto em "Fixos do mês", somando R$ 873,17', () => {
    renderApp('/meses/2026-09')
    expect(rows(day('qui, 3 set'))).toEqual(['UberNubank TesteR$ 12,00'])
    const fixed = day('Fixos do mês')
    expect(within(fixed).getByRole('heading')).toHaveTextContent(
      'Fixos do mêsR$ 861,17',
    )
    expect(rows(fixed)).toEqual([
      'Fatura Nubank Testesem detalheR$ 271,02',
      'Conta de luzContaR$ 180,35',
      'Dentistaparcela 2/4 · Fora do cartãoR$ 150,00',
      'Notebookparcela 2/10 · Nubank TesteR$ 120,00',
      'InternetContaR$ 99,90',
      'Streamingassinatura · Nubank TesteR$ 39,90',
    ])
  })

  it('lançar agora aparece em "Hoje", com a hora', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    const form = screen.getByRole('dialog', { name: 'Lançar' })
    expect(within(form).getByLabelText('Quando')).toHaveValue(
      '2026-09-15T12:00',
    )
    fireEvent.change(within(form).getByLabelText('Valor'), {
      target: { value: '32,50' },
    })
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'iFood' },
    })
    fireEvent.change(within(form).getByLabelText('Quando'), {
      target: { value: '2026-09-15T09:41' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar' }))
    await settle()
    expect(fake.current!.calls[0]).toMatchObject({
      table: 'invoice_expenses',
      op: 'insert',
      payload: {
        spent_on: '2026-09-15',
        occurred_at: '2026-09-15T12:41:00.000Z',
        category_id: categoryId('Alimentação'),
      },
    })
    expect(rows(day('Hoje'))).toEqual(['iFood09:41 · Nubank TesteR$ 32,50'])
  })

  it('uma fileira de cartões filtra a lista', () => {
    renderApp('/meses/2026-09')
    const row = within(saidas()).getByRole('group', {
      name: 'Filtrar por cartão',
    })
    expect(
      within(row)
        .getAllByRole('button')
        .map((button) => spaced(button.textContent)),
    ).toEqual(['Todos', 'Nubank Teste', 'Fora do cartão'])
    fireEvent.click(within(row).getByRole('button', { name: 'Fora do cartão' }))
    expect(
      within(row).getByRole('button', { name: 'Fora do cartão' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      rows(day('Fixos do mês')).map((text) => text!.split('R$')[0]),
    ).toEqual([
      'Conta de luzConta',
      'Dentistaparcela 2/4 · Fora do cartão',
      'InternetConta',
    ])
    fireEvent.click(within(row).getByRole('button', { name: 'Nubank Teste' }))
    expect(rows(day('qui, 3 set'))).toEqual(['UberNubank TesteR$ 12,00'])
    fireEvent.click(within(row).getByRole('button', { name: 'Todos' }))
    expect(rows(day('Fixos do mês'))).toHaveLength(6)
  })

  it('conta e parcela fora do cartão têm o círculo de pago no começo', async () => {
    renderApp('/meses/2026-09')
    const fixed = day('Fixos do mês')
    const light = within(fixed).getByRole('button', {
      name: 'Marcar como pago: Conta de luz',
    })
    fireEvent.click(light)
    await settle()
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'bills',
        op: 'update',
        payload: expect.objectContaining({ paid: true }),
      }),
    )
    expect(
      within(day('Fixos do mês')).getByRole('button', {
        name: 'Pago: Conta de luz',
      }),
    ).toBeVisible()
    expect(
      within(fixed).getByRole('button', {
        name: 'Marcar como pago: Dentista',
      }),
    ).toBeVisible()
    // Card purchases are paid with the invoice, not here.
    expect(
      within(day('qui, 3 set')).queryByRole('button', { name: /pago/i }),
    ).toBeNull()
  })

  it('tocar num item abre ele pra editar', () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      within(day('qui, 3 set')).getByRole('button', { name: /Uber/ }),
    )
    expect(screen.getByRole('dialog', { name: 'Editar gasto' })).toBeVisible()
  })
})

describe('Compra do banco', () => {
  const fromBank = () => {
    const finance = financeFixture()
    return {
      ...finance,
      expenses: finance.expenses.map((item) =>
        item.description === 'Uber'
          ? {
              ...item,
              description: 'UBER *TRIP HELP.UBER.COM',
              externalId: 'tx-1',
              note: 'Ida ao aeroporto',
            }
          : item,
      ),
    }
  }

  it('mostra o nome do banco e a descrição da pessoa embaixo', () => {
    renderApp('/meses/2026-09', undefined, fromBank())
    expect(rows(day('qui, 3 set'))).toEqual([
      'UBER *TRIP HELP.UBER.COMIda ao aeroportoNubank TesteR$ 12,00',
    ])
  })

  it('editar: o nome do banco não muda; a descrição é opcional e é salva', async () => {
    renderApp('/meses/2026-09', undefined, fromBank())
    fireEvent.click(
      within(day('qui, 3 set')).getByRole('button', { name: /UBER/ }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Editar gasto' })
    expect(within(dialog).getByText('UBER *TRIP HELP.UBER.COM')).toBeVisible()
    expect(within(dialog).queryByLabelText('Descrição')).toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Descrição (opcional)'), {
      target: { value: '  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'update',
        payload: expect.objectContaining({
          description: 'UBER *TRIP HELP.UBER.COM',
          note: null,
        }),
      }),
    )
    expect(rows(day('qui, 3 set'))).toEqual([
      'UBER *TRIP HELP.UBER.COMNubank TesteR$ 12,00',
    ])
  })
})
