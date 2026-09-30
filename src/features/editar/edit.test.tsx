import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey } from '../../data/finance'
import { isoDate, month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import { buildWorkbook, fileName, MONEY_FORMAT } from '../exportar/workbook'

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
const spaced = (value: string | null | undefined) => value?.replace(/\s/g, ' ')
const writes = () => fake.current!.calls.filter((call) => call.op !== 'select')
const list = () => screen.getByRole('region', { name: 'Assinaturas' })
const dialog = (name: string) => screen.getByRole('dialog', { name })
const type = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } })

describe('Assinaturas', () => {
  it('total por mês, por ano e a próxima cobrança', () => {
    renderApp('/assinaturas')
    const summary = screen.getByRole('region', {
      name: 'Total das assinaturas',
    })
    expect(spaced(summary.textContent)).toBe(
      'Total por mêsR$ 39,90R$ 478,80 por ano',
    )
    expect(spaced(document.querySelector('.next-charge')!.textContent)).toBe(
      'Próxima cobrança: Streaming, dia 10 · R$ 39,90',
    )
    expect(screen.getByText('Nubank Teste')).toBeVisible()
  })

  it('adicionar valida o dia e grava', async () => {
    renderApp('/assinaturas')
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar assinatura' }),
    )
    const form = dialog('Nova assinatura')
    type(form, 'Assinatura', 'Netflix')
    type(form, 'Dia da cobrança', '40')
    type(form, 'Valor', '55,90')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'O dia precisa ser de 1 a 31.',
    )
    type(form, 'Dia da cobrança', '20')
    fireEvent.change(within(form).getByLabelText('Cartão'), {
      target: { value: 'c1' },
    })
    // Starts today, in this month's invoice (the card has no closing day).
    expect(within(form).getByLabelText('Começou em')).toHaveValue('2026-09-15')
    expect(form).toHaveTextContent(
      'Entra na fatura de Setembro 2026 em diante.',
    )
    type(form, 'Começou em', '2026-10-02')
    expect(form).toHaveTextContent('Entra na fatura de Outubro 2026 em diante.')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(within(list()).getByText('Netflix')).toBeVisible()
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'subscriptions',
        op: 'insert',
        payload: expect.objectContaining({
          name: 'Netflix',
          charge_day: 20,
          amount: '55.90',
          card_id: 'c1',
          started_on: '2026-10-02',
          first_month: '2026-10-01',
        }),
      }),
    )
  })

  it('assinatura antiga sem data conta em todos os meses', () => {
    renderApp('/assinaturas')
    fireEvent.click(within(list()).getByText('Streaming'))
    const form = dialog('Editar assinatura')
    expect(within(form).getByLabelText('Começou em')).toHaveValue('')
    expect(form).toHaveTextContent('Sem data, conta em todos os meses.')
  })

  it('lixeira exclui com Desfazer', async () => {
    renderApp('/assinaturas')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Streaming' }))
    await settle()
    expect(screen.getByText('Nenhuma assinatura ainda.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(within(list()).getByText('Streaming')).toBeVisible()
  })
})

