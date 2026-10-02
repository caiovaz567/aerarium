import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey } from '../../data/finance'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import { bankItemLines } from './bankItems'

// How each bank connection is doing, in Ajustes → Bancos conectados.
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
vi.mock('./useBank', async (original) => ({
  ...(await original<typeof import('./useBank')>()),
  useBankEnabled: () => true,
  useBankAutoSync: () => {},
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
const spaced = (value: string | null | undefined) => value?.replace(/\s/g, ' ')

const withBank = () => {
  const finance = financeFixture()
  return {
    ...finance,
    // Not the first import (that one shows a preview before saving).
    bankRecords: [{ externalId: 'start:2026-09-01', amount: null }],
    bankAccounts: [
      {
        id: 'a1',
        pluggyAccountId: 'p1',
        itemId: 'item1',
        name: 'NUBANK ROXINHO',
        number: '1234',
        cardId: 'c1',
      },
      {
        id: 'a2',
        pluggyAccountId: 'p2',
        itemId: 'item2',
        name: 'OUROCARD',
        number: '9999',
        cardId: null,
      },
    ],
  }
}
// "Now" in the tests is 15/09/2026, 12:00 in São Paulo.
const now = new Date('2026-09-15T12:00:00-03:00')
const item = (id: string, status: string, lastUpdatedAt: string | null) => ({
  id,
  status,
  lastUpdatedAt,
})

describe('situação de cada banco', () => {
  it('em dia, parado há mais de um dia, com erro e buscando', () => {
    const lines = bankItemLines(
      withBank(),
      [
        item('item1', 'UPDATED', '2026-09-15T09:10:00.000Z'),
        item('item2', 'UPDATED', '2026-09-13T09:10:00.000Z'),
        item('x', 'LOGIN_ERROR', null),
        item('y', 'OUTDATED', '2026-09-14T09:10:00.000Z'),
        item('z', 'OUTDATED', null),
        item('w', 'UPDATING', null),
        item('v', 'UPDATED', null),
      ],
      now,
    ).map((line) => [line.name, spaced(line.text), line.tone])
    expect(lines).toEqual([
      // The app's card name; the bank's name while it feeds no card.
      [
        'Nubank Teste',
        'Em dia: o banco mandou dados em 15 de set., 06:10.',
        'ok',
      ],
      [
        'OUROCARD',
        'Sem novidade do banco há mais de um dia: o banco mandou dados em 13 de set., 06:10.',
        'bad',
      ],
      [
        'Banco',
        'A conexão com o banco caiu. Reconecte em meu.pluggy.ai pra voltar a receber as compras.',
        'bad',
      ],
      [
        'Banco',
        'O banco não respondeu na última tentativa; o banco mandou dados em 14 de set., 06:10.',
        'bad',
      ],
      ['Banco', 'O banco não respondeu na última tentativa.', 'bad'],
      ['Banco', 'Buscando no banco agora…', 'busy'],
      ['Banco', 'O banco ainda não mandou nada.', 'bad'],
    ])
  })
})

describe('nome da conexão', () => {
  it('cartão do banco em "Não importar" fica de fora quando outro entra no app', () => {
    const finance = withBank()
    const lines = bankItemLines(
      {
        ...finance,
        bankAccounts: [
          ...finance.bankAccounts,
          {
            ...finance.bankAccounts[1]!,
            id: 'a3',
            name: 'ANTIGO',
            itemId: 'item1',
          },
        ],
      },
      [item('item1', 'UPDATED', '2026-09-15T09:10:00.000Z')],
      now,
    )
    expect(lines[0]!.name).toBe('Nubank Teste')
  })
})

describe('"Atualizar agora" pede pro banco e mostra como cada um está', () => {
  it('pede a busca, olha o que tem e mostra a situação', async () => {
    fake.current!.functionResults.bank = {
      // One answer for both requests: "refresh" reads `asked`, "fetch" the rest.
      asked: [{ id: 'item1', ok: true, code: 200 }],
      items: [item('item1', 'UPDATING', '2026-09-14T09:10:00.000Z')],
      accounts: [],
      transactions: [],
      bills: [],
    }
    renderApp('/config?aba=bancos', undefined, withBank())
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await settle()
    await settle()
    expect(
      fake
        .current!.functionCalls.filter((call) => call.name === 'bank')
        .map((call) => (call.body as { action: string }).action),
    ).toEqual(['refresh', 'fetch'])
    expect(
      await screen.findByText(/Pedi pro banco mandar o que tem de novo/),
    ).toBeVisible()
    expect(screen.getByText('Buscando no banco agora…')).toBeVisible()
    // Kept on the device: there again when Ajustes opens.
    expect(localStorage.getItem('aerarium.banco.itens')).toContain('item1')
  })

  it('banco em dia só aparece depois de atualizar; com problema fica sempre', async () => {
    localStorage.setItem(
      'aerarium.banco.itens',
      JSON.stringify([
        item('item1', 'UPDATED', '2026-09-15T09:10:00.000Z'),
        item('item2', 'LOGIN_ERROR', null),
      ]),
    )
    renderApp('/config?aba=bancos', undefined, withBank())
    expect(await screen.findByText(/A conexão com o banco caiu/)).toBeVisible()
    expect(screen.queryByText(/Em dia: o banco mandou dados/)).toBeNull()
  })

  it('servidor antigo ou banco que não deixa pedir: olha o que tem, sem aviso', async () => {
    fake.current!.functionResults.bank = {
      items: [item('item1', 'UPDATED', '2026-09-15T09:10:00.000Z')],
      accounts: [],
      transactions: [],
      bills: [],
    }
    renderApp('/config?aba=bancos', undefined, withBank())
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))
    await settle()
    await settle()
    expect(await screen.findByText('Nada novo no banco.')).toBeVisible()
    expect(screen.getByText(/Em dia: o banco mandou dados/)).toBeVisible()
  })
})
