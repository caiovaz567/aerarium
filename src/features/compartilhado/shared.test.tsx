import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey } from '../../data/finance'
import { parseShared } from '../../data/shared'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import { cents } from '../../domain/money'
import { sharedFinance, sharedMonth } from './sharedFinance'
import { canonical, shareData } from './snapshot'

// Sharing the cards with the other person's own account (read only).
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
vi.mock('../banco/useBank', async (original) => ({
  ...(await original<typeof import('../banco/useBank')>()),
  useBankEnabled: () => true,
  useBankAutoSync: () => {},
}))

// Fictitious: what "Caio" marked as the other person's.
const raw = {
  ownerName: 'Caio',
  pixKey: '12345678901',
  pixBank: 'santander',
  cards: [
    {
      id: 'c1',
      name: 'Santander Unique',
      color: null,
      bank: 'santander',
      sortOrder: 0,
    },
  ],
  expenses: [
    {
      id: 'e1',
      cardId: 'c1',
      month: '2026-09',
      description: 'Posto',
      note: null,
      amount: '50.00',
      spentOn: '2026-09-20',
      occurredAt: '2026-09-20T18:13:00.000Z',
      categoryId: null,
    },
  ],
  plans: [
    {
      id: 'p1',
      cardId: 'c1',
      description: 'Connexion',
      installmentAmount: '89.95',
      finalAdjustment: '0.00',
      totalInstallments: 2,
      firstMonth: '2026-09',
      categoryId: null,
    },
  ],
  rests: [{ cardId: 'c1', month: '2026-09', amount: '10.00' }],
  categories: [],
  paidBack: [{ month: '2026-09', amount: '20.00' }],
}

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
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const text = (value: string | null | undefined) =>
  value?.replace(/\s/g, ' ') ?? ''

describe('o que o dono mostra, do lado de quem usa os cartões', () => {
  it('compras, parcelas e o resto do banco, menos o que já pagou', () => {
    const view = parseShared(raw)
    const finance = sharedFinance(view)
    expect(finance.months.map((item) => item.ref)).toEqual([
      '2026-09',
      '2026-10',
    ])
    expect(sharedMonth(view, finance, finance.months[0]!.ref)).toMatchObject({
      owed: 14995,
      paid: 2000,
      due: 12995,
      outside: 0,
    })
    expect(sharedMonth(view, finance, finance.months[1]!.ref).due).toBe(8995)
    // Nothing shared: no months, nothing to parse.
    expect(parseShared({ ownerName: 'X' })).toMatchObject({
      pixKey: null,
      cards: [],
      paidBack: [],
    })
  })
})

describe('a cópia que o dono grava', () => {
  it('só o que é do pai: nada do dono vai junto', () => {
    const finance = financeFixture()
    const data = shareData({
      ...finance,
      otherPerson: 'Pai',
      expenses: finance.expenses.map((item) =>
        item.description === 'Uber' ? { ...item, forOther: true } : item,
      ),
      incomes: [
        ...finance.incomes,
        {
          id: 'volta',
          monthId: finance.months[1]!.id,
          month: finance.months[1]!.ref,
          description: 'Pai pagou',
          amount: cents(1000),
          kind: 'from_other',
          sortOrder: 9,
        },
      ],
    })
    expect(data.expenses.map((item) => item.description)).toEqual(['Uber'])
    expect(data.plans).toEqual([])
    expect(data.rests).toEqual([])
    expect(data.cards.map((card) => card.name)).toEqual(['Nubank Teste'])
    expect(data.categories.map((item) => item.name)).toEqual(['Transporte'])
    expect(data.paidBack).toEqual([{ month: '2026-09', amount: '10.00' }])
    // Keys in any order read the same.
    expect(canonical({ b: 1, a: [{ d: null, c: 'x' }] })).toBe(
      canonical({ a: [{ c: 'x', d: null }], b: 1 }),
    )
  })
})

