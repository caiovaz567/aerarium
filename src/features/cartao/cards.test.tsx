import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chartSeries } from '../../domain/chartSeries'
import { cents } from '../../domain/money'
import { month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp } from '../../test/renderApp'
import { cardStats, cardsView, monthDetail, pointStatus } from './cardView'

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

  it('"O que tem em setembro" e em agosto, já pago', () => {
    const points = chartSeries('c1', sep, finance)
    const september = points.find((point) => point.month === sep)!
    expect(pointStatus(september, sep)).toEqual({ text: 'em aberto', tone: '' })
    expect(
      monthDetail('c1', september, finance, sep).items.map((item) => [
        item.name,
        item.sub,
        item.amount,
      ]),
    ).toEqual([
      ['Notebook', 'parcela 2/10', 12000],
      ['Assinaturas', 'Streaming', 3990],
      ['Uber', 'gasto em 03/09', 1200],
      ['Outros gastos não detalhados', 'o resto da fatura', 27102],
    ])
    const august = points.find((point) => point.month === '2026-08')!
    expect(pointStatus(august, sep)).toEqual({ text: 'paga', tone: 'ok' })
    expect(monthDetail('c1', august, finance, sep).items[0]!.sub).toBe(
      'paga em 10/08',
    )
    const july = points.find((point) => point.month === '2026-07')!
    expect(monthDetail('c1', july, finance, sep).emptyText).toBe(
      'Nenhuma fatura desse cartão nesse mês',
    )
    const december = points.find((point) => point.month === '2026-12')!
    expect(pointStatus(december, sep)).toEqual({
      text: 'previsão',
      tone: 'forecast',
    })
  })
})

describe('aba Cartões', () => {
  it('resumo, blocos, fora dos cartões e arquivados', () => {
    renderApp('/cartoes?mes=2026-09')
    const hero = screen.getByRole('region', { name: 'Resumo dos cartões' })
    expect(hero).toHaveTextContent('Faturas de Setembro')
    expect(spaced(hero.querySelector('.hero-num')!.textContent)).toBe(
      'R$ 442,92',
    )
    expect(spaced(hero.querySelector('.hero-foot')!.textContent)).toBe(
      'Parcelas em aberto no total: R$ 1.530,00',
    )
    const nubank = screen.getByRole('region', { name: 'Nubank Teste' })
    expect(nubank).toHaveTextContent('Fatura em aberto')
    expect(spaced(within(nubank).getByText(/^Outros/).textContent)).toBe(
      'Outros R$ 283,02',
    )
    // Each piece is kept whole; wrapping happens only between pieces.
    const info = nubank.querySelector('.desc .sub')!
    expect(spaced(info.textContent)).toBe(
      '2/10 · faltam 9 · R$ 1.080,00 no total',
    )
    expect(
      [...info.querySelectorAll('.part')].map((part) =>
        spaced(part.textContent),
      ),
    ).toEqual(['2/10', 'faltam 9', 'R$ 1.080,00 no total'])
    expect(within(nubank).getByText('1 assinatura')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Fora dos cartões' }),
    ).toHaveTextContent('Dentista')
    const archive = screen.getByRole('button', { name: /Arquivados/ })
    expect(archive).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(archive)
    expect(screen.getByText(/Quando você pagar a última parcela/)).toBeVisible()
  })

  it('agosto: fatura paga', () => {
    renderApp('/cartoes?mes=2026-08')
    expect(
      screen.getByRole('region', { name: 'Nubank Teste' }),
    ).toHaveTextContent('Fatura paga')
  })

  it('parcela paga com a fatura explica como desfazer', () => {
    renderApp('/cartoes?mes=2026-08')
    fireEvent.click(screen.getByRole('button', { name: 'Pago: Notebook' }))
    expect(
      screen.getByText(
        'Essa parcela foi paga junto com a fatura. Pra desfazer, desmarca a fatura.',
      ),
    ).toBeVisible()
    expect(fake.current!.calls).toEqual([])
  })

  it('tocar no nome abre a tela do cartão', () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('link', { name: /^Nubank Teste/ }))
    expect(
      screen.getByRole('heading', { name: 'Nubank Teste', level: 2 }),
    ).toBeVisible()
  })
})

describe('tela do cartão', () => {
  const head = () => spaced(document.querySelector('.chart-head')!.textContent)

  it('abre no mês atual, com a fatura, o resumo, a comparação e a média', () => {
    renderApp('/cartoes/c1')
    expect(
      spaced(screen.getByRole('region', { name: 'Fatura atual' }).textContent),
    ).toBe('Nubank TesteVencimentosem diaFatura de setembroR$ 442,92A pagar')
    // No closing or due day yet: a hint instead of the dates; no limit.
    expect(screen.getByText(/Coloca o dia de fechamento/)).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Limite' })).toBeNull()
    expect(
      spaced(
        screen.getByRole('region', { name: 'Resumo da fatura' }).textContent,
      ),
    ).toBe(
      'Resumo da faturaComprasR$ 12,00ParcelamentosR$ 120,00AssinaturasR$ 39,90OutrosR$ 271,02TotalR$ 442,92',
    )
    expect(
      screen.getByRole('region', { name: 'Parcelas' }).querySelector('.meta'),
    ).toHaveTextContent('1 em aberto · R$ 1.080,00 até maio 2027')
    expect(head()).toBe(
      'Setembro 2026 · em abertoR$ 442,92R$ 83,02 (23,1%)vs ago',
    )
    expect(document.querySelector('.change.up')).not.toBeNull()
    expect(spaced(document.querySelector('.average')!.textContent)).toBe(
      'média 2 meses R$ 401,41',
    )
    expect(
      screen.getByRole('region', { name: 'O que tem em setembro' }),
    ).toHaveTextContent('Outros gastos não detalhados')
  })

  it('setas do teclado e botões andam um mês; sem comparação a linha fica vazia', () => {
    renderApp('/cartoes/c1')
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
    })
    expect(head()).toBe('Agosto 2026 · pagaR$ 359,90')
    expect(document.querySelector('.change-row')!.childElementCount).toBe(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Próximo mês' })[0]!)
    expect(head()).toMatch(/^Setembro 2026/)
  })

  it('Esc volta pros cartões', () => {
    renderApp('/cartoes/c1')
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(
      screen.getByRole('region', { name: 'Resumo dos cartões' }),
    ).toBeVisible()
  })

  it('com banco: final, vencimento, limite, próxima fatura e melhor dia', () => {
    const finance = financeFixture()
    renderApp('/cartoes/c1', undefined, {
      ...finance,
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
    expect(
      spaced(screen.getByRole('region', { name: 'Fatura atual' }).textContent),
    ).toBe(
      'Nubank Testefinal 5580Vencimento25 setfaltam 10 diasFatura de setembroR$ 442,92A pagar',
    )
    expect(
      spaced(screen.getByRole('region', { name: 'Limite' }).textContent),
    ).toBe('Limite disponívelR$ 3.750,00de R$ 5.000,0025%usado')
    expect(spaced(document.querySelector('.card-dates')!.textContent)).toBe(
      'Próxima fatura25 de outubroMelhor dia pra comprardia 4',
    )
  })

  it('cartão que não existe', () => {
    renderApp('/cartoes/nao-existe')
    expect(screen.getByText('Cartão não encontrado')).toBeVisible()
  })
})
