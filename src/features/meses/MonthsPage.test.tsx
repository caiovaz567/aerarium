import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { financeKey } from '../../data/finance'
import { cents } from '../../domain/money'
import { isoDate, month, type Month } from '../../domain/months'
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
    // Saídas goes down with what was paid; the month's total and Disponível do not.
    expect(
      within(block('Saídas')).getByLabelText(/^Falta pagar/),
    ).toHaveTextContent(/R\$\s592,92/)
    expect(heroValue('Saídas')).toBe('R$ 873,17')
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
      target: { value: '550000' },
    })
    // Like a bank app: no comma to type, the dots and the comma come alone.
    expect(within(dialog).getByLabelText('Valor (R$)')).toHaveValue('5.500,00')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heroValue('Entradas')).toBe('R$ 5.600,00')
  })
})

describe('Saiu de', () => {
  it('na conta, escolher de onde saiu grava e aparece embaixo do nome', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Conta de luz/ }))
    const edit = screen.getByRole('dialog', { name: 'Editar conta' })
    const from = within(edit).getByRole('group', { name: 'Saiu de (opcional)' })
    fireEvent.click(within(from).getByRole('button', { name: 'Dinheiro' }))
    fireEvent.click(within(edit).getByRole('button', { name: 'Salvar' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'bills',
        op: 'update',
        payload: expect.objectContaining({ paid_from: 'cash' }),
      }),
    )
    expect(
      text(screen.getByRole('button', { name: /^Conta de luz/ }).textContent),
    ).toContain('Conta de luzDinheiro')
  })
})