describe('Cartões do Caio, na conta de quem usa', () => {
  it('Meses mostra a entrada; a tela tem o que falta pagar, o Pix e as compras', async () => {
    const { ownerName, pixKey, pixBank, ...data } = raw
    fake.current!.tableResults.shares = [
      { owner_name: ownerName, pix_key: pixKey, pix_bank: pixBank, data },
    ]
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    renderApp('/meses/2026-09')
    const entry = await screen.findByRole('link', { name: /Cartões do Caio/ })
    expect(text(entry.textContent)).toContain('Setembro: falta pagar R$ 129,95')
    fireEvent.click(entry)
    expect(
      await screen.findByRole('heading', { name: 'Cartões do Caio' }),
    ).toBeVisible()
    const hero = screen.getByRole('region', {
      name: 'O que você deve ao Caio',
    })
    expect(text(hero.textContent)).toContain(
      'Falta pagar ao Caio em SetembroR$ 129,95',
    )
    expect(text(hero.textContent)).toContain(
      'Nos cartões do Caio: R$ 149,95 · você já pagou R$ 20,00',
    )
    const pix = screen.getByRole('region', { name: 'Pagar por Pix' })
    expect(text(pix.textContent)).toContain(
      'Transfira R$ 129,95 pro Caio no Santander.CPF 123.456.789-01',
    )
    fireEvent.click(within(pix).getByRole('button', { name: 'Copiar chave' }))
    await settle()
    expect(writeText).toHaveBeenCalledWith('12345678901')
    expect(screen.getByText('Chave Pix copiada')).toBeVisible()
    const byType = screen.getByRole('group', { name: 'Por tipo' })
    fireEvent.click(within(byType).getByRole('button', { name: /^Santander/ }))
    expect(within(byType).getByText('Posto')).toBeVisible()
    expect(within(byType).getByText('Resto da fatura no banco')).toBeVisible()
    fireEvent.click(screen.getByRole('link', { name: 'Próximo mês' }))
    expect(
      text(
        screen.getByRole('region', { name: 'O que você deve ao Caio' })
          .textContent,
      ),
    ).toContain('R$ 89,95')
  })

  it('sem nada compartilhado: Meses de sempre, e a tela diz que não tem nada', async () => {
    renderApp('/meses/2026-09')
    await settle()
    expect(screen.queryByRole('link', { name: /Cartões do/ })).toBeNull()
    renderApp('/compartilhado')
    expect(await screen.findByText('Nada compartilhado com você')).toBeVisible()
  })
})

describe('do lado do dono', () => {
  const withDad = () => ({ ...financeFixture(), otherPerson: 'Pai' })

  it('compartilha com a conta do pai, com a chave Pix, e vê como ele vê', async () => {
    fake.current!.functionResults.share = { found: true }
    renderApp('/config', undefined, withDad())
    expect(screen.queryByRole('link', { name: 'Ver como ele vê' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Compartilhar com o Pai',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Compartilhar' }),
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Coloca o e-mail da conta do Pai no Aerarium.',
    )
    const type = (label: string, value: string) =>
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      })
    type('E-mail da conta do Pai', 'pai@example.test')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Compartilhar' }),
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Coloca o seu nome',
    )
    type('Seu nome, como ele vai ver', 'Caio')
    type('Banco da sua chave Pix', 'santander')
    type('Sua chave Pix (opcional)', '123.456.789-01')
    // What the database has once the share exists (the copy still empty).
    fake.current!.tableResults.shares = [
      {
        viewer_email: 'pai@example.test',
        owner_name: 'Caio',
        pix_key: '123.456.789-01',
        pix_bank: 'santander',
        data: {},
      },
    ]
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Compartilhar' }),
    )
    await waitFor(() =>
      expect(fake.current!.functionCalls).toContainEqual({
        name: 'share',
        body: {
          email: 'pai@example.test',
          ownerName: 'Caio',
          pixKey: '123.456.789-01',
          pixBank: 'santander',
        },
      }),
    )
    expect(await screen.findByText('Compartilhado com o Pai')).toBeVisible()
    // The owner's app writes the copy the other person reads.
    await waitFor(
      () =>
        expect(fake.current!.calls).toContainEqual(
          expect.objectContaining({
            table: 'shares',
            op: 'update',
            payload: expect.objectContaining({
              data: expect.objectContaining({ expenses: [] }),
            }),
          }),
        ),
      { timeout: 3000 },
    )
    fireEvent.click(
      await screen.findByRole('link', { name: 'Ver como ele vê' }),
    )
    expect(
      await screen.findByText('Assim fica pra quem usa seus cartões.'),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Cartões do Caio' }),
    ).toBeVisible()
  })

  it('e-mail sem conta no Aerarium: avisa pra ele criar primeiro', async () => {
    fake.current!.functionResults.share = { found: false }
    renderApp('/config', undefined, withDad())
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Compartilhar com o Pai',
    })
    fireEvent.change(within(dialog).getByLabelText('E-mail da conta do Pai'), {
      target: { value: 'ninguem@example.test' },
    })
    fireEvent.change(
      within(dialog).getByLabelText('Seu nome, como ele vai ver'),
      { target: { value: 'Caio' } },
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Compartilhar' }),
    )
    expect(
      await within(dialog).findByText(/O Pai precisa criar a conta primeiro/),
    ).toBeVisible()
  })

  it('usuário normal não vê nada disso', () => {
    renderApp('/config')
    expect(screen.queryByText(/Conta do .* no Aerarium/)).toBeNull()
  })
})
