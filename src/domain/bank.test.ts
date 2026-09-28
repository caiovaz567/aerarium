import { describe, expect, it } from 'vitest'
import {
  bankInvoiceMonth,
  bankMoment,
  bankText,
  guessCard,
  planBankImport,
  purchaseText,
  type BankAccount,
  type BankBill,
  type BankTransaction,
  type ImportState,
} from './bank'
import { DEFAULT_CATEGORIES, type Category } from './categories'
import { cents } from './money'
import { isoDate, month } from './months'

const categories: Category[] = DEFAULT_CATEGORIES.map((item, index) => ({
  id: `cat-${index}`,
  name: item.name,
  color: item.color,
  icon: item.icon,
  sortOrder: index,
}))
const categoryOf = (name: string) =>
  categories.find((item) => item.name === name)!.id

const sep = month('2026-09')
const oct = month('2026-10')

/** One card (Santander), September and October created, September open. */
function state(overrides: Partial<ImportState> = {}): ImportState {
  return {
    cards: [{ id: 'card', closingDay: null }],
    months: [
      { id: 'm9', ref: sep },
      { id: 'm10', ref: oct },
    ],
    invoices: [
      {
        id: 'inv9',
        cardId: 'card',
        month: sep,
        paid: false,
        otherAmount: cents(0),
      },
    ],
    expenses: [
      {
        id: 'uber-mao',
        invoiceId: 'inv9',
        description: 'Uber',
        amount: cents(1200),
        spentOn: isoDate('2026-09-03'),
      },
    ],
    plans: [],
    payments: [],
    subscriptions: [
      {
        id: 'netflix',
        cardId: 'card',
        name: 'Netflix',
        amount: cents(5590),
        active: true,
      },
    ],
    categories,
    history: [],
    records: new Map(),
    ...overrides,
  }
}

const account: BankAccount = {
  pluggyAccountId: 'acc',
  cardId: 'card',
  dueDate: isoDate('2026-09-21'),
  closeDate: null,
}

const tx = (
  id: string,
  description: string,
  amount: number,
  date: string,
  extra: Partial<BankTransaction> = {},
): BankTransaction => ({
  id,
  accountId: 'acc',
  description,
  amount: cents(amount),
  date,
  installmentNumber: null,
  totalInstallments: null,
  billId: null,
  ...extra,
})

const spaced = (value: string | undefined) => value?.replace(/\s/g, ' ')

let counter = 0
const ids = () => `new-${++counter}`

describe('textos e datas do banco', () => {
  it('tira "02/10" e "PARC" do nome da compra parcelada', () => {
    expect(purchaseText('MAGALU PARC 02/10')).toBe('MAGALU')
    expect(purchaseText('Notebook Parcela 3 / 12')).toBe('Notebook')
  })

  it('nome da compra avulsa fica exato como o banco manda', () => {
    expect(bankText('  DROGASIL   22/31 ')).toBe('DROGASIL 22/31')
    expect(bankText('   ')).toBe('Compra')
    expect(bankText('x'.repeat(250))).toHaveLength(200)
  })

  it('meia-noite em São Paulo é só a data; com hora, guarda o instante', () => {
    expect(bankMoment('2026-09-21T03:00:00.000Z')).toEqual({
      day: '2026-09-21',
      at: null,
    })
    expect(bankMoment('2026-09-04T01:30:00.000Z')).toEqual({
      day: '2026-09-03',
      at: '2026-09-04T01:30:00.000Z',
    })
  })

  it('mês da fatura: a do banco, a aberta, depois do fechamento, ou pelo dia de fechamento', () => {
    const bills: BankBill[] = [
      {
        id: 'b8',
        accountId: 'acc',
        dueDate: isoDate('2026-08-21'),
        total: cents(1),
      },
    ]
    const purchase = tx('t', 'X', 100, '2026-09-10T03:00:00.000Z')
    expect(
      bankInvoiceMonth({ ...purchase, billId: 'b8' }, account, bills, null),
    ).toBe('2026-08')
    // Bill not in the list: the open one.
    expect(
      bankInvoiceMonth({ ...purchase, billId: 'outra' }, account, bills, null),
    ).toBe(sep)
    expect(bankInvoiceMonth(purchase, account, [], null)).toBe(sep)
    expect(
      bankInvoiceMonth(
        purchase,
        { ...account, closeDate: isoDate('2026-09-08') },
        [],
        null,
      ),
    ).toBe(oct)
    expect(
      bankInvoiceMonth(purchase, { ...account, dueDate: null }, [], 5),
    ).toBe(oct)
  })
})

