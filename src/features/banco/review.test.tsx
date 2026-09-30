import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey, type Finance } from '../../data/finance'
import { cents } from '../../domain/money'
import { isoDate, month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import { joinedPurchase, pendingReview, reviewDays } from './review'

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
})

function renderApp(...args: Parameters<typeof render>) {
  const result = render(...args)
  fake.latest = () => result.client.getQueryData(financeKey('u1'))
  return result
}
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

/** The fixture with two purchases and one plan that came from the bank. */
function fromBank(otherPerson: string | null = 'Pai'): Finance {
  const finance = financeFixture()
  const invoiceId = finance.invoices.find(
    (item) => item.cardId === 'c1' && item.month === month('2026-09'),
  )!.id
  const bank = (id: string, description: string, day: string, at: string) => ({
    id,
    invoiceId,
    description,
    amount: cents(5000),
    spentOn: isoDate(day),
    categoryId: null,
    occurredAt: at,
    externalId: `x-${id}`,
    forOther: true,
    reviewedAt: null,
  })
  return {
    ...finance,
    otherPerson,
    expenses: [
      ...finance.expenses,
      bank('b1', 'POSTO SHELL', '2026-09-20', '2026-09-20T13:00:00.000Z'),
      bank('b2', 'IFD*IFOOD', '2026-09-20', '2026-09-20T23:10:00.000Z'),
      {
        ...bank('b3', 'VISTO', '2026-09-19', '2026-09-19T12:00:00.000Z'),
        reviewedAt: '2026-09-19T12:00:00.000Z',
      },
    ],
    plans: [
      ...finance.plans,
      {
        ...finance.plans[0]!,
        id: 'bp',
        description: 'MAGALU',
        externalKey: 'k',
        forOther: false,
        reviewedAt: null,
      },
    ],
  }
}