describe('Editar cartão', () => {
  it('muda o nome e o dia de fechamento; com banco a cor vem dele', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Teste' }))
    const form = dialog('Editar cartão')
    // A bank brings its color; colors only show without a logo.
    expect(
      within(form).queryByRole('radio', { name: 'Cor do banco' }),
    ).toBeNull()
    fireEvent.click(within(form).getByRole('radio', { name: 'Sem logo' }))
    expect(
      within(form).getByRole('radio', { name: 'Cor do banco' }),
    ).toBeChecked()
    fireEvent.click(within(form).getByRole('radio', { name: 'Nubank' }))
    type(form, 'Nome do cartão', 'Nubank Roxinho')
    type(form, 'Dia de fechamento (opcional)', '5')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(screen.getByText('Nubank Roxinho')).toBeVisible()
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'cards',
        op: 'update',
        payload: expect.objectContaining({
          name: 'Nubank Roxinho',
          closing_day: 5,
          color: null,
        }),
      }),
    )
  })

  it('com o fechamento, a assinatura que começou depois vai pra fatura seguinte', async () => {
    const finance = financeFixture()
    renderApp('/cartoes?mes=2026-09', undefined, {
      ...finance,
      subscriptions: finance.subscriptions.map((item) => ({
        ...item,
        startedOn: isoDate('2026-09-29'),
        firstMonth: month('2026-09'),
      })),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Teste' }))
    const form = dialog('Editar cartão')
    type(form, 'Dia de fechamento (opcional)', '25')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    await waitFor(() =>
      expect(writes()[1]).toMatchObject({
        table: 'subscriptions',
        op: 'update',
        payload: { first_month: '2026-10-01' },
        filters: [['id', 's1']],
      }),
    )
  })

  it('logo do banco: palpite pelo nome, troca, "Sem logo" e vencimento', async () => {
    renderApp('/cartoes?mes=2026-09')
    const logo = () =>
      screen
        .getByRole('region', { name: 'Nubank Teste' })
        .querySelector('.bank-logo')
    expect(logo()).toHaveAttribute('src', '/banks/nubank.png')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Teste' }))
    const form = dialog('Editar cartão')
    expect(within(form).getByRole('radio', { name: 'Nubank' })).toBeChecked()
    fireEvent.click(within(form).getByRole('radio', { name: 'Itaú' }))
    type(form, 'Dia de vencimento (opcional)', '40')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'O dia de vencimento precisa ser de 1 a 31.',
    )
    type(form, 'Dia de vencimento (opcional)', '12')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(logo()).toHaveAttribute('src', '/banks/itau.png')
    expect(
      screen.getByRole('region', { name: 'Nubank Teste' }),
    ).toHaveTextContent('vence dia 12')
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'cards',
        op: 'update',
        payload: expect.objectContaining({ bank: 'itau', due_day: 12 }),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Teste' }))
    const again = dialog('Editar cartão')
    fireEvent.click(within(again).getByRole('radio', { name: 'Sem logo' }))
    type(again, 'Dia de fechamento (opcional)', '33')
    fireEvent.click(within(again).getByRole('button', { name: 'Salvar' }))
    expect(within(again).getByRole('alert')).toHaveTextContent(
      'O dia de fechamento precisa ser de 1 a 31.',
    )
    type(again, 'Dia de fechamento (opcional)', '')
    fireEvent.click(within(again).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(logo()).toBeNull()
  })

  it('novo cartão entra no fim da lista', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Novo cartão' }))
    const form = dialog('Novo cartão')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Escreve o nome do cartão.',
    )
    type(form, 'Nome do cartão', 'Inter')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(screen.getByRole('region', { name: 'Inter' })).toBeVisible()
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'cards',
        op: 'insert',
        payload: expect.objectContaining({ name: 'Inter', sort_order: 3 }),
      }),
    )
  })

  it('excluir leva as faturas; Desfazer devolve tudo na ordem certa', async () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nubank Teste' }))
    const form = dialog('Editar cartão')
    fireEvent.click(within(form).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(
      within(form).getByRole('button', { name: 'Toca de novo pra confirmar' }),
    )
    await settle()
    expect(screen.queryByRole('region', { name: 'Nubank Teste' })).toBeNull()
    // The Notebook plan stays, now without a card.
    expect(
      screen.getByRole('region', { name: 'Fora dos cartões' }),
    ).toHaveTextContent('Notebook')
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(screen.getByRole('region', { name: 'Nubank Teste' })).toBeVisible()
    await waitFor(() =>
      expect(writes().map((call) => `${call.table}:${call.op}`)).toEqual([
        'cards:delete',
        'cards:insert',
        'installment_plans:update',
        'subscriptions:update',
        'invoices:insert',
        'invoice_expenses:insert',
        'invoices:update',
      ]),
    )
  })
})

