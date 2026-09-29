import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeKey } from '../../data/finance'
import { financeFixture } from '../../test/financeFixture'
import { renderApp as render } from '../../test/renderApp'

const fake = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('../../test/fakeSupabase').fakeSupabase
  > | null,
  // Reloading after a change returns what is on screen, like the real database would.
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

const text = (value: string | null) => value?.replace(/\s/g, ' ')
const hero = () => screen.getByRole('region', { name: 'Resumo do mês' })
const heroValue = (label: string) =>
  text(within(hero()).getByText(label).nextElementSibling!.textContent)
const block = (name: string) => screen.getByRole('region', { name })
/** Lets the optimistic update land (it runs after cancelling pending loads). */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const writes = () => fake.current!.calls.filter((call) => call.op !== 'select')

describe('Meses: números batem com as contas feitas à mão', () => {
  it('resumo de setembro', () => {
    renderApp('/meses/2026-09')
    expect(within(hero()).getByText(/Disponível em Setembro/)).toBeVisible()
    expect(text(within(hero()).getByText(/4\.226,83/).textContent)).toBe(
      'R$ 4.226,83',
    )
    expect(heroValue('Entradas')).toBe('R$ 5.100,00')
    expect(heroValue('Saídas')).toBe('R$ 873,17')
    expect(heroValue('Falta pagar')).toBe('R$ 773,27')
    expect(
      screen.getByText('17% do que entrou já está comprometido'),
    ).toBeInTheDocument()
    expect(within(hero()).queryByText('No vermelho')).not.toBeInTheDocument()
  })

  it('saídas em três grupos, com composição e observação só quando diz algo', () => {
    renderApp('/meses/2026-09')
    const outflows = block('Saídas')
    expect(within(outflows).getByText('1 de 5 pagas')).toBeInTheDocument()
    for (const group of ['Cartões', 'Parcelas', 'Contas e outros'])
      expect(within(outflows).getByText(group)).toBeInTheDocument()
    expect(within(outflows).getByText('iPhone 2/12')).toBeInTheDocument()
    expect(
      [...outflows.querySelectorAll('.part')].map((node) =>
        text(node.textContent),
      ),
    ).toEqual([
      'Notebook R$ 120',
      'Streaming R$ 40',
      'Uber R$ 12',
      'outros R$ 271',
    ])
    // The long-name card's note just repeats its name, so it is hidden.
    expect(
      within(outflows).queryByText(/^Fatura Cartão com um nome/),
    ).not.toBeInTheDocument()
    expect(within(outflows).getByText('estimada')).toBeInTheDocument()
    expect(
      within(outflows).getByText('2/4 · faltam 3 · aparelho'),
    ).toBeVisible()
  })

  it('agosto: dica de sobra em setembro usa o valor com que agosto fechou', async () => {
    renderApp('/meses/2026-09')
    expect(text(screen.getByText(/fechou com/).textContent)).toBe(
      'Agosto fechou com R$ 2.990,10.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Usar esse valor' }))
    await settle()
    expect(heroValue('Entradas')).toBe('R$ 7.990,10')
    expect(screen.queryByText(/fechou com/)).not.toBeInTheDocument()
    await waitFor(() =>
      expect(writes()).toEqual([
        expect.objectContaining({
          table: 'incomes',
          op: 'update',
          payload: expect.objectContaining({ amount: '2990.10' }),
          filters: [['id', 'i9c']],
        }),
      ]),
    )
  })
})

describe('Meses: mudanças', () => {
  it('marcar conta como paga atualiza na hora e grava', async () => {
    renderApp('/meses/2026-09')
    const check = screen.getByRole('button', {
      name: 'Marcar como pago: Conta de luz',
    })
    fireEvent.click(check)
    await settle()
    expect(
      screen.getByRole('button', { name: 'Pago: Conta de luz' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(heroValue('Falta pagar')).toBe('R$ 592,92')
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'bills',
        op: 'update',
        payload: { paid: true },
        filters: [['id', 'b9a']],
      }),
    )
  })

  it('quando não salva, volta atrás e avisa', async () => {
    renderApp('/meses/2026-09')
    fake.current!.failNext()
    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar como pago: Conta de luz' }),
    )
    await settle()
    await screen.findByText(
      'Não consegui salvar. Confere a internet e tenta de novo.',
    )
    expect(
      screen.getByRole('button', { name: 'Marcar como pago: Conta de luz' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(heroValue('Falta pagar')).toBe('R$ 773,27')
  })

  it('pagar a fatura paga também as parcelas do cartão', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Marcar como pago: fatura Nubank Teste',
      }),
    )
    await settle()
    expect(heroValue('Falta pagar')).toBe('R$ 330,35')
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'invoices',
        payload: { paid: true },
      }),
    )
  })

  it('pagar parcela fora do cartão registra o pagamento, com Desfazer', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar como pago: Dentista' }),
    )
    await settle()
    expect(screen.getByText('2/4 · faltam 2 · aparelho')).toBeVisible()
    expect(screen.getByText('Dentista: faltam 2')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(screen.getByText('2/4 · faltam 3 · aparelho')).toBeVisible()
    await waitFor(() =>
      expect(writes().map((call) => call.op)).toEqual(['insert', 'delete']),
    )
    expect(writes()[0]).toMatchObject({
      table: 'installment_payments',
      payload: expect.objectContaining({
        plan_id: 'p2',
        month: '2026-09-01',
        source: 'manual',
      }),
    })
  })

  it('lixeira exclui e o aviso desfaz com o mesmo registro', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Internet' }))
    await settle()
    expect(screen.queryByText('Internet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(screen.getByText('Internet')).toBeVisible()
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1]).toMatchObject({
      table: 'bills',
      op: 'insert',
      payload: expect.objectContaining({ id: 'b9b', amount: '99.90' }),
    })
  })

  it('editar entrada valida o valor', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Salário/ }))
    const dialog = screen.getByRole('dialog', { name: 'Editar entrada' })
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), {
      target: { value: 'abc' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    // Letters never reach the field: only digits count.
    expect(within(dialog).getByLabelText('Valor (R$)')).toHaveValue('')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Coloca um valor.',
    )
    fireEvent.change(within(dialog).getByLabelText('Valor (R$)'), {
      target: { value: '5500' },
    })
    // Thousands dots appear by themselves.
    expect(within(dialog).getByLabelText('Valor (R$)')).toHaveValue('5.500')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heroValue('Entradas')).toBe('R$ 5.600,00')
  })
})

