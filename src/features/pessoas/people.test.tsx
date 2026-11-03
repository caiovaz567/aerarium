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
const addForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa' }))
  return dialog('Adicionar pessoa')
}
const type = (form: HTMLElement, value: string) => {
  fireEvent.change(within(form).getByLabelText('Nome ou @usuário'), {
    target: { value },
  })
  fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }))
}
const rpcArgs = (name: string) =>
  fake.current!.rpcCalls.find((item) => item.name === name)?.args

beforeEach(() => {
  fake.current = fakeSupabase()
})

describe('seu usuário', () => {
  it('escolhe, aceita ponto e limpa o que foi digitado', async () => {
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
    fireEvent.change(field, { target: { value: ' @Caio.Vaz ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'usernames',
        op: 'upsert',
        payload: { user_id: 'u1', username: 'caio.vaz' },
      }),
    )
    expect(await screen.findByText('Agora você é @caio.vaz')).toBeVisible()
  })

  it('mostra o que já tem', async () => {
    fake.current!.tableResults.usernames = [{ username: 'caio' }]
    await open()
    expect(screen.getByText('@caio')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeVisible()
  })
})

describe('adicionar pessoa, com um campo só', () => {
  it('só o nome: entra sem convite, mesmo sem ter usuário', async () => {
    await open()
    const form = addForm()
    type(form, '   ')
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(/Coloca/),
    )
    type(form, ' Prima ')
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'people',
        op: 'insert',
        payload: { user_id: 'u1', name: 'Prima' },
      }),
    )
    expect(rpcArgs('add_person')).toBeUndefined()
    expect(await screen.findByText('Prima entrou na sua lista')).toBeVisible()
  })

  it('com @: convida, mesmo sem ter usuário', async () => {
    fake.current!.rpcResults.add_person = 'ok'
    await open()
    type(addForm(), '@Joao.Silva')
    await waitFor(() =>
      expect(rpcArgs('add_person')).toEqual({ p_username: 'joao.silva' }),
    )
    expect(fake.current!.calls).toEqual([])
    expect(
      await screen.findByText('Convite enviado pra @joao.silva'),
    ).toBeVisible()
  })

  it('usuário que não existe: avisa na janela e não salva nada', async () => {
    fake.current!.rpcResults.add_person = 'not-found'
    await open()
    const form = addForm()
    type(form, '@joao')
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(/Não achei/),
    )
    expect(fake.current!.calls).toEqual([])
  })

  it('@ com formato errado nem pergunta pro banco', async () => {
    await open()
    const form = addForm()
    type(form, '@a')
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(/3 a 20/),
    )
    expect(rpcArgs('add_person')).toBeUndefined()
  })
})

describe('quem usa seus cartões', () => {
  it('o Pai fica com o resto; só o nome, convidado e aceito', async () => {
    fake.current!.rpcResults.my_people = [
      { id: 'p1', name: 'Prima', username: null, accepted: false },
      { id: 'p2', name: 'ana', username: 'ana', accepted: false },
      { id: 'p3', name: 'bia', username: 'bia', accepted: true },
    ]
    await open('/config?aba=pessoas', 'Pai')
    const list = screen.getByRole('region', { name: 'Quem usa seus cartões' })
    expect(
      within(list).getByText('Fica com o resto das faturas.'),
    ).toBeVisible()
    expect(within(list).getByText('Prima')).toBeVisible()
    expect(within(list).getByText('Só você vê.')).toBeVisible()
    expect(within(list).getByText('@ana')).toBeVisible()
    expect(within(list).getByText('Esperando aceitar.')).toBeVisible()
    expect(within(list).getByText('Aceitou. Vê a parte dela.')).toBeVisible()
  })

  it('remover pede confirmação', async () => {
    fake.current!.rpcResults.my_people = [
      { id: 'p1', name: 'Prima', username: null, accepted: false },
    ]
    await open()
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
  const invited = { person_id: 'p9', from_name: '@caio', accepted: false }

  it('em Meses: aceita com um toque, sem ir pros Ajustes', async () => {
    fake.current!.rpcResults.my_invitations = [invited]
    await open('/meses/2026-09')
    const banner = await screen.findByRole('region', { name: 'Convite' })
    expect(banner).toHaveTextContent('@caio quer te adicionar.')
    fireEvent.click(within(banner).getByRole('button', { name: 'Aceitar' }))
    await waitFor(() =>
      expect(rpcArgs('answer_invitation')).toEqual({
        p_person: 'p9',
        p_accept: true,
      }),
    )
  })

  it('em Meses: recusar pede confirmação', async () => {
    fake.current!.rpcResults.my_invitations = [invited]
    await open('/meses/2026-09')
    const banner = await screen.findByRole('region', { name: 'Convite' })
    fireEvent.click(within(banner).getByRole('button', { name: 'Recusar' }))
    expect(rpcArgs('answer_invitation')).toBeUndefined()
    fireEvent.click(
      within(banner).getByRole('button', {
        name: 'Toca de novo pra confirmar',
      }),
    )
    await waitFor(() =>
      expect(rpcArgs('answer_invitation')).toEqual({
        p_person: 'p9',
        p_accept: false,
      }),
    )
  })

  it('sem convite, ou já aceito, Meses fica igual', async () => {
    await open('/meses/2026-09')
    expect(screen.queryByRole('region', { name: 'Convite' })).toBeNull()
    fake.current!.rpcResults.my_invitations = [{ ...invited, accepted: true }]
    await open('/meses/2026-09')
    expect(screen.queryByRole('region', { name: 'Convite' })).toBeNull()
  })

  it('nos Ajustes: quem te adicionou, e dá pra sair', async () => {
    fake.current!.rpcResults.my_invitations = [{ ...invited, accepted: true }]
    await open()
    const list = await screen.findByRole('region', {
      name: 'Quem te adicionou',
    })
    expect(within(list).queryByRole('button', { name: 'Aceitar' })).toBeNull()
    fireEvent.click(within(list).getByRole('button', { name: 'Sair' }))
    fireEvent.click(
      within(list).getByRole('button', {
        name: 'Toca de novo pra confirmar',
      }),
    )
    await waitFor(() =>
      expect(rpcArgs('answer_invitation')).toEqual({
        p_person: 'p9',
        p_accept: false,
      }),
    )
  })
})