describe('importar compras', () => {
  it('compra nova entra na fatura aberta, com categoria sugerida e o id do banco', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [
          tx('t1', 'IFOOD *RESTAURANTE', 4590, '2026-09-10T18:22:00.000Z'),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.expenses).toEqual([
      expect.objectContaining({
        invoiceId: 'inv9',
        description: 'IFOOD *RESTAURANTE',
        amount: 4590,
        spentOn: '2026-09-10',
        occurredAt: '2026-09-10T18:22:00.000Z',
        categoryId: categoryOf('Alimentação'),
        externalId: 't1',
      }),
    ])
    expect(result.records).toEqual([
      {
        externalId: 't1',
        kind: 'expense',
        refId: result.expenses[0]!.id,
        amount: null,
      },
    ])
    expect(result.invoices).toEqual([])
  })

  it('o que já foi lançado na mão (mesmo valor, até 3 dias) é ligado, não duplicado', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [
          tx('t1', 'UBER *TRIP', 1200, '2026-09-05T03:00:00.000Z'),
          // A second identical Uber is a new purchase.
          tx('t2', 'UBER *TRIP', 1200, '2026-09-05T03:00:00.000Z'),
          // Same value but far away in time: new.
          tx('t3', 'UBER *TRIP', 1200, '2026-09-19T03:00:00.000Z'),
        ],
        bills: [],
      },
      ids,
    )
    // The bank's name wins; what was typed stays as the note.
    expect(result.links).toEqual([
      {
        expenseId: 'uber-mao',
        externalId: 't1',
        description: 'UBER *TRIP',
        note: 'Uber',
      },
    ])
    expect(result.expenses.map((item) => item.externalId)).toEqual(['t2', 't3'])
    expect(result.records.map((item) => item.kind)).toEqual([
      'matched',
      'expense',
      'expense',
    ])
  })

  it('ao ligar: texto igual ao do banco não vira descrição; descrição já escrita fica', () => {
    const plan = (description: string, note?: string) =>
      planBankImport(
        state({
          expenses: [
            {
              id: 'mao',
              invoiceId: 'inv9',
              description,
              amount: cents(1200),
              spentOn: isoDate('2026-09-03'),
              note,
            },
          ],
        }),
        {
          accounts: [account],
          transactions: [
            tx('t1', 'UBER *TRIP', 1200, '2026-09-05T03:00:00.000Z'),
          ],
          bills: [],
        },
        ids,
      ).links[0]
    expect(plan('uber *trip')?.note).toBeNull()
    expect(plan('Uber', 'Ida ao aeroporto')?.note).toBe('Ida ao aeroporto')
  })

  it('assinatura cadastrada é reconhecida; se o valor mudou, avisa', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [
          tx('t1', 'NETFLIX.COM', 5590, '2026-09-12T03:00:00.000Z'),
          tx('t2', 'NETFLIX.COM', 5990, '2026-10-12T03:00:00.000Z'),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.expenses).toEqual([])
    expect(result.records.map((item) => [item.kind, item.refId])).toEqual([
      ['subscription', 'netflix'],
      ['subscription', 'netflix'],
    ])
    expect(result.notices.map(spaced)).toEqual([
      'Netflix veio R$ 59,90, e está cadastrada com R$ 55,90.',
    ])
  })

  it('parcelada nova vira parcelamento; as próximas parcelas só são reconhecidas', () => {
    const october: BankAccount = { ...account, dueDate: isoDate('2026-10-21') }
    const bills: BankBill[] = [
      {
        id: 'b9',
        accountId: 'acc',
        dueDate: isoDate('2026-09-21'),
        total: cents(999999),
      },
    ]
    const result = planBankImport(
      state({ invoices: [] }),
      {
        accounts: [october],
        transactions: [
          tx('p1', 'MAGALU PARC 01/10', 29990, '2026-09-02T03:00:00.000Z', {
            installmentNumber: 1,
            totalInstallments: 10,
            billId: 'b9',
          }),
          tx('p2', 'MAGALU PARC 02/10', 29990, '2026-10-02T03:00:00.000Z', {
            installmentNumber: 2,
            totalInstallments: 10,
          }),
        ],
        bills,
      },
      ids,
    )
    expect(result.plans).toEqual([
      expect.objectContaining({
        cardId: 'card',
        description: 'MAGALU',
        installmentAmount: 29990,
        totalInstallments: 10,
        firstMonth: '2026-09',
        categoryId: categoryOf('Compras'),
        externalKey: 'acc|magalu|10|29990|2026-09',
      }),
    ])
    expect(result.records.map((item) => [item.kind, item.refId])).toEqual([
      ['installment', result.plans[0]!.id],
      ['installment', result.plans[0]!.id],
    ])
  })

  it('parcelamento feito na mão (mesmo cartão, número e valor) é ligado', () => {
    const result = planBankImport(
      state({
        plans: [
          {
            id: 'iphone',
            cardId: 'card',
            description: 'iPhone',
            installmentAmount: cents(70256),
            finalAdjustment: cents(0),
            totalInstallments: 12,
            firstMonth: month('2026-08'),
          },
        ],
      }),
      {
        accounts: [account],
        transactions: [
          tx('i2', 'APPLE STORE 02/12', 70256, '2026-09-01T03:00:00.000Z', {
            installmentNumber: 2,
            totalInstallments: 12,
          }),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.plans).toEqual([])
    expect(result.planLinks).toEqual([
      { planId: 'iphone', externalKey: 'acc|apple store|12|70256|2026-08' },
    ])
    expect(result.records[0]).toMatchObject({
      kind: 'installment',
      refId: 'iphone',
    })
  })

  it('pagamento e estorno são ignorados; já tratados, conta sem cartão e mês que não existe ficam de fora', () => {
    const result = planBankImport(
      state({ records: new Map([['velho', { amount: null }]]) }),
      {
        accounts: [
          account,
          {
            pluggyAccountId: 'solto',
            cardId: null,
            dueDate: null,
            closeDate: null,
          },
        ],
        transactions: [
          tx('pgto', 'PAGAMENTO RECEBIDO', -150000, '2026-09-15T03:00:00.000Z'),
          tx('velho', 'JA IMPORTADO', 1000, '2026-09-15T03:00:00.000Z'),
          {
            ...tx('outro', 'SEM CARTAO', 1000, '2026-09-15T03:00:00.000Z'),
            accountId: 'solto',
          },
          tx('nov', 'COMPRA FUTURA', 1000, '2026-09-15T03:00:00.000Z', {
            billId: 'bnov',
          }),
        ],
        bills: [
          {
            id: 'bnov',
            accountId: 'acc',
            dueDate: isoDate('2026-11-21'),
            total: cents(1000),
          },
        ],
      },
      ids,
    )
    expect(result.records.map((item) => [item.externalId, item.kind])).toEqual([
      ['pgto', 'ignored'],
    ])
    expect(result.expenses).toEqual([])
  })

  it('fatura já paga não recebe compras', () => {
    const result = planBankImport(
      state({
        invoices: [
          {
            id: 'inv9',
            cardId: 'card',
            month: sep,
            paid: true,
            otherAmount: cents(0),
          },
        ],
      }),
      {
        accounts: [account],
        transactions: [tx('t1', 'PADARIA', 800, '2026-09-10T03:00:00.000Z')],
        bills: [],
      },
      ids,
    )
    expect(result.records.map((item) => item.kind)).toEqual(['closed'])
  })

  it('cria a fatura do mês quando ainda não existe', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [{ ...account, dueDate: isoDate('2026-10-21') }],
        transactions: [
          tx('t1', 'POSTO SHELL', 20000, '2026-09-25T03:00:00.000Z'),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.invoices).toEqual([
      expect.objectContaining({ cardId: 'card', monthId: 'm10', month: oct }),
    ])
    expect(result.expenses[0]!.invoiceId).toBe(result.invoices[0]!.id)
    expect(result.expenses[0]!.categoryId).toBe(categoryOf('Transporte'))
    // The second purchase in the same new invoice reuses it.
    const two = planBankImport(
      state(),
      {
        accounts: [{ ...account, dueDate: isoDate('2026-10-21') }],
        transactions: [
          tx('a', 'LOJA A', 100, '2026-09-25T03:00:00.000Z'),
          tx('b', 'LOJA B', 100, '2026-09-26T03:00:00.000Z'),
        ],
        bills: [],
      },
      ids,
    )
    expect(two.invoices).toHaveLength(1)
  })
})