describe('Fatura do cartão', () => {
  it('tocar no cartão abre Cartões nele, no mesmo mês', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    expect(
      await screen.findByRole('button', {
        name: /^Nubank Teste/,
        pressed: true,
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Fatura de setembro' }),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"Voltar pra Meses" volta pra onde estava na tela', async () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    renderApp('/meses/2026-09')
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: /^Nubank Teste/ }))
    // Cartões opens at the top.
    expect(scroll).toHaveBeenLastCalledWith(0, 0)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Voltar pra Meses' }),
    )
    expect(
      await screen.findByRole('region', { name: 'Resumo do mês' }),
    ).toBeVisible()
    expect(scroll).toHaveBeenLastCalledWith(0, 640)
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    scroll.mockRestore()
  })

  it('remover gasto lançado tem Desfazer', async () => {
    renderApp('/meses/2026-09')
    fireEvent.click(screen.getByRole('button', { name: 'Por data' }))
    fireEvent.click(screen.getByRole('button', { name: /^Uber/ }))
    const edit = screen.getByRole('dialog', { name: 'Editar gasto' })
    fireEvent.click(within(edit).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(
      within(edit).getByRole('button', { name: 'Toca de novo pra confirmar' }),
    )
    await settle()
    expect(screen.queryByRole('button', { name: /^Uber/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(screen.getByRole('button', { name: /^Uber/ })).toBeVisible()
    await waitFor(() =>
      expect(writes().map((call) => call.op)).toEqual(['delete', 'insert']),
    )
  })
})

describe('Criar e excluir mês', () => {
  it('outubro ainda não criado aparece como previsão, só pra ver', () => {
    renderApp('/meses/2026-10')
    expect(screen.getByRole('region', { name: 'Previsão' })).toBeVisible()
    // As if created: salary copied and September's leftover carried.
    expect(heroValue('Entradas')).toBe('R$ 9.226,83')
    expect(
      within(block('Entradas')).getByText('Sobrou do mês passado'),
    ).toBeVisible()
    // Only for looking: rows open nothing, but the views switch.
    fireEvent.click(within(block('Entradas')).getByText('Salário'))
    expect(screen.queryByRole('dialog')).toBeNull()
    const saidas = block('Saídas')
    fireEvent.click(within(saidas).getByRole('button', { name: 'Por data' }))
    expect(
      within(saidas).getByRole('button', { name: 'Por data' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(saidas).getByText('Notebook'))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Past the last installment (Notebook 10/10 in May 2027), no more months.
    renderApp('/meses/2027-05')
    expect(
      screen.getAllByRole('button', { name: 'Próximo mês' }).at(-1),
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /^Criar Maio/ }),
    ).not.toBeInTheDocument()
  })

  it('cria outubro copiando setembro e levando a sobra', async () => {
    renderApp('/meses/2026-10')
    fireEvent.click(screen.getByRole('button', { name: 'Criar Outubro 2026' }))
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

  it('virou o mês: outubro começa sozinho, abre nele e dá pra desfazer', async () => {
    vi.setSystemTime(new Date('2026-10-01T00:38:00-03:00'))
    renderApp('/meses/2026-09')
    // Opened on the month that ended: the new one shows.
    expect(
      await screen.findByText(/Outubro 2026 começou: copiei setembro/),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Resumo do mês' }),
    ).toHaveTextContent('Disponível em Outubro')
    await settle()
    expect(writes().map((call) => `${call.table}:${call.op}`)).toEqual([
      'months:insert',
      'incomes:insert',
      'bills:insert',
      'invoices:insert',
    ])
    // The carried rest is September's available.
    expect(writes()[1]).toMatchObject({
      payload: expect.arrayContaining([
        expect.objectContaining({ description: 'Sobrou do mês passado' }),
      ]),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(writes().at(-1)).toMatchObject({ table: 'months', op: 'delete' })
  })

  it('outubro já criado: o app abre num mês passado e vai pro de agora', async () => {
    vi.setSystemTime(new Date('2026-10-01T00:40:00-03:00'))
    const finance = financeFixture()
    renderApp('/meses/2026-09', undefined, {
      ...finance,
      months: [...finance.months, { id: 'm10', ref: month('2026-10') }],
    })
    expect(
      await screen.findByRole('region', { name: 'Resumo do mês' }),
    ).toHaveTextContent('Disponível em Outubro')
    await settle()
    expect(writes()).toEqual([])
    // Going back to September on purpose stays there.
    fireEvent.click(screen.getByRole('link', { name: 'Mês anterior' }))
    await settle()
    expect(
      screen.getByRole('region', { name: 'Resumo do mês' }),
    ).toHaveTextContent('Disponível em Setembro')
    // Opened again on an older month (August): today's, October, again.
    cleanup()
    renderApp('/meses/2026-08', undefined, {
      ...finance,
      months: [...finance.months, { id: 'm10', ref: month('2026-10') }],
    })
    expect(
      await screen.findByRole('region', { name: 'Resumo do mês' }),
    ).toHaveTextContent('Disponível em Outubro')
  })

  it('o mês que começou sozinho não volta se a pessoa apagar', async () => {
    vi.setSystemTime(new Date('2026-10-01T09:00:00-03:00'))
    localStorage.setItem('aerarium.mesIniciado', '2026-10')
    renderApp('/meses/2026-09')
    await settle()
    expect(writes()).toEqual([])
    expect(
      screen.getByRole('region', { name: 'Resumo do mês' }),
    ).toHaveTextContent('Disponível em Setembro')
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
  const withDad = (otherBankUntil: Month | null = month('2026-10')) => {
    const finance = financeFixture()
    return {
      ...finance,
      otherPerson: 'Pai',
      otherBankUntil,
      expenses: finance.expenses.map((item) =>
        item.description === 'Uber' ? { ...item, forOther: true } : item,
      ),
    }
  }

  it('a sua visão só tem o que é seu; o pai te deve a parte dele', async () => {
    renderApp('/meses/2026-09', undefined, withDad())
    // 873,17 minus the Uber 12,00 he bought; "outros" is yours.
    expect(heroValue('Saídas')).toBe('R$ 861,17')
    const nubank = screen.getByRole('button', { name: /^Nubank Teste/ })
    expect(text(nubank.textContent)).toContain('R$ 430,92')
    expect(text(nubank.textContent)).toContain('outros R$ 271')
    expect(text(nubank.textContent)).toContain('Pai R$ 12')
    const owed = screen.getByRole('region', { name: 'O que o Pai te deve' })
    expect(text(owed.textContent)).toContain('Pai te deve em SetembroR$ 12,00')
    fireEvent.click(within(owed).getByRole('button', { name: 'Pai pagou' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({
        table: 'incomes',
        op: 'insert',
        payload: expect.objectContaining({
          amount: '12.00',
          kind: 'from_other',
          description: 'Pai pagou',
        }),
      }),
    )
    // Settles his part; it is not your income.
    expect(heroValue('Entradas')).toBe('R$ 5.100,00')
    expect(screen.queryByText('Pai pagou', { selector: 'span' })).toBeNull()
    // Green, with a check: he paid all of September.
    expect(text(owed.textContent)).toBe(
      'Pai pagou SetembroR$ 12,00Devolveu tudo.Desfazer',
    )
    expect(owed).toHaveClass('settled')
    // His view says so too.
    const switcher = screen.getByRole('group', { name: 'Ver gastos de' })
    fireEvent.click(within(switcher).getByRole('button', { name: 'Pai' }))
    const dad = screen.getByRole('region', { name: 'Resumo do Pai' })
    expect(text(dad.textContent)).toContain('Pagou tudo de setembro.')
    // Undo from there: owes again, in both views.
    fireEvent.click(within(dad).getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(writes()).toContainEqual(
      expect.objectContaining({ table: 'incomes', op: 'delete' }),
    )
    expect(text(dad.textContent)).toContain('Falta ele te devolver R$ 12,00.')
    fireEvent.click(within(dad).getByRole('button', { name: 'Pai pagou' }))
    await settle()
    expect(text(dad.textContent)).toContain('Pagou tudo de setembro.')
    fireEvent.click(within(switcher).getByRole('button', { name: 'Eu' }))
    localStorage.removeItem('aerarium.perfil')
  })

  it('devolveu uma parte: diz quanto falta, e dá pra desfazer', async () => {
    const finance = withDad()
    renderApp('/meses/2026-09', undefined, {
      ...finance,
      incomes: [
        ...finance.incomes,
        {
          id: 'volta',
          monthId: finance.months.find((item) => item.ref === '2026-09')!.id,
          month: month('2026-09'),
          description: 'Pai pagou',
          amount: cents(500),
          kind: 'from_other',
          sortOrder: 9,
        },
      ],
    })
    const owed = screen.getByRole('region', { name: 'O que o Pai te deve' })
    expect(text(owed.textContent)).toContain('Já devolveu R$ 5,00 de R$ 12,00')
    fireEvent.click(within(owed).getByRole('button', { name: 'Desfazer' }))
    await settle()
    expect(text(owed.textContent)).toContain('Parte dele nas faturas: R$ 12,00')
    fireEvent.click(screen.getByRole('button', { name: 'Refazer' }))
    await settle()
    expect(text(owed.textContent)).toContain('Já devolveu R$ 5,00')
    const switcher = screen.getByRole('group', { name: 'Ver gastos de' })
    fireEvent.click(within(switcher).getByRole('button', { name: 'Pai' }))
    expect(
      text(screen.getByRole('region', { name: 'Resumo do Pai' }).textContent),
    ).toContain('Falta ele te devolver R$ 7,00 (já devolveu R$ 5,00).')
    fireEvent.click(within(switcher).getByRole('button', { name: 'Eu' }))
    localStorage.removeItem('aerarium.perfil')
  })

  it('na visão do Pai, um gasto dele pode voltar a ser seu', async () => {
    localStorage.removeItem('aerarium.perfil')
    renderApp('/meses/2026-09', undefined, withDad())
    const switcher = screen.getByRole('group', { name: 'Ver gastos de' })
    fireEvent.click(within(switcher).getByRole('button', { name: 'Pai' }))
    fireEvent.click(screen.getByRole('button', { name: 'Por data' }))
    fireEvent.click(screen.getByRole('button', { name: /^Uber/ }))
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
    localStorage.removeItem('aerarium.perfil')
  })

  it('seletor Eu | Pai: a visão do pai mostra só os gastos dele', () => {
    localStorage.removeItem('aerarium.perfil')
    renderApp('/meses/2026-09', undefined, withDad())
    const switcher = screen.getByRole('group', { name: 'Ver gastos de' })
    fireEvent.click(within(switcher).getByRole('button', { name: 'Pai' }))
    const dad = screen.getByRole('region', { name: 'Resumo do Pai' })
    expect(text(dad.textContent)).toContain('Gastos do Pai em Setembro')
    expect(text(dad.textContent)).toContain('R$ 12,00')
    // The total once: the cards are in "Por tipo", not repeated here.
    expect(dad).not.toHaveTextContent('Nubank Teste')
    expect(screen.queryByRole('region', { name: 'Resumo do mês' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Entradas' })).toBeNull()
    expect(localStorage.getItem('aerarium.perfil')).toBe('other')
    // Same three views as yours, "Por tipo" first: his part card by card.
    const views = screen.getByRole('group', { name: 'Ver compras do Pai' })
    expect(
      within(views)
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Por tipo', 'Por data', 'Por categoria'])
    const byType = screen.getByRole('group', { name: 'Por tipo' })
    const card = within(byType).getByRole('button', { name: /^Nubank Teste/ })
    // One kind only: no value repeated under the card's.
    expect(text(card.textContent)).toBe('Nubank TesteR$ 12,001 compra')
    expect(byType.querySelector('.grp-h b')).toBeNull()
    expect(within(byType).queryByText('Uber')).toBeNull()
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
    expect(within(byType).getByText('Uber')).toBeVisible()
    fireEvent.click(within(switcher).getByRole('button', { name: 'Eu' }))
    expect(heroValue('Saídas')).toBe('R$ 861,17')
  })

  it('Por tipo do pai: as compras mais novas primeiro, as parcelas depois', () => {
    const base = withDad()
    renderApp('/meses/2026-09', undefined, {
      ...base,
      expenses: [
        ...base.expenses,
        {
          id: 'e2',
          invoiceId: 'v9a',
          description: 'Posto',
          amount: cents(5000),
          spentOn: isoDate('2026-09-20'),
          occurredAt: '2026-09-20T18:13:00.000Z',
          categoryId: null,
          forOther: true,
        },
      ],
      plans: base.plans.map((plan) =>
        plan.id === 'p1' ? { ...plan, forOther: true } : plan,
      ),
    })
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Ver gastos de' })).getByRole(
        'button',
        { name: 'Pai' },
      ),
    )
    const byType = screen.getByRole('group', { name: 'Por tipo' })
    fireEvent.click(within(byType).getByRole('button', { name: /^Nubank/ }))
    expect(
      within(byType)
        .getAllByRole('button')
        .slice(1)
        .map((row) => text(row.textContent)),
    ).toEqual([
      'Posto20/09 15:13 · Nubank TesteR$ 50,00',
      'Uber03/09 · Nubank TesteR$ 12,00',
      'Notebookparcela 2/10 · Nubank TesteR$ 120,00',
    ])
    localStorage.removeItem('aerarium.perfil')
  })

  it('sem outra pessoa, não tem seletor e a visão é sempre a sua', () => {
    localStorage.setItem('aerarium.perfil', 'other')
    renderApp('/meses/2026-09')
    expect(screen.queryByRole('group', { name: 'Ver gastos de' })).toBeNull()
    expect(heroValue('Saídas')).toBe('R$ 873,17')
    localStorage.removeItem('aerarium.perfil')
  })

  it('a partir de outubro: a parte do pai é só o marcado', () => {
    renderApp('/meses/2026-09', undefined, withDad(month('2026-09')))
    expect(
      text(
        screen.getByRole('region', { name: 'O que o Pai te deve' }).textContent,
      ),
    ).toContain('R$ 12,00')
  })

  it('meses antigos: total no banco menos o seu é a parte do pai', () => {
    const finance = withDad()
    renderApp('/meses/2026-09', undefined, {
      ...finance,
      invoices: finance.invoices.map((item) =>
        item.cardId === 'c1' && item.month === month('2026-09')
          ? { ...item, bankTotal: cents(1_000_00) }
          : item,
      ),
    })
    // Yours: 442,92 minus his Uber 12,00.
    expect(
      text(
        screen.getByRole('region', { name: 'O que o Pai te deve' }).textContent,
      ),
    ).toContain('R$ 569,08')
    // Your own numbers do not change.
    expect(heroValue('Saídas')).toBe('R$ 861,17')
  })
})
