import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey, type Finance } from '../../data/finance'
import { cents } from '../../domain/money'
import { isoDate, month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import { pendingReview, reviewDays } from './review'

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
    restIsOther: otherPerson !== null,
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
