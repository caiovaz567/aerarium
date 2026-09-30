import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey } from '../../data/finance'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'

// Fase 14.3: the switch of the daily email, in Ajustes → Bancos conectados.
const fake = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('../../test/fakeSupabase').fakeSupabase
  > | null,
  latest: null as (() => unknown) | null,
  setup: vi.fn<() => Promise<number>>(),
}))
vi.mock('../../data/supabase', () => ({
  supabase: () => fake.current!.client,
}))
vi.mock('../../data/finance', async (original) => ({
  ...(await original<typeof import('../../data/finance')>()),
  loadFinance: () => Promise.resolve(fake.latest!()),
}))
vi.mock('./useBank', async (original) => ({
  ...(await original<typeof import('./useBank')>()),
  useBankEnabled: () => true,
  useBankAutoSync: () => {},
}))
vi.mock('../../data/bank', async (original) => ({
  ...(await original<typeof import('../../data/bank')>()),
  setupDailyEmail: () => fake.setup(),
}))

beforeEach(() => {
  fake.current = fakeSupabase()
  fake.setup.mockReset()
})

function renderApp(...args: Parameters<typeof render>) {
  const result = render(...args)
  fake.latest = () => result.client.getQueryData(financeKey('u1'))
  return result
}
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const writes = () => fake.current!.calls.filter((call) => call.op !== 'select')

describe('cartões do banco, agrupados', () => {
  it('uma linha só; tocando, escolhe onde entra cada cartão', async () => {
    const finance = financeFixture()
    const account = (id: string, name: string, cardId: string | null) => ({
      id,
      pluggyAccountId: `p-${id}`,
      itemId: 'item',
      name,
      number: '1234',
      cardId,
      creditLimit: null,
      availableLimit: null,
      limitAt: null,
    })
    renderApp('/config', undefined, {
      ...finance,
      bankAccounts: [
        account('a1', 'NUBANK ROXINHO', 'c1'),
        account('a2', 'OUROCARD', null),
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cartões do banco' }))
    const dialog = screen.getByRole('dialog', { name: 'Cartões do banco' })
    const ouro = within(dialog).getByLabelText(/OUROCARD/)
    expect(ouro).toHaveValue('')
    fireEvent.change(ouro, { target: { value: 'c2' } })
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'bank_accounts',
        payload: expect.objectContaining({ card_id: 'c2' }),
      }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pronto' }))
    expect(
      screen.getByRole('button', { name: 'Cartões do banco' }),
    ).toHaveTextContent('2 cartões · 2 entram no app')
  })
})

describe('resumo por e-mail às 9h', () => {
  it('ligar passa pelo servidor, que manda o primeiro; desligar grava direto', async () => {
    fake.setup.mockResolvedValue(3)
    renderApp('/config')
    const toggle = screen.getByRole('checkbox', {
      name: /Resumo por e-mail às 9h/,
    })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    await settle()
    await settle()
    expect(fake.setup).toHaveBeenCalledOnce()
    expect(toggle).toBeChecked()
    expect(
      screen.getByText(
        'Ligado. Mandei um e-mail com 3 compras dos últimos dias.',
      ),
    ).toBeVisible()
    fireEvent.click(toggle)
    await settle()
    expect(toggle).not.toBeChecked()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'user_settings',
        payload: expect.objectContaining({ daily_email: false }),
      }),
    )
  })

  it('sem conseguir ligar, fica desligado e avisa', async () => {
    fake.setup.mockRejectedValue(new Error('Não consegui ligar o e-mail.'))
    renderApp('/config')
    const toggle = screen.getByRole('checkbox', {
      name: /Resumo por e-mail às 9h/,
    })
    fireEvent.click(toggle)
    await settle()
    await settle()
    expect(toggle).not.toBeChecked()
    expect(screen.getByText('Não consegui ligar o e-mail.')).toHaveAttribute(
      'role',
      'alert',
    )
  })
})
