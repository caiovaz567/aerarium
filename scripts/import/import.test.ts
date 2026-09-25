import { describe, expect, it } from 'vitest'
import { invoiceTotals } from '../../src/domain/invoices'
import { isoDate } from '../../src/domain/months'
import { mapBackup, stableId, toFinancialData } from './mapBackup'
import { compareWithV1, formatComparison } from './report'
import { importSql, lit, lookupUserSql } from './sql'
import { cleanDesc, norm, parseBackup, v1PlanMonths } from './v1'

// Fictitious data only. The real backup never enters tests.
const USER = '11111111-1111-4111-8111-111111111111'
const today = isoDate('2026-10-15')

const cards = {
  a: {
    nome: 'Cartão Teste',
    ordem: 1,
    saida: 'fatura cartao teste',
    saidaNome: 'Fatura Cartão Teste',
  },
  b: {
    nome: 'Outro Banco',
    ordem: 2,
    saida: 'fatura outro banco',
    saidaNome: 'Fatura Outro Banco',
  },
}

function consistentBackup() {
  return parseBackup({
    cartoes: cards,
    assinaturas: {
      s1: { nome: 'Streaming', dia: 10, valor: 20, cartaoId: 'b' },
    },
    parcelamentos: {
      // Payments skip August: v1 moved the rest to October, v2 keeps the fixed schedule.
      walk: {
        item: 'Notebook',
        valor: 100,
        faltam: 1,
        cartao: 'a',
        pagamentos: [
          { mes: '2026-07', data: '2026-07-10' },
          { mes: '2026-09', data: '2026-09-10' },
        ],
      },
      paidByInvoice: {
        item: 'Fone',
        valor: 200,
        faltam: 0,
        cartao: 'b',
        pagamentos: [{ mes: '2026-09', data: '2026-09-05', via: 'mes' }],
      },
      late: {
        item: 'Cadeira',
        valor: 10,
        faltam: 2,
        cartao: 'b',
        obs: 'presente',
        pagamentos: [{ mes: '2026-08', data: '2026-08-20' }],
      },
      loose: { item: 'Curso', valor: 40, faltam: 3 },
    },
    months: {
      '2026-08': {
        entradas: [
          { id: 'e1', desc: 'Salário', valor: 1000 },
          { id: 'e2', desc: 'Sobrou do mês passado', valor: -50 },
        ],
        saidas: [
          { id: 's1', desc: 'Fatura Cartão Teste 2/10', valor: 50, outros: 50 },
          { id: 's2', desc: 'Aluguel', valor: 300, pago: true },
        ],
      },
      '2026-09': {
        entradas: [{ id: 'e1', desc: 'Salário', valor: 1000 }],
        saidas: [
          {
            id: 's3',
            desc: 'Fatura Outro Banco (Ana dar 5)',
            valor: 330.3,
            outros: 100.3,
            pago: true,
          },
        ],
      },
      '2026-10': {
        entradas: [{ id: 'e1', desc: 'Salário', valor: 1000 }],
        saidas: [
          {
            id: 's1',
            desc: 'Fatura Cartão Teste',
            valor: 120,
            outros: 20,
            obs: 'mercado',
            gastos: [{ id: 'g1', desc: 'Uber', valor: 12, data: '2026-10-02' }],
          },
          {
            id: 's4',
            desc: 'Fatura Outro Banco',
            valor: 30,
            outros: 0,
            est: true,
          },
          { id: 'p1', desc: 'Curso', valor: 40, parc: 'loose' },
          { id: 's5', desc: "Conta d'água", valor: 0 },
        ],
      },
    },
  })
}

describe('regras da v1', () => {
  it('normaliza descrições como a v1', () => {
    expect(cleanDesc('Cartão Santander + iPhone 1/12 (dividido)')).toBe(
      'Cartão Santander + iPhone',
    )
    expect(norm('Fatura Itaú (Lucas dar 5)')).toBe('fatura itau')
  })
  it('parcelas da v1 andam a partir de hoje e pulam meses pagos', () => {
    const months = v1PlanMonths(
      consistentBackup().parcelamentos.walk!,
      '2026-10' as never,
    )
    expect([...months]).toEqual([
      ['2026-07', 'pago'],
      ['2026-09', 'pago'],
      ['2026-10', 'aberto'],
    ])
  })
  it('recusa backup malformado', () => {
    expect(() => parseBackup([])).toThrow()
    expect(() => parseBackup({ months: { '2026-13': {} } })).toThrow()
    expect(() =>
      parseBackup({ months: { '2026-09': { saidas: {} } } }),
    ).toThrow()
    expect(() => parseBackup({ cartoes: 'x' })).toThrow()
  })
})