describe('Resumo da fatura', () => {
  const open = () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    return screen.getByRole('dialog', { name: 'Fatura Nubank Teste' })
  }

  it('mostra o que entra sozinho, os gastos e o total', () => {
    const dialog = open()
    expect(within(dialog).getByText('Já entram sozinhas')).toBeVisible()
    expect(within(dialog).getByText('parcela 2/10')).toBeVisible()
    expect(within(dialog).getByText('assinatura · dia 10')).toBeVisible()
    expect(within(dialog).getByText('03/09')).toBeVisible()
    expect(
      text(
        within(dialog).getByText('Total da fatura').nextSibling!.textContent,
      ),
    ).toBe('R$ 442,92')
  })

  it('"Sei o total" recusa valor menor que o fixo e aceita o resto', async () => {
    const dialog = open()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sei o total da fatura' }),
    )
    const total = within(dialog).getByLabelText('Total da fatura')
    fireEvent.change(total, { target: { value: '100,00' } })
    expect(
      within(dialog).getByText('Total da fatura', { selector: 'span' })
        .nextSibling,
    ).toHaveClass('bad')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'O total não pode ser menor que parcelas + assinaturas + gastos lançados (R$ 171,90).',
    )
    fireEvent.change(total, { target: { value: '500,00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(writes()[0]).toMatchObject({
        table: 'invoices',
        payload: {
          other_amount: '328.10',
          estimated: false,
          note: 'iPhone 2/12',
        },
      }),
    )
  })

  it('remover gasto lançado tem Desfazer', async () => {
    const dialog = open()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Remover Uber' }),
    )
    await settle()
    expect(within(dialog).queryByText('Uber')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(within(dialog).getByText('Uber')).toBeVisible()
    await waitFor(() =>
      expect(writes().map((call) => call.op)).toEqual(['delete', 'insert']),
    )
  })
})

describe('Criar e excluir mês', () => {
  it('cria outubro copiando setembro e levando a sobra', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Criar próximo mês' }))
    const dialog = screen.getByRole('dialog', { name: 'Criar Outubro 2026' })
    expect(
      text(within(dialog).getByText(/Levar a sobra de Setembro/).textContent),
    ).toBe('Levar a sobra de Setembro: R$ 4.226,83')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar mês' }))
    await settle()
    expect(screen.getByText('Outubro')).toBeVisible()
    expect(screen.getByText('Outubro 2026 criado')).toBeVisible()
    const incomes = block('Entradas')
    expect(within(incomes).getByText('Sobrou do mês passado')).toBeVisible()
    expect(heroValue('Entradas')).toBe('R$ 9.226,83')
    // Bills come unpaid; each card gets an estimated invoice.
    expect(screen.getByText('0 de 5 pagas')).toBeVisible()
    await waitFor(() =>
      expect(writes().map((call) => `${call.table}:${call.op}`)).toEqual([
        'months:insert',
        'incomes:insert',
        'bills:insert',
        'invoices:insert',
      ]),
    )
  })

  it('lista de meses leva ao mês, e excluir tem Desfazer', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(
      screen.getByRole('button', { name: 'Setembro 2026. Escolher mês' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Seus meses' })
    expect(
      within(dialog).getByText('R$ 2.990,10', { exact: false }),
    ).toBeVisible()
    const remove = within(dialog).getByRole('button', {
      name: 'Excluir Setembro 2026',
    })
    fireEvent.click(remove)
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Toca de novo pra confirmar',
      }),
    )
    await settle()
    expect(screen.getByText('Agosto')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(screen.getByText('Setembro')).toBeVisible()
    expect(heroValue('Saídas')).toBe('R$ 873,17')
    await waitFor(() =>
      expect(writes().map((call) => `${call.table}:${call.op}`)).toEqual([
        'months:delete',
        'months:insert',
        'incomes:insert',
        'bills:insert',
        'invoices:insert',
        'invoice_expenses:insert',
      ]),
    )
  })

  it('conta sem meses oferece criar o mês atual', () => {
    renderApp('/meses', undefined, {
      cards: [],
      categories: [],
      months: [],
      incomes: [],
      bills: [],
      invoices: [],
      expenses: [],
      plans: [],
      payments: [],
      subscriptions: [],
      bankAccounts: [],
      bankRecords: [],
    })
    expect(screen.getByText('Nenhum mês ainda')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Criar / })).toBeVisible()
  })
})

