import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { financeKey, type Finance } from '../../data/finance'
import { cents } from '../../domain/money'
import { isoDate, month } from '../../domain/months'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'
import {
  buildLaunch,
  installmentPreview,
  launchMonths,
  NO_CARD,
  suggestMonth,
  type LaunchInput,
} from './launch'

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
  localStorage.clear()
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

const withClosing = (day: number): Finance => {
  const finance = financeFixture()
  return {
    ...finance,
    cards: finance.cards.map((card) =>
      card.id === 'c1' ? { ...card, closingDay: day } : card,
    ),
  }
}
const base: LaunchInput = {
  kind: 'gasto',
  amount: cents(1200),
  installments: 0,
  description: 'Uber',
  where: 'c1',
  paid: true,
  month: month('2026-09'),
  today: isoDate('2026-09-15'),
}
let counter = 0
const ids = () => `novo-${++counter}`

describe('mês sugerido', () => {
  it('meses possíveis: os que existem e o próximo', () => {
    expect(launchMonths(financeFixture())).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('o mês aberto em Meses vence; senão, o mês atual', () => {
    const finance = withClosing(5)
    const card = finance.cards[0]!
    const today = isoDate('2026-09-15')
    expect(
      suggestMonth(finance, { openMonth: month('2026-08'), card, today }),
    ).toBe('2026-08')
    expect(suggestMonth(finance, { openMonth: null, card: null, today })).toBe(
      '2026-09',
    )
  })

  it('fechamento dia 5: gasto no dia 6 vai pra fatura do mês seguinte', () => {
    const finance = withClosing(5)
    const card = finance.cards[0]!
    const on = (day: string) =>
      suggestMonth(finance, { openMonth: null, card, today: isoDate(day) })
    expect(on('2026-09-05')).toBe('2026-09')
    expect(on('2026-09-06')).toBe('2026-10')
    // Opening September in Meses is an explicit choice.
    expect(
      suggestMonth(finance, {
        openMonth: month('2026-09'),
        card,
        today: isoDate('2026-09-06'),
      }),
    ).toBe('2026-10')
  })

  it('convenção do dono: a fatura é o mês antes do vencimento da conta', () => {
    const finance = { ...withClosing(5), dueNextMonth: true }
    const card = finance.cards[0]!
    const on = (day: string) =>
      suggestMonth(finance, { openMonth: null, card, today: isoDate(day) })
    // Closes 05/09, due about 12/09: August's invoice.
    expect(on('2026-09-05')).toBe('2026-08')
    // Closes 05/10, due about 12/10: September's.
    expect(on('2026-09-06')).toBe('2026-09')
    // Opening October in Meses is an explicit choice.
    expect(
      suggestMonth(finance, {
        openMonth: month('2026-10'),
        card,
        today: isoDate('2026-09-06'),
      }),
    ).toBe('2026-10')
  })

  it('fora do que existe, fica na ponta mais perto', () => {
    const finance = financeFixture()
    const on = (day: string) =>
      suggestMonth(finance, {
        openMonth: null,
        card: null,
        today: isoDate(day),
      })
    expect(on('2026-01-10')).toBe('2026-08')
    expect(on('2027-03-10')).toBe('2026-10')
  })
})

describe('prévia do parcelado', () => {
  const sep = month('2026-09')
  it('mostra as parcelas e a última absorve o arredondamento', () => {
    expect(spaced(installmentPreview(cents(120000), 10, sep, sep))).toBe(
      '10x de R$ 120,00, começando este mês',
    )
    expect(spaced(installmentPreview(cents(10000), 3, sep, sep))).toBe(
      '3x de R$ 33,33 (a última de R$ 33,34), começando este mês',
    )
    expect(installmentPreview(cents(10000), 1, sep, sep)).toBe('')
    expect(installmentPreview(null, 10, sep, sep)).toBe('')
  })

  it('diz quando começa, se não for este mês', () => {
    expect(
      spaced(installmentPreview(cents(120000), 10, month('2026-10'), sep)),
    ).toBe('10x de R$ 120,00, começando em outubro')
    expect(
      spaced(installmentPreview(cents(120000), 10, month('2027-01'), sep)),
    ).toBe('10x de R$ 120,00, começando em janeiro de 2027')
  })
})

describe('o que cada lançamento grava', () => {
  const finance = financeFixture()

  it('gasto no cartão entra na fatura do mês e o Desfazer tira', () => {
    const launch = buildLaunch(finance, base, ids)
    expect(spaced(launch.message)).toBe('R$ 12,00 na fatura Nubank Teste')
    const after = launch.op.apply(finance)
    expect(
      after.expenses.filter((item) => item.invoiceId === 'v9a'),
    ).toHaveLength(2)
    expect(launch.undo.apply(after).expenses).toEqual(finance.expenses)
  })

  it('cria a fatura quando o cartão não tem fatura no mês', () => {
    const without = {
      ...finance,
      invoices: finance.invoices.filter((item) => item.id !== 'v9a'),
    }
    const launch = buildLaunch(without, base, ids)
    const after = launch.op.apply(without)
    const created = after.invoices.find(
      (item) => item.cardId === 'c1' && item.month === '2026-09',
    )!
    expect(created).toMatchObject({ estimated: true, otherAmount: 0 })
    expect(after.expenses.at(-1)).toMatchObject({
      invoiceId: created.id,
      description: 'Uber',
      spentOn: '2026-09-15',
    })
    expect(launch.undo.apply(after).invoices).toHaveLength(
      without.invoices.length,
    )
  })

  it('gasto no Pix vira conta, paga ou a pagar', () => {
    const paid = buildLaunch(finance, { ...base, where: NO_CARD }, ids)
    expect(spaced(paid.message)).toBe(
      'R$ 12,00 lançado em Setembro, já como pago',
    )
    expect(paid.op.apply(finance).bills.at(-1)).toMatchObject({
      description: 'Uber',
      paid: true,
      paidOn: '2026-09-15',
      sortOrder: 2,
    })
    const unpaid = buildLaunch(
      finance,
      { ...base, where: NO_CARD, paid: false },
      ids,
    )
    expect(spaced(unpaid.message)).toBe('R$ 12,00 lançado em Setembro, a pagar')
  })

  it('entrada vira entrada do mês', () => {
    const launch = buildLaunch(
      finance,
      { ...base, kind: 'entrada', description: '', amount: cents(50000) },
      ids,
    )
    expect(spaced(launch.message)).toBe('Entrada de R$ 500,00 em Setembro')
    expect(launch.op.apply(finance).incomes.at(-1)).toMatchObject({
      description: 'Entrada',
      kind: 'normal',
      amount: 50000,
    })
  })

  it('parcelado vira parcelamento a partir deste mês, com o ajuste na última', () => {
    const launch = buildLaunch(
      finance,
      {
        ...base,
        kind: 'parcelado',
        amount: cents(100000),
        installments: 3,
        description: 'Notebook',
      },
      ids,
    )
    expect(spaced(launch.message)).toBe('3x de R$ 333,33 no Nubank Teste')
    expect(launch.op.apply(finance).plans.at(-1)).toMatchObject({
      cardId: 'c1',
      installmentAmount: 33333,
      finalAdjustment: 1,
      totalInstallments: 3,
      firstMonth: '2026-09',
    })
  })

  it('do pai: o gasto e o parcelado vão marcados dele', () => {
    const expense = buildLaunch(finance, { ...base, forOther: true }, ids)
    expect(expense.op.apply(finance).expenses.at(-1)?.forOther).toBe(true)
    const plan = buildLaunch(
      finance,
      { ...base, kind: 'parcelado', installments: 3, forOther: true },
      ids,
    )
    expect(plan.op.apply(finance).plans.at(-1)?.forOther).toBe(true)
  })

  it('parcelado pode começar no mês que vem, sem criar mês', () => {
    const launch = buildLaunch(
      finance,
      {
        ...base,
        kind: 'parcelado',
        amount: cents(120000),
        installments: 10,
        month: month('2026-10'),
      },
      ids,
    )
    const after = launch.op.apply(finance)
    expect(after.plans.at(-1)).toMatchObject({ firstMonth: '2026-10' })
    expect(after.months).toEqual(finance.months)
  })

  it('mês seguinte ainda não criado: cria o mês com o gasto dentro', () => {
    const launch = buildLaunch(
      finance,
      { ...base, month: month('2026-10') },
      ids,
    )
    expect(spaced(launch.message)).toBe(
      'R$ 12,00 na fatura Nubank Teste (Outubro criado)',
    )
    const after = launch.op.apply(finance)
    const october = after.months.find((item) => item.ref === '2026-10')!
    const invoice = after.invoices.find(
      (item) => item.monthId === october.id && item.cardId === 'c1',
    )!
    expect(
      after.expenses.filter((item) => item.invoiceId === invoice.id),
    ).toHaveLength(1)
    // Copied like "Criar mês": bills come unpaid, the leftover comes along.
    expect(
      after.bills.filter((item) => item.monthId === october.id),
    ).toHaveLength(2)
    expect(
      after.incomes.find(
        (item) => item.monthId === october.id && item.kind === 'carryover',
      ),
    ).toBeDefined()
    expect(launch.undo.apply(after).months).toEqual(finance.months)
  })
})

describe('modal Lançar', () => {
  const open = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    return screen.getByRole('dialog', { name: 'Lançar' })
  }

  it('Uber de R$ 12 no cartão, com Desfazer', async () => {
    renderApp('/meses/2026-09')
    const dialog = open()
    expect(within(dialog).getByLabelText('Valor')).toHaveFocus()
    fireEvent.change(within(dialog).getByLabelText('Valor'), {
      target: { value: '12,00' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Uber' },
    })
    expect(
      within(dialog).getByRole('radio', { name: 'Nubank Teste' }),
    ).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    await settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(spaced(document.querySelector('.app-toast')?.textContent)).toContain(
      'R$ 12,00 na fatura Nubank Teste',
    )
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'invoice_expenses',
        op: 'insert',
        payload: expect.objectContaining({
          invoice_id: 'v9a',
          amount: '12.00',
          description: 'Uber',
        }),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(writes()[1]).toMatchObject({ op: 'delete' }))
    expect(localStorage.getItem('aerarium.lancar.onde')).toBe('c1')
  })

  it('com o pai ligado: compra no cartão e parcelado podem ser dele; Pix não', async () => {
    renderApp('/meses/2026-09', undefined, {
      ...financeFixture(),
      otherPerson: 'Pai',
    })
    const dialog = open()
    fireEvent.change(within(dialog).getByLabelText('Valor'), {
      target: { value: '30,00' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pai' }))
    fireEvent.click(within(dialog).getByRole('radio', { name: /Pix/ }))
    expect(within(dialog).queryByRole('button', { name: 'Pai' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Parcelado' }))
    expect(within(dialog).getByRole('button', { name: 'Pai' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gasto' }))
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Nubank Teste' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    await settle()
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'invoice_expenses',
        payload: expect.objectContaining({ amount: '30.00', for_other: true }),
      }),
    )
  })

  it('usuário normal não vê "De quem"', () => {
    renderApp('/meses/2026-09')
    expect(within(open()).queryByText('De quem')).toBeNull()
  })

  it('sem valor, avisa; parcelado pede de 2 a 120 vezes e mostra a prévia', () => {
    renderApp('/meses/2026-09')
    const dialog = open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Coloca o valor. Exemplo: 12,50',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Parcelado' }))
    fireEvent.change(within(dialog).getByLabelText('Valor total da compra'), {
      target: { value: '1.200,00' },
    })
    fireEvent.change(within(dialog).getByLabelText('Em quantas vezes'), {
      target: { value: '10' },
    })
    expect(spaced(dialog.querySelector('.launch-preview')!.textContent)).toBe(
      '10x de R$ 120,00, começando este mês',
    )
    // The person picks the first month; the preview follows.
    const first = within(dialog).getByLabelText('Primeira parcela em')
    expect(first).toHaveValue('2026-09')
    expect(
      within(first).getByRole('option', { name: 'Outubro 2026' }),
    ).toBeInTheDocument()
    fireEvent.change(first, { target: { value: '2026-10' } })
    expect(spaced(dialog.querySelector('.launch-preview')!.textContent)).toBe(
      '10x de R$ 120,00, começando em outubro',
    )
    fireEvent.change(within(dialog).getByLabelText('Em quantas vezes'), {
      target: { value: '1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Em quantas vezes? Coloca um número de 2 a 120.',
    )
  })

  it('Pix mostra "Já paguei" marcado; o mês vem do que está aberto em Meses', () => {
    // The app opens on September (today's); August, archived, on purpose.
    renderApp('/meses/2026-09')
    fireEvent.click(
      screen.getByRole('button', { name: 'Setembro 2026. Escolher mês' }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Agosto 2026/ }))
    const dialog = open()
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'Pix, boleto ou dinheiro' }),
    )
    expect(
      within(dialog).getByRole('checkbox', { name: /Já paguei/ }),
    ).toBeChecked()
    expect(within(dialog).getByLabelText('Entra em')).toHaveValue('2026-08')
    expect(
      within(dialog).getByRole('option', { name: 'Outubro 2026 (novo)' }),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrada' }))
    expect(within(dialog).queryByText('Onde')).not.toBeInTheDocument()
  })

  it('cartão ligado ao banco não aparece no Onde: as compras chegam sozinhas', () => {
    const finance = financeFixture()
    renderApp('/meses/2026-09', undefined, {
      ...finance,
      bankAccounts: [
        {
          id: 'b1',
          pluggyAccountId: 'p1',
          itemId: 'i1',
          name: 'NUBANK',
          number: null,
          cardId: 'c1',
        },
      ],
    })
    const dialog = open()
    const where = within(dialog).getByRole('group', { name: 'Onde' })
    expect(
      within(where).queryByRole('radio', { name: 'Nubank Teste' }),
    ).not.toBeInTheDocument()
    expect(
      within(where).getByRole('radio', { name: /^Cartão com um nome/ }),
    ).toBeChecked()
    expect(where).toHaveTextContent(
      'Os cartões ligados ao banco não aparecem aqui',
    )
  })

  it('sem banco ligado, todos os cartões aparecem e nenhum aviso', () => {
    renderApp('/meses/2026-09')
    const where = within(open()).getByRole('group', { name: 'Onde' })
    expect(
      within(where).getByRole('radio', { name: 'Nubank Teste' }),
    ).toBeInTheDocument()
    expect(where).not.toHaveTextContent('ligados ao banco')
  })

  it('Pix com "Saiu de": grava o banco, mostra na linha e lembra da próxima vez', async () => {
    renderApp('/meses/2026-09')
    let dialog = open()
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'Pix, boleto ou dinheiro' }),
    )
    let from = within(dialog).getByRole('group', { name: 'Saiu de (opcional)' })
    // The banks of the cards first, then cash; any other bank in the list.
    expect(
      within(from)
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Nubank', 'Dinheiro'])
    fireEvent.change(within(from).getByLabelText('Outro banco'), {
      target: { value: 'santander' },
    })
    expect(
      within(from).getByRole('button', { name: 'Santander' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(within(dialog).getByLabelText('Valor'), {
      target: { value: '50,00' },
    })
    fireEvent.change(within(dialog).getByLabelText('Descrição'), {
      target: { value: 'Pix pro pedreiro' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'bills',
        op: 'insert',
        payload: expect.objectContaining({ paid_from: 'santander' }),
      }),
    )
    const row = screen.getByRole('button', { name: /^Pix pro pedreiro/ })
    expect(spaced(row.textContent)).toContain(
      'Pix pro pedreiroPix ou boleto · Santander',
    )

    dialog = open()
    fireEvent.click(
      within(dialog).getByRole('radio', { name: 'Pix, boleto ou dinheiro' }),
    )
    from = within(dialog).getByRole('group', { name: 'Saiu de (opcional)' })
    // Remembered; tapping it again clears it (a bank no card has goes back
    // to the list).
    const santander = within(from).getByRole('button', { name: 'Santander' })
    expect(santander).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(santander)
    expect(within(from).queryByRole('button', { name: 'Santander' })).toBeNull()
    expect(
      within(from).getByRole('option', { name: 'Santander' }),
    ).toBeInTheDocument()
  })

  it('sem nenhum mês, pede pra criar um primeiro', () => {
    renderApp('/cartoes', undefined, {
      ...financeFixture(),
      months: [],
      incomes: [],
      bills: [],
      invoices: [],
      expenses: [],
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Lançar gasto ou entrada' }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByText('Crie um mês primeiro, na aba Meses.'),
    ).toBeVisible()
  })
})
