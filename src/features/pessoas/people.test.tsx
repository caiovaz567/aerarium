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
const open = async (path = '/pessoas', other: string | null = null) => {
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
// What the function "people" answers, by action.
let answers: Record<string, unknown>
const asked = (action: string) =>
  fake.current!.functionCalls.find(
    (item) => (item.body as { action: string }).action === action,
  )?.body

beforeEach(() => {
  fake.current = fakeSupabase()
  answers = { list: { people: [] }, invitations: { invitations: [] } }
  fake.current.functionResults.people = (body: { action: string }) =>
    answers[body.action]
})

describe('seu usuário', () => {
  it('escolhe, aceita ponto e limpa o que foi digitado', async () => {
    await open('/config?aba=conta')
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
    await open('/config?aba=conta')
    expect(await screen.findByText('@caio')).toBeVisible()
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
    expect(asked('add')).toBeUndefined()
    expect(await screen.findByText('Prima entrou na sua lista')).toBeVisible()
  })

  it('com @: convida, mesmo sem ter usuário', async () => {
    answers.add = { result: 'ok' }
    await open()
    type(addForm(), '@Joao.Silva')
    await waitFor(() =>
      expect(asked('add')).toEqual({ action: 'add', username: 'joao.silva' }),
    )
    expect(fake.current!.calls).toEqual([])
    expect(
      await screen.findByText('Convite enviado pra @joao.silva'),
    ).toBeVisible()
  })

  it('usuário que não existe: avisa na janela e não salva nada', async () => {
    answers.add = { result: 'not-found' }
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
    expect(asked('add')).toBeUndefined()
  })
})

describe('quem usa seus cartões', () => {
  it('o Pai fica com o resto; só o nome, convidado e aceito', async () => {
    answers.list = {
      people: [
        { id: 'p1', name: 'Prima', username: null, accepted: false },
        { id: 'p2', name: 'ana', username: 'ana', accepted: false },
        { id: 'p3', name: 'bia', username: 'bia', accepted: true },
      ],
    }
    await open('/pessoas', 'Pai')
    const list = screen.getByRole('region', { name: 'Quem usa seus cartões' })
    expect(
      within(list).getByText('Fica com o resto das faturas.'),
    ).toBeVisible()
    expect(await within(list).findByText('Prima')).toBeVisible()
    expect(within(list).getByText('Só você vê.')).toBeVisible()
    expect(within(list).getByText('@ana')).toBeVisible()
    expect(within(list).getByText('Esperando aceitar.')).toBeVisible()
    expect(within(list).getByText('Aceitou. Vê a parte dela.')).toBeVisible()
  })

  it('remover pede confirmação', async () => {
    answers.list = {
      people: [{ id: 'p1', name: 'Prima', username: null, accepted: false }],
    }
    await open()
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
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
    answers.invitations = { invitations: [invited] }
    await open('/meses/2026-09')
    const banner = await screen.findByRole('region', { name: 'Convite' })
    expect(banner).toHaveTextContent('@caio quer te adicionar.')
    fireEvent.click(within(banner).getByRole('button', { name: 'Aceitar' }))
    await waitFor(() =>
      expect(asked('answer')).toEqual({
        action: 'answer',
        person: 'p9',
        accept: true,
      }),
    )
  })

  it('em Meses: recusar pede confirmação', async () => {
    answers.invitations = { invitations: [invited] }
    await open('/meses/2026-09')
    const banner = await screen.findByRole('region', { name: 'Convite' })
    fireEvent.click(within(banner).getByRole('button', { name: 'Recusar' }))
    expect(asked('answer')).toBeUndefined()
    fireEvent.click(
      within(banner).getByRole('button', {
        name: 'Toca de novo pra confirmar',
      }),
    )
    await waitFor(() =>
      expect(asked('answer')).toEqual({
        action: 'answer',
        person: 'p9',
        accept: false,
      }),
    )
  })

  it('sem convite, ou já aceito, Meses fica igual', async () => {
    await open('/meses/2026-09')
    expect(screen.queryByRole('region', { name: 'Convite' })).toBeNull()
    answers.invitations = { invitations: [{ ...invited, accepted: true }] }
    await open('/meses/2026-09')
    expect(screen.queryByRole('region', { name: 'Convite' })).toBeNull()
  })

  it('nos Ajustes: quem te adicionou, e dá pra sair', async () => {
    answers.invitations = { invitations: [{ ...invited, accepted: true }] }
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
      expect(asked('answer')).toEqual({
        action: 'answer',
        person: 'p9',
        accept: false,
      }),
    )
  })
})

