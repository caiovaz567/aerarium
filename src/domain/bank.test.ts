import { describe, expect, it } from 'vitest'
import {
  bankInvoiceMonth,
  bankMoment,
  bankText,
  cardDaysFromBank,
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

const none = { closingDay: null }

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
      bankInvoiceMonth({ ...purchase, billId: 'b8' }, account, bills, none),
    ).toBe('2026-08')
    // Bill not in the list: the open one.
    expect(
      bankInvoiceMonth({ ...purchase, billId: 'outra' }, account, bills, none),
    ).toBe(sep)
    expect(bankInvoiceMonth(purchase, account, [], none)).toBe(sep)
    expect(
      bankInvoiceMonth(
        purchase,
        { ...account, closeDate: isoDate('2026-09-08') },
        [],
        none,
      ),
    ).toBe(oct)
    expect(
      bankInvoiceMonth(purchase, { ...account, dueDate: null }, [], {
        closingDay: 5,
      }),
    ).toBe(oct)
  })
})

describe('compra antiga sem a fatura do banco', () => {
  const open: BankAccount = {
    pluggyAccountId: 'acc',
    cardId: 'card',
    dueDate: isoDate('2026-10-09'),
    closeDate: isoDate('2026-10-02'),
  }
  const at = (date: string) => tx('t', 'LOJA', 100, `${date}T15:00:00.000Z`)

  it('volta uma fatura por fechamento, em vez de cair toda na aberta', () => {
    expect(bankInvoiceMonth(at('2026-10-05'), open, [], none)).toBe('2026-11')
    expect(bankInvoiceMonth(at('2026-09-20'), open, [], none)).toBe(oct)
    expect(bankInvoiceMonth(at('2026-09-02'), open, [], none)).toBe(sep)
    expect(bankInvoiceMonth(at('2026-07-15'), open, [], none)).toBe('2026-08')
    expect(bankInvoiceMonth(at('2020-01-01'), open, [], none)).toBe('2024-10')
  })

  it('sem o fechamento do banco, conta uma semana antes do vencimento', () => {
    const noClose = { ...open, closeDate: null }
    expect(bankInvoiceMonth(at('2026-10-03'), noClose, [], none)).toBe(
      '2026-11',
    )
    expect(bankInvoiceMonth(at('2026-10-01'), noClose, [], none)).toBe(oct)
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

  it('cartão que não está na lista: segue sem dia de fechamento', () => {
    const result = planBankImport(
      state({ cards: [] }),
      {
        accounts: [{ ...account, dueDate: null }],
        transactions: [tx('t1', 'PADARIA', 1500, '2026-09-10T15:00:00.000Z')],
        bills: [],
      },
      ids,
    )
    expect(result.expenses.map((item) => item.invoiceId)).toEqual(['inv9'])
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

  it('parcelamento na mão com número ou início diferente, mas com parcela nessa fatura e mesmo valor, é ligado', () => {
    const handMade = {
      id: 'meu',
      cardId: 'card',
      description: 'Geladeira',
      installmentAmount: cents(19831),
      finalAdjustment: cents(0),
      totalInstallments: 10,
      firstMonth: month('2026-05'),
    }
    const charge = tx(
      'g',
      'LOJA PARC 04/12',
      19831,
      '2026-09-01T15:00:00.000Z',
      {
        installmentNumber: 4,
        totalInstallments: 12,
      },
    )
    const input = { accounts: [account], transactions: [charge], bills: [] }
    const linked = planBankImport(state({ plans: [handMade] }), input, ids)
    expect(linked.plans).toEqual([])
    expect(linked.planLinks[0]?.planId).toBe('meu')
    // Already over before this bill: a different purchase.
    const ended = planBankImport(
      state({ plans: [{ ...handMade, totalInstallments: 3 }] }),
      input,
      ids,
    )
    expect(ended.plans).toHaveLength(1)
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

  it('guarda o total do banco com a fatura; o "outros" do dono não muda', () => {
    const result = planBankImport(
      state(),
      { accounts: [account], transactions: [], bills: [bill(50000)] },
      ids,
    )
    expect(result.invoiceTotals).toEqual([])
    expect(result.records).toEqual([
      { externalId: 'bill:b9', kind: 'bill', refId: 'inv9', amount: 50000 },
    ])
    // What the app has of that invoice, for the preview.
    expect(result.billChecks).toEqual([
      {
        cardId: 'card',
        month: sep,
        bank: 50000,
        installments: 0,
        subscriptions: 5590,
        purchases: 1200,
      },
    ])
  })

  it('mesmo total já guardado, fatura paga, sem fatura ou sem cartão: nada', () => {
    const run = (
      overrides: Partial<ImportState>,
      accounts: BankAccount[] = [account],
    ) =>
      planBankImport(
        state(overrides),
        { accounts, transactions: [], bills: [bill(50000)] },
        ids,
      ).records
    expect(
      run({ records: new Map([['bill:b9', { amount: cents(50000) }]]) }),
    ).toEqual([])
    // Total changed at the bank: kept again.
    expect(
      run({ records: new Map([['bill:b9', { amount: cents(40000) }]]) }),
    ).toHaveLength(1)
    expect(
      run({
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
    ).toEqual([])
    expect(run({ invoices: [] })).toEqual([])
    expect(run({}, [{ ...account, cardId: null }])).toEqual([])
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

  it('sem "outros" digitado, não mexe', () => {
    expect(
      planBankImport(
        withOther(0),
        { accounts: [account], transactions: [purchase], bills: [] },
        ids,
      ).invoiceTotals,
    ).toEqual([])
  })
})

describe('palpite de cartão', () => {
  const cards = [
    { id: 'santander', name: 'Santander Unique' },
    { id: 'smiles', name: 'Smiles BB' },
    { id: 'nubank', name: 'NuBank' },
    { id: 'mp', name: 'Mercado Pago' },
    { id: 'itau', name: 'Itaú Platinum' },
  ]
  it.each([
    ['SANTANDER UNIQUE VISA INFINITE', 'santander'],
    ['Nubank Ultravioleta', 'nubank'],
    ['CARTAO MERCADO PAGO', 'mp'],
    ['OUROCARD SMILES VISA', 'smiles'],
    ['Dinners Elo Grafite', null],
    // "Platinum" is a card level, not a bank.
    ['croma-platinum', null],
  ])('"%s" → %s', (name, id) => {
    expect(guessCard(name, cards)).toBe(id)
  })
})

describe('dias do cartão pelo banco', () => {
  it('preenche fechamento e vencimento que faltam, sem trocar o que foi digitado', () => {
    const bank = (cardId: string | null): BankAccount => ({
      pluggyAccountId: `acc-${cardId}`,
      cardId,
      dueDate: isoDate('2026-10-09'),
      closeDate: isoDate('2026-10-02'),
    })
    expect(
      cardDaysFromBank(
        [
          { id: 'vazio', closingDay: null },
          { id: 'digitado', closingDay: 5, dueDay: 12 },
          { id: 'metade', closingDay: 5, dueDay: null },
          { id: 'sem-banco', closingDay: null, dueDay: null },
        ],
        [bank('vazio'), bank('digitado'), bank('metade'), bank(null)],
      ),
    ).toEqual([
      { cardId: 'vazio', closingDay: 2, dueDay: 9 },
      { cardId: 'metade', closingDay: 5, dueDay: 9 },
    ])
    expect(
      cardDaysFromBank(
        [{ id: 'c', closingDay: null }],
        [{ ...bank('c'), dueDate: null, closeDate: null }],
      ),
    ).toEqual([])
  })
})

describe('de quem é a compra do banco', () => {
  const buy = (id: string, text: string, day = '2026-09-10') =>
    tx(id, text, 1500 + id.length, `${day}T15:00:00.000Z`)
  const input = (...transactions: BankTransaction[]) => ({
    accounts: [account],
    transactions,
    bills: [],
  })

  it('sem a outra pessoa, tudo é do dono', () => {
    const result = planBankImport(state(), input(buy('a', 'PADARIA')), ids)
    expect(result.expenses[0]?.forOther).toBe(false)
  })

  it('depois, a loja decide; loja nova segue a maioria do cartão', () => {
    const mine = (description: string, forOther: boolean, id: string) => ({
      id,
      invoiceId: 'inv9',
      description,
      amount: cents(100),
      spentOn: isoDate('2026-09-01'),
      externalId: `x-${id}`,
      forOther,
    })
    const later = state({
      otherPerson: true,
      records: new Map([['x-1', { amount: null }]]),
      expenses: [
        mine('IFD*IFOOD.COM AGENCIA', false, '1'),
        mine('POSTO SHELL 123', true, '2'),
        mine('POSTO SHELL 999', true, '3'),
        mine('UBER *TRIP', false, '4'),
      ],
    })
    const result = planBankImport(
      later,
      input(
        buy('a', 'IFD*IFOOD.COM AGENCIA'),
        buy('b', 'POSTO SHELL 555'),
        buy('c', 'POSTO IPIRANGA'),
        buy('d', 'LOJA NOVA'),
        buy('e', 'LOJA NOVA'),
      ),
      ids,
    )
    expect(result.expenses.map((item) => item.forOther)).toEqual([
      false, // same store, the owner's
      true, // same store, other numbers
      true, // same first word ("posto")
      true, // new store: most bank purchases on the card were the other's
      true, // same new store, now known
    ])
  })

  it('cartão sem compras do banco ainda: do dono', () => {
    const result = planBankImport(
      state({
        otherPerson: true,
        records: new Map([['x', { amount: null }]]),
      }),
      input(buy('a', 'AB')),
      ids,
    )
    expect(result.expenses[0]?.forOther).toBe(false)
  })
})

describe('começar do zero no dia da primeira importação', () => {
  const at = (id: string, day: string, extra: Partial<BankTransaction> = {}) =>
    tx(id, `LOJA ${id}`, 1000, `${day}T15:00:00.000Z`, extra)
  const today = isoDate('2026-09-10')

  it('o que já estava no banco fica de fora; o do dia em diante entra', () => {
    const result = planBankImport(
      state(),
      {
        accounts: [account],
        transactions: [at('velha', '2026-09-09'), at('hoje', '2026-09-10')],
        bills: [],
        today,
      },
      ids,
    )
    expect(result.expenses.map((item) => item.externalId)).toEqual(['hoje'])
    expect(result.expenses[0]?.reviewed).toBe(false)
    expect(result.records.map((item) => item.externalId)).toEqual([
      'start:2026-09-10',
      'hoje',
    ])
  })

  it('depois, o começo guardado continua valendo', () => {
    const later = state({
      records: new Map([['start:2026-09-10', { amount: null }]]),
    })
    const result = planBankImport(
      later,
      {
        accounts: [account],
        transactions: [at('velha', '2026-09-01'), at('nova', '2026-09-12')],
        bills: [],
        today: isoDate('2026-09-15'),
      },
      ids,
    )
    expect(result.expenses.map((item) => item.externalId)).toEqual(['nova'])
    expect(result.records.map((item) => item.externalId)).toEqual(['nova'])
  })

  it('o "outros" da fatura aberta naquele dia fica; das seguintes, zera', () => {
    const typed = (id: string, when: string) => ({
      id,
      cardId: 'card',
      month: month(when),
      paid: false,
      otherAmount: cents(5000),
    })
    const result = planBankImport(
      state({
        records: new Map([['start:2026-09-10', { amount: null }]]),
        months: [
          { id: 'm9', ref: sep },
          { id: 'm10', ref: oct },
          { id: 'm11', ref: month('2026-11') },
        ],
        invoices: [typed('inv10', '2026-10'), typed('inv11', '2026-11')],
      }),
      {
        accounts: [{ ...account, dueDate: null }],
        transactions: [at('out', '2026-10-01'), at('nov', '2026-11-01')],
        bills: [],
      },
      ids,
    )
    expect(result.invoiceTotals).toEqual([
      { invoiceId: 'inv11', otherAmount: 0 },
    ])
  })

  it('a mesma compra parcelada em duas faturas vira um parcelamento só', () => {
    const parcel = (id: string, day: string, number: number) =>
      tx(id, 'GREGORIO AUTO PARC', 13512, `${day}T15:00:00.000Z`, {
        installmentNumber: number,
        totalInstallments: 10,
      })
    const result = planBankImport(
      state(),
      {
        accounts: [{ ...account, dueDate: null }],
        // Two installments landing on the same bill: first months a month apart.
        transactions: [
          parcel('p5', '2026-09-03', 5),
          parcel('p6', '2026-09-25', 6),
        ],
        bills: [],
      },
      ids,
    )
    expect(result.plans).toHaveLength(1)
    expect(result.records.map((item) => item.kind)).toEqual([
      'installment',
      'installment',
    ])
  })
})