describe('total da fatura do banco', () => {
  const bill = (total: number, id = 'b9'): BankBill => ({
    id,
    accountId: 'acc',
    dueDate: isoDate('2026-09-21'),
    total: cents(total),
  })

  it('"outros" vira o que sobra depois de assinaturas e gastos', () => {
    // Netflix 55,90 + Uber 12,00 already there.
    const result = planBankImport(
      state(),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(result.invoiceTotals).toEqual([
      { invoiceId: 'inv9', otherAmount: 50000 - 5590 - 1200 },
    ])
    expect(result.records).toEqual([
      { externalId: 'bill:b9', kind: 'bill', refId: 'inv9', amount: 50000 },
    ])
  })

  it('conta também as compras e os parcelamentos que acabaram de chegar', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [
          tx('t1', 'MERCADO', 10000, '2026-09-10T03:00:00.000Z'),
          tx('p1', 'LOJA PARC 01/02', 3000, '2026-09-10T03:00:00.000Z', {
            installmentNumber: 1,
            totalInstallments: 2,
          }),
        ],
        bills: [bill(50000)],
      },
      ids,
    )
    expect(result.invoiceTotals[0]!.otherAmount).toBe(
      50000 - 5590 - 1200 - 10000 - 3000,
    )
  })

  it('total menor que o que já se sabe: outros zero e um aviso', () => {
    const result = planBankImport(
      state(),
      { accounts: [account], transactions: [], bills: [bill(1000)] },
      ids,
    )
    expect(result.invoiceTotals).toEqual([
      { invoiceId: 'inv9', otherAmount: 0 },
    ])
    expect(spaced(result.notices[0])).toMatch(
      /^A fatura de Setembro 2026 veio R\$ 10,00 no banco, menos que parcelas, assinaturas e gastos juntos \(R\$ 67,90\)\.$/,
    )
  })

  it('já aplicada com o mesmo total, fatura paga, sem fatura ou sem cartão: nada', () => {
    const applied = planBankImport(
      state({ records: new Map([['bill:b9', { amount: cents(50000) }]]) }),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(applied.invoiceTotals).toEqual([])
    // Total changed at the bank: applied again.
    const changed = planBankImport(
      state({ records: new Map([['bill:b9', { amount: cents(40000) }]]) }),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(changed.invoiceTotals).toHaveLength(1)
    const paid = planBankImport(
      state({
        invoices: [
          {
            id: 'inv9',
            cardId: 'card',
            month: sep,
            paid: true,
            otherAmount: cents(0),
          },
        ],
      }),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(paid.invoiceTotals).toEqual([])
    const none = planBankImport(
      state({ invoices: [] }),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(none.invoiceTotals).toEqual([])
    const unmapped = planBankImport(
      state(),
      {
        accounts: [{ ...account, cardId: null }],
        transactions: [],
        bills: [bill(50000)],
      },
      ids,
    )
    expect(unmapped.invoiceTotals).toEqual([])
  })
})

describe('ids', () => {
  it('sem gerador, usa UUID', () => {
    const result = planBankImport(state(), {
      accounts: [account],
      transactions: [tx('t1', 'PADARIA', 800, '2026-09-10T03:00:00.000Z')],
      bills: [],
    })
    expect(result.expenses[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})

describe('casos estranhos do banco', () => {
  it('parcelada sem número da parcela conta como a primeira; nome só com "PARC" fica como veio', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [
          tx('x', 'PARC 03/05', 1000, '2026-09-10T03:00:00.000Z', {
            installmentNumber: null,
            totalInstallments: 5,
          }),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.plans[0]).toMatchObject({
      description: 'PARC 03/05',
      firstMonth: '2026-09',
      totalInstallments: 5,
    })
  })
})

describe('fatura aberta que recebe compras do banco', () => {
  const withOther = (other: number) =>
    state({
      invoices: [
        {
          id: 'inv9',
          cardId: 'card',
          month: sep,
          paid: false,
          otherAmount: cents(other),
        },
      ],
    })
  const purchase = tx('t1', 'PADARIA', 800, '2026-09-10T03:00:00.000Z')

  it('o "outros" digitado vai pra zero, uma vez só', () => {
    const result = planBankImport(
      withOther(27102),
      { accounts: [account], transactions: [purchase], bills: [] },
      ids,
    )
    expect(result.invoiceTotals).toEqual([
      { invoiceId: 'inv9', otherAmount: 0 },
    ])
    expect(result.records.at(-1)).toEqual({
      externalId: 'open:inv9',
      kind: 'bill',
      refId: 'inv9',
      amount: null,
    })
    const again = planBankImport(
      {
        ...withOther(5000),
        records: new Map([['open:inv9', { amount: null }]]),
      },
      {
        accounts: [account],
        transactions: [tx('t2', 'PADARIA', 900, '2026-09-11T03:00:00.000Z')],
        bills: [],
      },
      ids,
    )
    expect(again.invoiceTotals).toEqual([])
  })

  it('sem "outros", ou com a fatura do banco no mesmo envio, não mexe', () => {
    expect(
      planBankImport(
        withOther(0),
        { accounts: [account], transactions: [purchase], bills: [] },
        ids,
      ).invoiceTotals,
    ).toEqual([])
    const withBill = planBankImport(
      withOther(27102),
      {
        accounts: [account],
        transactions: [purchase],
        bills: [
          {
            id: 'b9',
            accountId: 'acc',
            dueDate: isoDate('2026-09-21'),
            total: cents(20000),
          },
        ],
      },
      ids,
    )
    expect(withBill.invoiceTotals).toEqual([
      { invoiceId: 'inv9', otherAmount: 20000 - 5590 - 1200 - 800 },
    ])
  })
})

describe('palpite de cartão', () => {
  const cards = [
    { id: 'santander', name: 'Santander Unique' },
    { id: 'smiles', name: 'Smiles BB' },
    { id: 'nubank', name: 'NuBank' },
    { id: 'mp', name: 'Mercado Pago' },
  ]
  it.each([
    ['SANTANDER UNIQUE VISA INFINITE', 'santander'],
    ['Nubank Ultravioleta', 'nubank'],
    ['CARTAO MERCADO PAGO', 'mp'],
    ['OUROCARD SMILES VISA', 'smiles'],
    ['Dinners Elo Grafite', null],
  ])('"%s" → %s', (name, id) => {
    expect(guessCard(name, cards)).toBe(id)
  })
})