describe('Editar parcelamento', () => {
  const openNotebook = () => {
    renderApp('/cartoes?mes=2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Notebook/ }))
    return dialog('Editar parcelamento')
  }

  it('mostra o histórico; pagamento da fatura não sai por aqui', () => {
    const form = openNotebook()
    expect(spaced(form.querySelector('.history li')!.textContent)).toBe(
      '10/08/2026Agosto 2026 · pela faturaRemover',
    )
    fireEvent.click(
      within(form).getByRole('button', {
        name: 'Remover pagamento de Agosto 2026',
      }),
    )
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Esse pagamento veio da fatura paga.',
    )
  })

  it('não deixa o cronograma sem os meses pagos', () => {
    const form = openNotebook()
    fireEvent.change(within(form).getByLabelText('Mês da primeira'), {
      target: { value: '2026-09' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Tem pagamento em Agosto 2026, fora desse cronograma.',
    )
    expect(writes()).toEqual([])
  })

  it('registra pagamento à mão com data e mês', async () => {
    const form = openNotebook()
    expect(within(form).getByLabelText('Referente a')).toHaveValue('2026-09')
    type(form, 'Quando você pagou', '2026-09-12')
    fireEvent.click(
      within(form).getByRole('button', { name: 'Registrar pagamento' }),
    )
    await settle()
    expect(spaced(document.querySelector('.app-toast')!.textContent)).toContain(
      'Registrado, faltam 8',
    )
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'installment_payments',
        payload: expect.objectContaining({
          month: '2026-09-01',
          paid_on: '2026-09-12',
          source: 'manual',
        }),
      }),
    )
  })

  it('"Parcela neste cartão" cria parcelamento no cartão', async () => {
    renderApp('/cartoes?mes=2026-09')
    const nubank = screen.getByRole('region', { name: 'Nubank Teste' })
    fireEvent.click(
      within(nubank).getByRole('button', { name: 'Parcela neste cartão' }),
    )
    const form = dialog('Novo parcelamento')
    expect(within(form).getByLabelText('Cobrado em')).toHaveValue('c1')
    type(form, 'O que é', 'Fone')
    type(form, 'Valor da parcela', '50,00')
    type(form, 'Total de parcelas', '3')
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await settle()
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'installment_plans',
        op: 'insert',
        payload: expect.objectContaining({
          description: 'Fone',
          card_id: 'c1',
          installment_amount: '50.00',
          total_installments: 3,
          first_month: '2026-09-01',
        }),
      }),
    )
  })

  it('no resumo da fatura, tocar na parcela abre o parcelamento', () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    fireEvent.click(
      within(dialog('Fatura Nubank Teste')).getByRole('button', {
        name: /^Notebook/,
      }),
    )
    expect(dialog('Editar parcelamento')).toBeVisible()
    expect(
      screen.queryByRole('dialog', { name: 'Fatura Nubank Teste' }),
    ).toBeNull()
  })
})

describe('Excel', () => {
  const sheets = buildWorkbook(financeFixture())
  const values = (name: string) =>
    sheets
      .find((sheet) => sheet.sheet === name)!
      .data.map((row) => row.map((cell) => cell?.value ?? ''))

  it('uma aba por mês e as três de resumo, com nome de arquivo por data', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      'Agosto 2026',
      'Setembro 2026',
      'Parcelamentos',
      'Cartões',
      'Assinaturas',
    ])
    expect(fileName(isoDate('2026-09-24'))).toBe('Aerarium_2026-09-24.xlsx')
  })

  it('setembro traz entradas, saídas e o resumo, em reais com formato de moeda', () => {
    const rows = values('Setembro 2026')
    expect(rows).toContainEqual(['TOTAL ENTRADAS', 5100])
    expect(rows).toContainEqual([
      'Fatura Nubank Teste (iPhone 2/12)',
      442.92,
      '',
    ])
    expect(rows).toContainEqual(['Dentista 2/4', 150, ''])
    expect(rows).toContainEqual(['Internet', 99.9, 'Sim'])
    expect(rows).toContainEqual(['TOTAL SAÍDAS', 873.17])
    expect(rows).toContainEqual(['TOTAL DISPONÍVEL', 4226.83])
    const moneyCell = sheets[1]!.data.find(
      (row) => row[0]?.value === 'TOTAL DISPONÍVEL',
    )![1]!
    expect(moneyCell.format).toBe(MONEY_FORMAT)
  })

  it('parcelamentos com o que falta e os pagamentos', () => {
    const rows = values('Parcelamentos')
    expect(rows).toContainEqual([
      'Notebook',
      'Nubank Teste',
      '',
      9,
      120,
      1080,
      '10/08/2026 (Agosto 2026)',
    ])
    expect(rows.at(-1)).toEqual(['TOTAL GERAL FALTANTE', '', '', '', '', 1530])
    expect(values('Assinaturas')).toContainEqual([
      'Streaming',
      10,
      39.9,
      'Nubank Teste',
      '',
    ])
  })
})

describe('logo que não carrega', () => {
  it('volta pro desenho do cartão em vez de imagem quebrada', () => {
    renderApp('/cartoes?mes=2026-09')
    const region = screen.getByRole('region', { name: 'Nubank Teste' })
    fireEvent.error(region.querySelector('.bank-logo')!)
    expect(region.querySelector('.bank-logo')).toBeNull()
    expect(region.querySelector('.card-art')).not.toBeNull()
  })
})