describe('Pai usa os cartões', () => {
  const withDad = () => {
    const finance = financeFixture()
    return {
      ...finance,
      otherPerson: 'Pai',
      restIsOther: true,
      expenses: finance.expenses.map((item) =>
        item.description === 'Uber' ? { ...item, forOther: true } : item,
      ),
    }
  }

  it('a sua visão só tem o que é seu; o pai te deve a parte dele', async () => {
    renderApp('/meses/2026-09', undefined, withDad())
    // 873,17 minus Uber 12,00 and "outros" 271,02, both his.
    expect(heroValue('Saídas')).toBe('R$ 590,15')
    const nubank = screen.getByRole('button', { name: /^Nubank Teste/ })
    expect(text(nubank.textContent)).toContain('R$ 159,90')
    expect(text(nubank.textContent)).toContain('Pai R$ 283')
    expect(text(nubank.textContent)).not.toContain('outros')
    const owed = screen.getByRole('region', { name: 'O que o Pai te deve' })
    // Uber 12,00 plus "outros" 271,02.
    expect(text(owed.textContent)).toContain('Pai te deve em SetembroR$ 283,02')
    fireEvent.click(within(owed).getByRole('button', { name: 'Pai pagou' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'incomes',
        op: 'insert',
        payload: expect.objectContaining({
          amount: '283.02',
          kind: 'from_other',
          description: 'Pai pagou',
        }),
      }),
    )
    // Settles his part; it is not your income.
    expect(heroValue('Entradas')).toBe('R$ 5.100,00')
    expect(screen.queryByText('Pai pagou', { selector: 'span' })).toBeNull()
    expect(text(owed.textContent)).toContain('R$ 0,00')
    expect(text(owed.textContent)).toContain('Já devolveu R$ 283,02')
  })

  it('na fatura, a compra dele tem a etiqueta; dá pra marcar como sua', async () => {
    renderApp('/meses/2026-09', undefined, withDad())
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    const invoice = screen.getByRole('dialog', { name: 'Fatura Nubank Teste' })
    const uber = within(invoice).getByRole('button', { name: /^Uber/ })
    expect(within(uber).getByText('Pai')).toBeVisible()
    fireEvent.click(uber)
    const edit = screen.getByRole('dialog', { name: 'Editar gasto' })
    const who = within(edit).getByRole('group', { name: 'De quem' })
    expect(within(who).getByRole('button', { name: 'Pai' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(who).getByRole('button', { name: 'Meu' }))
    fireEvent.click(within(edit).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'invoice_expenses',
        op: 'update',
        payload: expect.objectContaining({ for_other: false }),
      }),
    )
    expect(
      text(
        screen.getByRole('region', { name: 'O que o Pai te deve' }).textContent,
      ),
    ).toContain('R$ 271,02')
  })

  it('seletor Eu | Pai: a visão do pai mostra só os gastos dele', () => {
    localStorage.removeItem('aerarium.perfil')
    renderApp('/meses/2026-09', undefined, withDad())
    const switcher = screen.getByRole('group', { name: 'Ver gastos de' })
    fireEvent.click(within(switcher).getByRole('button', { name: 'Pai' }))
    const dad = screen.getByRole('region', { name: 'Resumo do Pai' })
    expect(text(dad.textContent)).toContain('Gastos do Pai em Setembro')
    // Uber 12,00 plus "outros" 271,02.
    expect(text(dad.textContent)).toContain('R$ 283,02')
    expect(text(dad.textContent)).toContain('Nubank TesteR$ 283,02')
    expect(screen.queryByRole('region', { name: 'Resumo do mês' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Entradas' })).toBeNull()
    expect(localStorage.getItem('aerarium.perfil')).toBe('other')
    fireEvent.click(within(switcher).getByRole('button', { name: 'Eu' }))
    expect(heroValue('Saídas')).toBe('R$ 590,15')
  })

  it('sem outra pessoa, não tem seletor e a visão é sempre a sua', () => {
    localStorage.setItem('aerarium.perfil', 'other')
    renderApp('/meses/2026-09')
    expect(screen.queryByRole('group', { name: 'Ver gastos de' })).toBeNull()
    expect(heroValue('Saídas')).toBe('R$ 873,17')
    localStorage.removeItem('aerarium.perfil')
  })
})