describe('compras das pessoas da lista', () => {
  const vini = { id: 'vini', name: 'Vini' }
  const withVini = () => {
    const finance = financeFixture()
    const invoice = finance.invoices.find(
      (item) => item.cardId === 'c1' && item.month === '2026-09',
    )!
    return {
      finance: {
        ...finance,
        otherPerson: 'Pai',
        people: [vini],
        expenses: [
          ...finance.expenses,
          {
            id: 'do-vini',
            invoiceId: invoice.id,
            description: 'Compra do Vini',
            amount: 16151 as never,
            spentOn: '2026-09-10' as never,
            categoryId: null,
            personId: 'vini',
          },
        ],
      },
      plain: finance,
    }
  }

  it('não muda o disponível; aparece na linha da fatura com o nome', async () => {
    const { finance, plain } = withVini()
    const first = renderApp('/meses/2026-09', undefined, plain)
    await settle()
    const before = screen.getByRole('region', {
      name: 'Resumo do mês',
    }).textContent
    first.unmount()
    renderApp('/meses/2026-09', undefined, finance)
    await settle()
    expect(
      screen.getByRole('region', { name: 'Resumo do mês' }).textContent,
    ).toBe(before)
    expect(screen.getByText(/^Vini R\$\s161,51$/)).toBeVisible()
  })

  it('o cartão mostra a parte dele e a compra com etiqueta, pra editar', async () => {
    renderApp('/cartoes?mes=2026-09&cartao=c1', undefined, withVini().finance)
    await settle()
    expect(screen.getByText('Parte de Vini')).toBeVisible()
    const row = screen.getByRole('button', { name: /Compra do Vini/ })
    expect(within(row).getByText('Vini')).toBeVisible()
    fireEvent.click(row)
    const form = dialog('Editar gasto')
    expect(within(form).getByRole('button', { name: 'Vini' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Meu' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fake.current!.calls[0]).toMatchObject({
        table: 'invoice_expenses',
        op: 'update',
        payload: { for_other: false, person_id: null },
      }),
    )
  })

  it('o Lançar lista a pessoa e grava de quem é', async () => {
    renderApp('/meses/2026-09', undefined, withVini().finance)
    await settle()
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    const form = dialog('Lançar')
    fireEvent.change(within(form).getByLabelText('Valor'), {
      target: { value: '161,51' },
    })
    fireEvent.change(within(form).getByLabelText('Descrição'), {
      target: { value: 'Compra do Vini' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Vini' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar' }))
    await waitFor(() => {
      const insert = fake.current!.calls.find(
        (item) => item.table === 'invoice_expenses' && item.op === 'insert',
      )
      expect(JSON.stringify(insert?.payload)).toContain('"person_id":"vini"')
      expect(JSON.stringify(insert?.payload)).toContain('"for_other":false')
    })
  })

  it('sem ninguém além de você, não pergunta de quem é', async () => {
    renderApp('/meses/2026-09', undefined, {
      ...financeFixture(),
      otherPerson: null,
      people: [],
    })
    await settle()
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    expect(within(dialog('Lançar')).queryByText('De quem')).toBeNull()
  })

  it('o seletor lista todo mundo e mostra só o que é da pessoa', async () => {
    localStorage.removeItem('aerarium.perfil')
    renderApp('/meses/2026-09', undefined, withVini().finance)
    await settle()
    const seletor = screen.getByRole('group', { name: 'Ver gastos de' })
    for (const name of ['Eu', 'Pai', 'Vini'])
      expect(within(seletor).getByRole('button', { name })).toBeVisible()
    fireEvent.click(within(seletor).getByRole('button', { name: 'Vini' }))
    const resumo = screen.getByRole('region', { name: 'Resumo de Vini' })
    expect(resumo).toHaveTextContent(/Gastos de Vini em Setembro/)
    expect(resumo).toHaveTextContent(/R\$\s161,51/)
    fireEvent.click(within(seletor).getByRole('button', { name: 'Eu' }))
    localStorage.removeItem('aerarium.perfil')
  })

  it('na sua visão: Vini te deve, e Vini pagou grava de quem veio', async () => {
    localStorage.removeItem('aerarium.perfil')
    renderApp('/meses/2026-09', undefined, withVini().finance)
    await settle()
    const bloco = screen.getByRole('region', { name: 'O que Vini te deve' })
    expect(bloco).toHaveTextContent(/R\$\s161,51/)
    fireEvent.click(within(bloco).getByRole('button', { name: 'Vini pagou' }))
    await waitFor(() => {
      const insert = fake.current!.calls.find(
        (item) => item.table === 'incomes' && item.op === 'insert',
      )
      expect(insert?.payload).toMatchObject({
        kind: 'from_other',
        person_id: 'vini',
      })
    })
  })

  it('sem ninguém além de você, não aparece seletor', async () => {
    renderApp('/meses/2026-09', undefined, {
      ...financeFixture(),
      otherPerson: null,
      people: [],
    })
    await settle()
    expect(screen.queryByRole('group', { name: 'Ver gastos de' })).toBeNull()
  })

  it('pessoa com compra marcada não sai da lista, e avisa', async () => {
    answers.list = {
      people: [{ id: 'vini', name: 'Vini', username: null, accepted: false }],
    }
    await open()
    fake.current!.failNext('23503')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Toca de novo pra confirmar' }),
    )
    expect(await screen.findByText(/tem compras marcadas/)).toBeVisible()
  })
})

describe('onde fica', () => {
  it('os Ajustes têm só uma porta; o usuário fica na Conta', async () => {
    await open('/config')
    expect(screen.queryByRole('link', { name: 'Pessoas' })).toBeNull()
    expect(
      screen.getByRole('link', { name: /Quem usa seus cartões/ }),
    ).toHaveAttribute('href', '/pessoas')
    expect(screen.queryByText('Seu usuário')).toBeNull()
  })

  it('o + do seletor abre as pessoas', async () => {
    await open('/meses/2026-09', 'Pai')
    expect(
      within(screen.getByRole('group', { name: 'Ver gastos de' })).getByRole(
        'link',
        { name: 'Pessoas' },
      ),
    ).toHaveAttribute('href', '/pessoas')
  })
})
