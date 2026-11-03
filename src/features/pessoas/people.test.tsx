import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp } from '../../test/renderApp'

const fake = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('../../test/fakeSupabase').fakeSupabase
  > | null,
}))
vi.mock('../../data/supabase', () => ({ supabase: () => fake.current!.client }))

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const open = async (
  path = '/config?aba=pessoas',
  other: string | null = null,
) => {
  renderApp(path, undefined, { ...financeFixture(), otherPerson: other })
  await settle()
}
const dialog = (name: string) => screen.getByRole('dialog', { name })

beforeEach(() => {
  fake.current = fakeSupabase()
})

describe('seu usuário', () => {
  it('escolhe, limpa o que foi digitado e confere o formato', async () => {
    await open()
    expect(screen.getByText('Nenhum ainda')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher' }))
    const form = dialog('Seu usuário')
    const field = within(form).getByLabelText('Usuário')
    fireEvent.change(field, { target: { value: 'jo' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(/3 a 20/),
    )
    expect(fake.current!.calls).toEqual([])
    fireEvent.change(field, { target: { value: ' @Caio_1 ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'usernames',
        op: 'upsert',
        payload: { user_id: 'u1', username: 'caio_1' },
      }),
    )
    expect(await screen.findByText('Agora você é @caio_1')).toBeVisible()
  })

  it('mostra o que já tem', async () => {
    fake.current!.tableResults.usernames = [{ username: 'caio' }]
    await open()
    expect(screen.getByText('@caio')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeVisible()
  })
})

describe('quem usa seus cartões', () => {
  it('o Pai fica com o resto; só o nome, convidado e aceito', async () => {
    fake.current!.rpcResults.my_people = [
      { id: 'p1', name: 'Prima', username: null, accepted: false },
      { id: 'p2', name: 'Ana', username: 'ana', accepted: false },
      { id: 'p3', name: 'Bia', username: 'bia', accepted: true },
    ]
    await open('/config?aba=pessoas', 'Pai')
    const list = screen.getByRole('region', { name: 'Quem usa seus cartões' })
    expect(
      within(list).getByText('Fica com o resto das faturas.'),
    ).toBeVisible()
    expect(
      within(list).getByText('Só o nome. Essa pessoa não vê nada.'),
    ).toBeVisible()
    expect(within(list).getByText('@ana, esperando aceitar')).toBeVisible()
    expect(within(list).getByText('@bia')).toBeVisible()
  })

  it('adiciona só com o nome, pra quem não usa o Aerarium', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    const form = dialog('Adicionar pessoa')
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(/nome/),
    )
    fireEvent.change(within(form).getByLabelText('Nome'), {
      target: { value: ' Prima ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'people',
        op: 'insert',
        payload: { user_id: 'u1', name: 'Prima' },
      }),
    )
    expect(fake.current!.rpcCalls.map((item) => item.name)).not.toContain(
      'invite_person',
    )
  })

  it('usuário que não existe: o nome fica salvo e avisa', async () => {
    fake.current!.tableResults.usernames = [{ username: 'caio' }]
    fake.current!.rpcResults.invite_person = 'not-found'
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
    const form = dialog('Adicionar pessoa')
    fireEvent.change(within(form).getByLabelText('Nome'), {
      target: { value: 'João' },
    })
    fireEvent.change(
      within(form).getByLabelText('Usuário dela no Aerarium (opcional)'),
      { target: { value: '@joao' } },
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
    expect(
      await screen.findByText(/João entrou só com o nome\. Não achei/),
    ).toBeVisible()
    expect(fake.current!.calls[0]).toMatchObject({ table: 'people' })
    expect(
      fake.current!.rpcCalls.find((item) => item.name === 'invite_person')
        ?.args,
    ).toMatchObject({ p_username: 'joao' })
  })

  it('convidar depois mostra o problema na janela; remover pede confirmação', async () => {
    fake.current!.rpcResults.my_people = [
      { id: 'p1', name: 'João', username: null, accepted: false },
    ]
    fake.current!.rpcResults.invite_person = 'self'
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))
    const form = dialog('Convidar João')
    fireEvent.change(within(form).getByLabelText('Usuário no Aerarium'), {
      target: { value: 'caio' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Convidar' }))
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(
        'Esse usuário é o seu.',
      ),
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(fake.current!.calls).toEqual([])
    fireEvent.click(
      screen.getByRole('button', { name: 'Toca de novo pra confirmar' }),
    )
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'people',
        op: 'delete',
        filters: [['id', 'p1']],
      }),
    )
  })
})

describe('convites que você recebeu', () => {
  const invited = { person_id: 'p9', from_username: 'caio', accepted: false }

  it('aparece em Meses e leva pra Pessoas', async () => {
    fake.current!.rpcResults.my_invitations = [invited]
    await open('/meses/2026-09')
    expect(
      await screen.findByRole('link', { name: /@caio quer te adicionar/ }),
    ).toHaveAttribute('href', '/config?aba=pessoas')
  })

  it('sem convite, Meses fica igual', async () => {
    await open('/meses/2026-09')
    expect(screen.queryByText(/quer te adicionar/)).not.toBeInTheDocument()
  })

  it('aceitar grava a resposta', async () => {
    fake.current!.rpcResults.my_invitations = [invited]
    await open()
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar' }))
    await waitFor(() =>
      expect(
        fake.current!.rpcCalls.find((item) => item.name === 'answer_invitation')
          ?.args,
      ).toEqual({ p_person: 'p9', p_accept: true }),
    )
  })

  it('já aceito: dá pra sair, com confirmação', async () => {
    fake.current!.rpcResults.my_invitations = [{ ...invited, accepted: true }]
    await open()
    expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Toca de novo pra confirmar' }),
    )
    await waitFor(() =>
      expect(
        fake.current!.rpcCalls.find((item) => item.name === 'answer_invitation')
          ?.args,
      ).toEqual({ p_person: 'p9', p_accept: false }),
    )
  })
})
