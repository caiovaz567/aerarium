import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chartSeries } from '../../domain/chartSeries'
import { cents } from '../../domain/money'
import { isoDate, month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp } from '../../test/renderApp'
import {
  cardStats,
  cardsView,
  dayLabel,
  pointStatus,
  purchaseDays,
} from './cardView'

const fake = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('../../test/fakeSupabase').fakeSupabase
  > | null,
}))
vi.mock('../../data/supabase', () => ({
  supabase: () => fake.current!.client,
}))

// "Today" is 15/09/2026, so September is the current month.
beforeEach(() => {
  fake.current = fakeSupabase()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-15T12:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

const spaced = (value: string | null | undefined) => value?.replace(/\s/g, ' ')
const sep = month('2026-09')

describe('contas das telas de cartão', () => {
  const finance = financeFixture()

  it('aba Cartões em setembro', () => {
    const view = cardsView(finance, sep)
    const nubank = view.blocks[0]!
    expect([
      nubank.total,
      nubank.installments,
      nubank.subscriptions,
      nubank.other,
    ]).toEqual([44292, 12000, 3990, 28302])
    expect(view.totals).toEqual({
      total: 44292,
      installments: 12000,
      subscriptions: 3990,
      other: 28302,
    })
    // Notebook 9 × 120 + Dentista 3 × 150.
    expect(view.outstanding).toBe(153000)
    expect(view.loose.map((line) => line.plan.description)).toEqual([
      'Dentista',
    ])
    expect(view.archived).toEqual([])
  })

  it('números do cartão: em aberto, última parcela e assinaturas', () => {
    expect(cardStats('c1', finance)).toEqual({
      outstanding: 108000,
      lastMonth: '2027-05',
      subscriptions: 3990,
    })
    expect(cardStats('c2', finance)).toEqual({
      outstanding: 0,
      lastMonth: null,
      subscriptions: 0,
    })
  })

  it('compras da fatura por dia, a mais nova primeiro', () => {
    const base = finance.expenses[0]!
    const days = purchaseDays('c1', sep, {
      ...finance,
      expenses: [
        ...finance.expenses,
        {
          ...base,
          id: 'e2',
          description: 'iFood',
          spentOn: isoDate('2026-09-20'),
        },
        {
          ...base,
          id: 'e3',
          description: 'Padaria',
          spentOn: isoDate('2026-09-20'),
          occurredAt: '2026-09-20T11:00:00.000Z',
        },
      ],
    })
    expect(
      days.map((day) => [
        dayLabel(day.day),
        day.items.map((item) => item.description),
      ]),
    ).toEqual([
      ['dom, 20/09', ['Padaria', 'iFood']],
      ['qui, 03/09', ['Uber']],
    ])
    // No invoice that month: nothing.
    expect(purchaseDays('c1', month('2026-07'), finance)).toEqual([])
    const points = chartSeries('c1', sep, finance)
    const status = (target: string) =>
      pointStatus(
        points.find((point) => point.month === target)!,
        sep,
      )
    expect(status('2026-09')).toEqual({ text: 'em aberto', tone: '' })
    expect(status('2026-08')).toEqual({ text: 'paga', tone: 'ok' })
    expect(status('2026-12')).toEqual({ text: 'previsão', tone: 'forecast' })
  })
})

const hero = () =>
  spaced(screen.getByRole('region', { name: /^Fatura de/ }).textContent)
const feed = () =>
  spaced(screen.getByRole('region', { name: /^Na fatura de/ }).textContent)

describe('Cartões, uma tela só', () => {
  it('os cartões em fila, o total de todos e o primeiro aberto', () => {
    renderApp('/cartoes?mes=2026-09')
    expect(spaced(document.querySelector('.all-invoices')!.textContent)).toBe(
      'Todas as faturas R$ 442,92',
    )
    const strip = screen.getByRole('group', { name: 'Escolher cartão' })
    expect(
      within(strip)
        .getAllByRole('button')
        .map(
          (item) => item.getAttribute('aria-label') ?? spaced(item.textContent),
        ),
    ).toEqual([
      'Nubank TesteR$ 442,92',
      'Cartão com um nome bem comprido pra quebrar a linhaR$ 0,00',
      'Fora dos cartõesR$ 150,00',
      'Novo cartão',
    ])
    expect(
      within(strip).getByRole('button', { name: /^Nubank Teste/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(hero()).toBe(
      'Nubank TesteEditarFatura de setembro · a pagarR$ 442,92Marcar fatura como pagaColoca o dia de fechamento e o de vencimento em Editar pra ver o vencimento e o melhor dia pra comprar.',
    )
    // Purchases first (newest on top), then what comes every month.
    expect(feed()).toBe(
      'Tudo · 4Compras · 1Parcelas · 1Assinaturas · 1qui, 03/09UberúltimaTransporteR$ 12,00Todo mêsNotebookparcela 2/10R$ 120,00Streamingassinatura · dia 10R$ 39,90Outros gastos não detalhadosiPhone 2/12R$ 271,02',
    )
    expect(screen.getByRole('button', { name: /^Uber/ })).toHaveClass('newest')
  })

  it('trocar de cartão, e fora dos cartões', () => {
    renderApp('/cartoes?mes=2026-09')
    const strip = screen.getByRole('group', { name: 'Escolher cartão' })
    fireEvent.click(within(strip).getByRole('button', { name: /^Cartão com/ }))
    expect(hero()).toContain('Fatura de setembro · a pagarR$ 0,00')
    expect(feed()).toContain('Nenhuma compra lançada em setembro')
    fireEvent.click(within(strip).getByRole('button', { name: /^Fora dos/ }))
    expect(
      screen.getByRole('region', { name: 'Fora dos cartões' }),
    ).toHaveTextContent('Dentista')
  })

  it('o link antigo de um cartão abre ele aqui', () => {
    renderApp('/cartoes/c2')
    expect(
      screen.getByRole('button', { name: /^Cartão com/, pressed: true }),
    ).toBeVisible()
  })

  it('agosto: fatura paga, e a parcela paga com ela explica como desfazer', () => {
    renderApp('/cartoes?mes=2026-08')
    expect(hero()).toContain('Fatura de agosto · pagaR$ 359,90Fatura paga')
    fireEvent.click(screen.getByRole('button', { name: /^Parcelas/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Pago: Notebook' }))
    expect(
      screen.getByText(
        'Essa parcela foi paga junto com a fatura. Pra desfazer, desmarca a fatura.',
      ),
    ).toBeVisible()
    expect(fake.current!.calls).toEqual([])
  })

  it('marcar a fatura como paga, direto no cartão', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar fatura como paga' }),
    )
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'invoices',
        op: 'update',
        payload: expect.objectContaining({ paid: true }),
      }),
    )
    expect(screen.getByText('Fatura Nubank Teste paga')).toBeVisible()
  })

  it('tocar numa compra abre ela pra mudar; no resto abre a fatura', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Uber/ }))
    const dialog = screen.getByRole('dialog', { name: 'Editar gasto' })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), {
      target: { value: '15,00' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'update',
        payload: expect.objectContaining({ amount: '15.00' }),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /^Outros gastos/ }))
    const invoice = screen.getByRole('dialog')
    fireEvent.click(within(invoice).getByRole('button', { name: 'Salvar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('só as compras; as parcelas em aberto; os arquivados', () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Compras/ }))
    expect(feed()).not.toContain('Todo mês')
    fireEvent.click(screen.getByRole('button', { name: /^Parcelas/ }))
    expect(
      screen
        .getByRole('region', { name: 'Parcelas' })
        .querySelector('.list-meta'),
    ).toHaveTextContent('1 em aberto · R$ 1.080,00 até maio 2027')
    // Each piece is kept whole; wrapping happens only between pieces.
    const info = document.querySelector('.desc .sub')!
    expect(
      [...info.querySelectorAll('.part')].map((part) =>
        spaced(part.textContent),
      ),
    ).toEqual(['2/10', 'faltam 9', 'R$ 1.080,00 no total'])
    const archive = screen.getByRole('button', { name: /Arquivados/ })
    expect(archive).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(archive)
    expect(screen.getByText(/Quando você pagar a última parcela/)).toBeVisible()
  })

  it('o gráfico abre no mês da tela; as setas do teclado andam só nele', () => {
    renderApp('/cartoes?mes=2026-09')
    const head = () =>
      spaced(document.querySelector('.chart-head')!.textContent)
    expect(head()).toBe(
      'Setembro 2026 · em abertoR$ 442,92R$ 83,02 (23,1%)vs ago',
    )
    expect(document.querySelector('.change.up')).not.toBeNull()
    expect(spaced(document.querySelector('.average')!.textContent)).toBe(
      'média 2 meses R$ 401,41',
    )
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
    })
    expect(head()).toBe('Agosto 2026 · pagaR$ 359,90')
    expect(document.querySelector('.change-row')!.childElementCount).toBe(0)
    expect(hero()).toContain('Fatura de setembro')
  })

  it('assinatura que começa depois: aparece apagada e não conta no mês', () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      subscriptions: finance.subscriptions.map((item) => ({
        ...item,
        startedOn: isoDate('2026-10-11'),
        firstMonth: month('2026-10'),
      })),
    })
    expect(feed()).toContain(
      'Streamingassinatura · dia 10 · entra a partir de outubro 2026',
    )
    expect(screen.getByRole('button', { name: /^Streaming/ })).toHaveClass(
      'later',
    )
    fireEvent.click(screen.getByRole('button', { name: /^Assinaturas/ }))
    const list = screen.getByRole('region', { name: 'Assinaturas do cartão' })
    expect(spaced(list.textContent)).toContain('R$ 0,00 em setembro')
  })

  it('com banco: final, vencimento, limite, próxima fatura e melhor dia', () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      // The owner's convention: September's invoice is due in October.
      dueNextMonth: true,
      cards: finance.cards.map((card) =>
        card.id === 'c1' ? { ...card, closingDay: 3, dueDay: 25 } : card,
      ),
      bankAccounts: [
        {
          id: 'ba1',
          pluggyAccountId: 'acc',
          itemId: 'item',
          name: 'Nubank',
          number: '**** 5580',
          cardId: 'c1',
          creditLimit: cents(5_000_00),
          availableLimit: cents(3_750_00),
        },
      ],
    })
    expect(hero()).toBe(
      'Nubank Testefinal 5580EditarFatura de setembro · a pagarR$ 442,92vence 25 out · faltam 40 diasMarcar fatura como pagaLimite livre R$ 3.750,00 de R$ 5.000,00Próxima fatura25 novMelhor dia pra comprardia 4',
    )
  })

  it('para todo mundo, o vencimento é no mês da fatura', () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      cards: finance.cards.map((card) =>
        card.id === 'c1' ? { ...card, closingDay: 3, dueDay: 25 } : card,
      ),
    })
    expect(hero()).toContain('vence 25 set · faltam 10 dias')
    expect(hero()).toContain('Próxima fatura25 out')
  })

  it('com o pai ligado: sua parte, total no banco e a parte dele', async () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      otherPerson: 'Pai',
      otherBankUntil: month('2026-10'),
    })
    expect(hero()).toContain(
      'Sua parte da fatura de setembro · a pagarR$ 442,92Total no bancoDigitarParte do PaiR$ 0,00',
    )
    fireEvent.click(screen.getByRole('button', { name: /^Total no banco/ }))
    const dialog = screen.getByRole('dialog', {
      name: 'Total da fatura no banco',
    })
    fireEvent.change(
      within(dialog).getByLabelText('Total da fatura no banco'),
      { target: { value: '500,00' } },
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'invoices',
        op: 'update',
        payload: { bank_total: '500.00' },
      }),
    )
    // 500,00 minus the 442,92 that is yours.
    expect(hero()).toContain('Total no bancoR$ 500,00Parte do PaiR$ 57,08')
  })

  it('compra do pai ganha a etiqueta dele', () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      otherPerson: 'Pai',
      expenses: finance.expenses.map((item) => ({ ...item, forOther: true })),
    })
    expect(feed()).toContain('UberúltimaPai')
    // 442,92 on the card: 12,00 his, the rest yours.
    expect(hero()).toContain(
      'Sua parte da fatura de setembro · a pagarR$ 430,92',
    )
    expect(hero()).toContain('Parte do PaiR$ 12,00')
  })

  it('outros gastos: "Sei o total" recusa menos que o fixo e aceita o resto', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Outros gastos/ }))
    const dialog = screen.getByRole('dialog', {
      name: 'Outros gastos · Nubank Teste',
    })
    expect(within(dialog).getByLabelText('Outros gastos')).toHaveValue('271,02')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sei o total da fatura' }),
    )
    const total = within(dialog).getByLabelText('Total da fatura')
    fireEvent.change(total, { target: { value: '100,00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'O total não pode ser menor que parcelas + assinaturas + gastos lançados (R$ 171,90).',
    )
    fireEvent.change(total, { target: { value: '500,00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(fake.current!.calls).toContainEqual(
      expect.objectContaining({
        table: 'invoices',
        payload: {
          other_amount: '328.10',
          estimated: false,
          note: 'iPhone 2/12',
        },
      }),
    )
  })

  it('outros gastos zerado: aparece apagado, pra poder colocar', () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      invoices: finance.invoices.map((item) => ({
        ...item,
        otherAmount: cents(0),
        note: null,
      })),
    })
    const row = screen.getByRole('button', { name: /^Outros gastos/ })
    expect(row).toHaveClass('later')
    expect(row).toHaveTextContent('nenhum, toque pra colocar')
  })

  it('a partir de outubro: só a parte do pai, sem digitar o total do banco', () => {
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...financeFixture(),
      otherPerson: 'Pai',
      otherBankUntil: month('2026-09'),
    })
    expect(hero()).not.toContain('Total no banco')
    expect(hero()).toContain('Parte do PaiR$ 0,00')
  })

  it('usuário normal não vê nada disso', () => {
    renderApp('/cartoes?mes=2026-09')
    expect(hero()).not.toContain('Total no banco')
    expect(hero()).not.toContain('Sua parte')
  })
})