describe('Chegou do banco', () => {
  it('lista o que falta conferir, do mais novo; sem a outra pessoa, nada', () => {
    const items = pendingReview(fromBank())
    expect(items.map((item) => item.id)).toEqual(['b2', 'b1', 'bp'])
    expect(reviewDays(items).map((day) => day.items.length)).toEqual([2, 1])
    expect(pendingReview(fromBank(null))).toEqual([])
  })

  it('abre sozinho, marca meu ou do pai e salva; depois some', async () => {
    renderApp('/meses/2026-09', undefined, fromBank())
    const dialog = await screen.findByRole('dialog', {
      name: 'Chegou do banco',
    })
    expect(dialog).toHaveTextContent('3 compras novas')
    const ifood = within(dialog).getByRole('group', {
      name: 'De quem é IFD*IFOOD',
    })
    expect(within(ifood).getByRole('button', { name: 'Pai' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(ifood).getByRole('button', { name: 'Meu' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pronto' }))
    await settle()
    const updates = fake.current!.calls.filter((call) => call.op === 'update')
    expect(updates).toHaveLength(3)
    expect(updates[0]).toMatchObject({
      table: 'invoice_expenses',
      payload: expect.objectContaining({ for_other: false }),
      filters: [['id', 'b2']],
    })
    expect(updates[2]).toMatchObject({ table: 'installment_plans' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/compras novas do banco/)).toBeNull()
  })

  it('"Depois" fecha; o aviso em Meses abre de novo', async () => {
    renderApp('/meses/2026-09', undefined, fromBank())
    const dialog = await screen.findByRole('dialog', {
      name: 'Chegou do banco',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Depois' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: /3 compras novas do banco/ }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Chegou do banco' }),
    ).toBeVisible()
  })
})

describe('"É a mesma?": compra lançada à mão parecida com a do banco', () => {
  /** The fixture's Uber (R$ 12,00 on 03/09, launched by hand) and the bank's. */
  function withUber(amount = 1250, day = '2026-09-05'): Finance {
    const finance = fromBank()
    const base = finance.expenses.find((item) => item.id === 'b1')!
    return {
      ...finance,
      expenses: [
        ...finance.expenses,
        {
          ...base,
          id: 'bu',
          description: 'UBER *TRIP',
          amount: cents(amount),
          spentOn: isoDate(day),
          occurredAt: null,
          categoryId: null,
          externalId: 'x-bu',
        },
      ],
    }
  }
  const similarOf = (finance: Finance) =>
    pendingReview(finance).find((item) => item.id === 'bu')!.similar

  it('mesmo cartão, valor perto e até 5 dias; longe, não pergunta', () => {
    expect(similarOf(withUber())?.id).toBe('e1')
    // R$ 1,00 of difference still asks; more than that on a small value, no.
    expect(similarOf(withUber(1300))?.id).toBe('e1')
    expect(similarOf(withUber(1301))).toBeNull()
    expect(similarOf(withUber(1250, '2026-09-08'))?.id).toBe('e1')
    expect(similarOf(withUber(1250, '2026-09-09'))).toBeNull()
    // Another card: not the same.
    const finance = withUber()
    const other = finance.invoices.find((item) => item.cardId === 'c2')!
    expect(
      similarOf({
        ...finance,
        expenses: finance.expenses.map((item) =>
          item.id === 'e1' ? { ...item, invoiceId: other.id } : item,
        ),
      }),
    ).toBeNull()
    // One launched by hand answers for one purchase only: the closest.
    const twice = withUber()
    const again = twice.expenses.find((item) => item.id === 'bu')!
    const items = pendingReview({
      ...twice,
      expenses: [
        ...twice.expenses,
        { ...again, id: 'bv', amount: cents(1200), externalId: 'x-bv' },
      ],
    })
    expect(items.find((item) => item.id === 'bv')!.similar?.id).toBe('e1')
    expect(items.find((item) => item.id === 'bu')!.similar).toBeNull()
  })

  it('juntar: fica a lançada à mão, com o nome, valor e dia do banco', () => {
    const finance = withUber()
    const typed = finance.expenses.find((item) => item.id === 'e1')!
    const bank = finance.expenses.find((item) => item.id === 'bu')!
    const joined = joinedPurchase(typed, bank, '2026-09-06T12:00:00.000Z')
    expect(joined).toMatchObject({
      id: 'e1',
      description: 'UBER *TRIP',
      note: 'Uber',
      amount: 1250,
      spentOn: '2026-09-05',
      occurredAt: null,
      externalId: 'x-bu',
      reviewedAt: '2026-09-06T12:00:00.000Z',
    })
    // Same text and day: no note, and the typed time stays.
    expect(
      joinedPurchase(
        {
          ...typed,
          spentOn: isoDate('2026-09-05'),
          occurredAt: '2026-09-05T15:00:00.000Z',
        },
        { ...bank, description: 'Uber' },
        'x',
      ),
    ).toMatchObject({ note: null, occurredAt: '2026-09-05T15:00:00.000Z' })
    // The bank's time and category when the typed one has none.
    expect(
      joinedPurchase(
        { ...typed, categoryId: null, note: 'corrida' },
        {
          ...bank,
          categoryId: 'cat',
          occurredAt: '2026-09-05T10:00:00.000Z',
        },
        'x',
      ),
    ).toMatchObject({
      note: 'corrida',
      categoryId: 'cat',
      occurredAt: '2026-09-05T10:00:00.000Z',
    })
  })

  it('"É a mesma" junta ao salvar; sem resposta, volta da próxima vez', async () => {
    renderApp('/meses/2026-09', undefined, withUber())
    const dialog = await screen.findByRole('dialog', {
      name: 'Chegou do banco',
    })
    const question = within(dialog).getByRole('group', {
      name: 'UBER *TRIP é a mesma compra?',
    })
    expect(question).toHaveTextContent(
      'Parece com Uber (R$ 12,00, dia 03/09) que você lançou',
    )
    fireEvent.click(within(question).getByRole('button', { name: 'É a mesma' }))
    expect(
      within(dialog).getByText(/Vai juntar com a que você lançou/),
    ).toBeVisible()
    // Changed my mind, and back.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }))
    fireEvent.click(
      within(
        within(dialog).getByRole('group', {
          name: 'UBER *TRIP é a mesma compra?',
        }),
      ).getByRole('button', { name: 'É a mesma' }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pronto' }))
    await settle()
    const writes = fake.current!.calls.filter((call) => call.op !== 'select')
    expect(writes).toContainEqual(
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'delete',
        filters: [['id', 'bu']],
      }),
    )
    expect(writes).toContainEqual(
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'update',
        payload: expect.objectContaining({
          external_id: 'x-bu',
          amount: '12.50',
          note: 'Uber',
        }),
        filters: [['id', 'e1']],
      }),
    )
    // The bank's row is gone: no double.
    expect(screen.getByText(/1 compra juntada/)).toBeVisible()
  })

  it('"É outra" confere como sempre; sem responder, fica pra depois', async () => {
    renderApp('/meses/2026-09', undefined, withUber())
    const dialog = await screen.findByRole('dialog', {
      name: 'Chegou do banco',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pronto' }))
    await settle()
    const updated = () =>
      fake
        .current!.calls.filter((call) => call.op === 'update')
        .flatMap((call) => call.filters ?? [])
        .map(([, id]) => id)
    expect(updated()).not.toContain('bu')
    fireEvent.click(
      screen.getByRole('button', { name: /1 compra nova do banco/ }),
    )
    const again = screen.getByRole('dialog', { name: 'Chegou do banco' })
    fireEvent.click(within(again).getByRole('button', { name: 'É outra' }))
    expect(
      within(again).getByRole('group', { name: 'De quem é UBER *TRIP' }),
    ).toBeVisible()
    fireEvent.click(within(again).getByRole('button', { name: 'Pronto' }))
    await settle()
    expect(updated()).toContain('bu')
  })
})