describe('mapeamento', () => {
  const data = mapBackup(consistentBackup(), { userId: USER, today })

  it('separa faturas, contas, sobra e ignora linhas derivadas de parcela', () => {
    expect(data.cards.map((card) => card.name)).toEqual([
      'Cartão Teste',
      'Outro Banco',
    ])
    expect(data.invoices).toHaveLength(4)
    expect(data.bills.map((bill) => bill.description)).toEqual([
      'Aluguel',
      "Conta d'água",
    ])
    expect(data.bills[0]).toMatchObject({ paid: true, paidOn: today })
    expect(data.incomes.find((item) => item.amount < 0)).toMatchObject({
      kind: 'carryover',
    })
    expect(
      data.outflows.filter((item) => item.target.type === 'loose'),
    ).toHaveLength(1)
  })

  it('observação: obs vence; senão a descrição quando diz algo a mais', () => {
    const notes = data.invoices.map((item) => item.note)
    expect(notes).toEqual([
      'Fatura Cartão Teste 2/10',
      'Fatura Outro Banco (Ana dar 5)',
      'mercado',
      null,
    ])
  })

  it('outros da v2 desconta os gastos lançados, que viram gastos da fatura', () => {
    const october = data.invoices.find(
      (item) => item.month === '2026-10' && item.note === 'mercado',
    )!
    expect(october.otherAmount).toBe(800)
    expect(data.expenses).toEqual([
      expect.objectContaining({
        invoiceId: october.id,
        amount: 1200,
        spentOn: '2026-10-02',
        description: 'Uber',
      }),
    ])
  })

  it('cronograma fixo: total = faltam + pagamentos, primeiro mês = menor pagamento ou hoje', () => {
    const byName = (name: string) =>
      data.plans.find((plan) => plan.description === name)!
    expect(byName('Notebook')).toMatchObject({
      firstMonth: '2026-07',
      totalInstallments: 3,
    })
    expect(byName('Fone')).toMatchObject({
      firstMonth: '2026-09',
      totalInstallments: 1,
    })
    expect(byName('Cadeira')).toMatchObject({
      firstMonth: '2026-08',
      totalInstallments: 3,
      note: 'presente',
    })
    expect(byName('Curso')).toMatchObject({
      firstMonth: '2026-10',
      totalInstallments: 3,
      cardId: null,
    })
  })

  it('pagamento "via mês" vem da fatura paga; a fatura congela com a data dele', () => {
    const september = data.invoices.find((item) => item.month === '2026-09')!
    expect(september).toMatchObject({
      paid: true,
      paidOn: '2026-09-05',
      closedTotal: 33030,
    })
    expect(data.payments.map((item) => item.source)).toEqual([
      'manual',
      'manual',
      'manual',
    ])
    expect(data.invoicePayments).toHaveLength(2)
    expect(data.autoPaid).toEqual([
      'Cadeira (2026-09) passa a contar como paga, porque a fatura do Outro Banco desse mês está paga.',
    ])
    expect(invoiceTotals(september, toFinancialData(data)).total).toBe(33030)
  })

  it('ids estáveis: mesma conta, mesmos ids; outra conta, outros ids', () => {
    const again = mapBackup(consistentBackup(), { userId: USER, today })
    expect(again.invoices.map((item) => item.id)).toEqual(
      data.invoices.map((item) => item.id),
    )
    expect(stableId(USER, 'card', 'a')).not.toBe(
      stableId('22222222-2222-4222-8222-222222222222', 'card', 'a'),
    )
    expect(stableId(USER, 'card', 'a')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

describe('relatório de conferência', () => {
  const backup = consistentBackup()
  const data = mapBackup(backup, { userId: USER, today })
  const report = compareWithV1(backup, data, today)

  it('só aponta diferenças explicadas pelo cronograma fixo, uma por linha', () => {
    expect(
      report.differences.map((item) => [
        item.explained,
        item.text.replace(/\s/g, ' '),
      ]),
    ).toEqual([
      [
        true,
        'Agosto 2026 · Fatura Cartão Teste: v1 R$ 50,00, v2 R$ 150,00 (+R$ 100,00). Cronograma fixo: entram Notebook.',
      ],
      [
        true,
        'Outubro 2026 · Fatura Cartão Teste: v1 R$ 120,00, v2 R$ 20,00 (-R$ 100,00). Cronograma fixo: saem Notebook.',
      ],
    ])
    expect(report.months.find((row) => row.month === '2026-09')!.v1).toEqual(
      report.months.find((row) => row.month === '2026-09')!.v2,
    )
  })

  it('marca para conferir o que o cronograma não explica', () => {
    const tampered = parseBackup({
      ...backup,
      months: {
        ...backup.months,
        '2026-09': {
          entradas: [],
          saidas: [{ desc: 'Fatura Outro Banco', valor: 999, outros: 0 }],
        },
      },
    })
    const result = compareWithV1(
      tampered,
      mapBackup(tampered, { userId: USER, today }),
      today,
    )
    expect(
      result.differences.find((item) => item.month === '2026-09'),
    ).toMatchObject({ explained: false })
  })

  it('texto do relatório lista meses, diferenças e avisos', () => {
    const text = formatComparison(report, data)
    expect(text).toContain('Outubro 2026')
    expect(text).toContain('[cronograma fixo]')
    expect(text).toContain('Parcelas pagas pela fatura')
    expect(text).not.toContain('[CONFERIR]')
  })
})

describe('avisos de dados estranhos', () => {
  const backup = parseBackup({
    cartoes: { a: cards.a },
    assinaturas: {
      s1: { nome: 'Sem valor', dia: 5, valor: 0 },
      s2: { nome: 'Dia ruim', dia: 40, valor: 9, cartaoId: 'sumiu' },
    },
    parcelamentos: {
      zero: { item: 'Nada', valor: 0, faltam: 2 },
      gone: { item: 'Órfã', valor: 10, faltam: 1, cartao: 'sumiu' },
      gap: {
        item: 'Pulou',
        valor: 10,
        faltam: 0,
        pagamentos: [
          { mes: '2026-01', data: '2026-01-01' },
          { mes: '2026-04', data: '2026-04-01' },
        ],
      },
      mes: {
        item: 'Via mês',
        valor: 5,
        faltam: 0,
        cartao: 'a',
        pagamentos: [{ mes: '2026-09', via: 'mes' }],
      },
    },
    months: {
      '2026-09': {
        entradas: [
          { desc: 'Sobra', valor: 1 },
          { desc: 'Sobrou também', valor: 2 },
        ],
        saidas: [
          {
            desc: 'Fatura Cartão Teste',
            valor: 5,
            outros: 1,
            gastos: [{ desc: 'Táxi', valor: 3, data: 'ontem' }],
          },
          { desc: 'Fatura Cartão Teste', valor: 7 },
        ],
      },
    },
  })
  const data = mapBackup(backup, { userId: USER, today })

  it('explica cada ajuste em um aviso', () => {
    expect(data.warnings).toEqual([
      'Parcelamento "Nada" sem valor: não foi importado.',
      '"Órfã" apontava pra um cartão que não existe mais: foi importado fora de cartão.',
      '"Pulou": os pagamentos pulam meses, então o cronograma fixo ficou com 4 parcelas em vez de 2.',
      'Pagamento de "Via mês" em 2026-09 sem data: usei 2026-10-15.',
      '2026-09: mais de uma entrada de sobra; "Sobrou também" virou entrada comum.',
      '2026-09: gasto "Táxi" sem data válida: usei o dia 1º.',
      '2026-09: "outros" do Cartão Teste ficou negativo; importado como zero.',
      '2026-09: "Fatura Cartão Teste" é uma segunda fatura do Cartão Teste; entrou como conta.',
      '"Via mês" 2026-09: pago pela fatura, mas a fatura não está paga; virou pagamento manual.',
      'Assinatura "Sem valor" sem valor: não foi importada.',
      'Assinatura "Dia ruim" sem dia de cobrança válido: usei o dia 1.',
      'Assinatura "Dia ruim" apontava pra um cartão que não existe mais: ficou sem cartão.',
    ])
    expect(data.subscriptions).toEqual([
      expect.objectContaining({ chargeDay: 1, cardId: null }),
    ])
    expect(data.bills).toHaveLength(1)
  })

  it('recusa entrada ou saída negativa e mais de 120 parcelas', () => {
    const bad =
      (months: object, parcelamentos = {}) =>
      () =>
        mapBackup(parseBackup({ months, parcelamentos }), {
          userId: USER,
          today,
        })
    expect(
      bad({ '2026-09': { entradas: [{ desc: 'x', valor: -1 }] } }),
    ).toThrow('negativa')
    expect(bad({ '2026-09': { saidas: [{ desc: 'x', valor: -1 }] } })).toThrow(
      'negativa',
    )
    expect(bad({}, { big: { item: 'x', valor: 1, faltam: 121 } })).toThrow(
      '120',
    )
  })
})

describe('SQL', () => {
  const data = mapBackup(consistentBackup(), { userId: USER, today })

  it('escapa textos e recusa valores que não são seguros', () => {
    expect(lit("d'água")).toBe("'d''água'")
    expect(lit(null)).toBe('null')
    expect(lit(true)).toBe('true')
    expect(() => lit(1.5)).toThrow()
    expect(() => lit('a\0b')).toThrow()
    expect(lookupUserSql("x'@y.z")).toContain("lower('x''@y.z')")
  })

  it('grava como o próprio usuário, faturas antes de pagar, e só confirma quando pedido', () => {
    const sql = importSql(data, USER, false)
    expect(sql).toContain('set local role authenticated;')
    expect(sql).not.toMatch(/service_role|sb_secret/)
    expect(sql.indexOf('insert into public.invoices')).toBeLessThan(
      sql.indexOf('update public.invoices set paid = true'),
    )
    expect(sql.trim().endsWith('rollback;')).toBe(true)
    expect(importSql(data, USER, true).trim().endsWith('commit;')).toBe(true)
    expect(() => importSql(data, 'not-a-uuid', true)).toThrow()
  })
})
