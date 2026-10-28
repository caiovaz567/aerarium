import { describe, expect, it } from 'vitest'
import {
  billMonthOf,
  dayText,
  emailBills,
  emailGroups,
  money,
  renderEmail,
  whenText,
  type EmailTransaction,
} from './dailyEmail'

const tx = (
  id: string,
  accountId: string,
  amount: number,
  date: string,
  extra: Partial<EmailTransaction> = {},
): EmailTransaction => ({
  id,
  accountId,
  description: `LOJA ${id}`,
  amount,
  date,
  installmentNumber: null,
  totalInstallments: null,
  totalAmount: null,
  ...extra,
})

const cards = [
  { accountId: 'nu', name: 'Nubank', bank: 'nubank' },
  { accountId: 'bb', name: 'Smiles BB', bank: null },
]

describe('e-mail diário: o que entra', () => {
  it('só compras novas, dos cartões ligados, desde o começo; mais novas primeiro', () => {
    const groups = emailGroups({
      transactions: [
        tx('a', 'nu', 58.9, '2026-09-28T00:43:00.000Z'),
        tx('b', 'nu', 129.9, '2026-09-27T01:30:00.000Z', {
          description: ' Amazon ',
          installmentNumber: 1,
          totalInstallments: 3,
          totalAmount: 389.7,
        }),
        tx('pagamento', 'nu', -500, '2026-09-28T12:00:00.000Z'),
        tx('ja-foi', 'nu', 10, '2026-09-28T12:00:00.000Z'),
        tx('antes', 'nu', 10, '2026-09-20T12:00:00.000Z'),
        tx('outro-banco', 'x', 10, '2026-09-28T12:00:00.000Z'),
        tx('c', 'bb', 14.2, '2026-09-26T03:00:00.000Z', {
          installmentNumber: 1,
          totalInstallments: 4,
        }),
        // Next installments of an old purchase, one dated in the future.
        tx('parcela-2', 'nu', 50, '2026-09-27T12:00:00.000Z', {
          installmentNumber: 2,
          totalInstallments: 10,
        }),
        tx('parcela-10', 'nu', 198.31, '2026-10-25T12:00:00.000Z', {
          installmentNumber: 10,
          totalInstallments: 10,
        }),
        tx('amanha', 'nu', 20, '2026-09-30T15:00:00.000Z'),
      ],
      cards,
      sent: new Set(['ja-foi']),
      from: '2026-09-25',
      now: '2026-09-29T12:00:00.000Z',
      categories: new Map([['amazon', { name: 'Compras', color: '#d98a00' }]]),
    })
    expect(groups.map((group) => [group.card.name, group.total])).toEqual([
      ['Nubank', 188.8],
      ['Smiles BB', 14.2],
    ])
    expect(groups[0]!.items).toEqual([
      {
        id: 'a',
        name: 'LOJA a',
        amount: 58.9,
        when: 'dom 27 · 21:43',
        category: null,
        installment: null,
      },
      {
        id: 'b',
        name: 'Amazon',
        amount: 129.9,
        when: 'sáb 26 · 22:30',
        category: { name: 'Compras', color: '#d98a00' },
        installment: 'Parcela 1 de 3 · total R$ 389,70',
      },
    ])
    // A bank date with no time: only the day.
    expect(groups[1]!.items[0]).toMatchObject({
      when: 'sáb 26',
      installment: 'Parcela 1 de 4',
    })
  })

  it('dinheiro e datas do jeito brasileiro', () => {
    expect(money(1234.5)).toBe('R$ 1.234,50')
    expect(money(-3)).toBe('−R$ 3,00')
    expect(dayText('2026-09-29T12:00:00.000Z')).toBe('29 set')
    expect(whenText('2026-10-05T14:05:00.000Z')).toBe('seg 5 · 11:05')
  })
})

describe('e-mail diário: o desenho', () => {
  const groups = emailGroups({
    transactions: [
      tx('a', 'nu', 58.9, '2026-09-28T00:43:00.000Z', {
        description: 'IFD*IFOOD <b>',
      }),
      tx('c', 'bb', 14.2, '2026-09-26T03:00:00.000Z'),
    ],
    cards,
    sent: new Set(),
    from: '2026-09-25',
    now: '2026-09-29T12:00:00.000Z',
    categories: new Map([
      ['ifd*ifood <b>', { name: 'Alimentação', color: '#E8590C' }],
    ]),
  })

  it('um bloco por cartão, com logo, e o total no topo', () => {
    const { subject, html } = renderEmail({
      groups,
      now: '2026-09-29T12:00:00.000Z',
      appUrl: 'https://app.test',
    })
    expect(subject).toBe('Aerarium: 2 compras no cartão, R$ 73,10')
    expect(html).toContain('2 compras em 2 cartões')
    expect(html).toContain('29 set')
    expect(html).toContain('src="https://app.test/banks/nubank.png"')
    // Names from the bank are escaped.
    expect(html).toContain('IFD*IFOOD &lt;b&gt;')
    expect(html).not.toContain('<b>')
    expect(html).toContain('Alimentação · dom 27 · 21:43')
    expect(html).toContain('background:#E8590C')
    expect(html.match(/banks\//g)).toHaveLength(1)
    expect(html).toContain('Abrir o Aerarium')
    // With someone else using the cards, it asks to mark each purchase.
    const marked = renderEmail({
      groups,
      now: '2026-09-29T12:00:00.000Z',
      appUrl: 'https://app.test',
      otherPerson: 'Pai',
    }).html
    expect(marked).toContain('marque o que é seu e o que é do Pai')
    expect(marked).toContain('Marcar no Aerarium')
  })

  it('o primeiro, ao ligar: avisa que ficou ligado, mesmo sem compra', () => {
    const one = renderEmail({
      groups: [{ ...groups[1]!, items: groups[1]!.items }],
      now: '2026-09-29T12:00:00.000Z',
      appUrl: 'https://app.test',
      test: true,
    })
    expect(one.subject).toBe('Aerarium: resumo por e-mail ligado')
    expect(one.html).toContain('as compras dos últimos dias')
    expect(one.html).toContain('1 compra em 1 cartão')
    const none = renderEmail({
      groups: [],
      now: '2026-09-29T12:00:00.000Z',
      appUrl: 'https://app.test',
      test: true,
    })
    expect(none.html).toContain('não chegou nenhuma compra')
    expect(none.html).toContain('nada novo')
  })
})

describe('e-mail diário: fatura fechada', () => {
  const bill = (
    id: string,
    accountId: string,
    dueDate: string,
    total = 5470.36,
  ) => ({
    id,
    accountId,
    dueDate,
    total,
  })
  const base = {
    cards,
    sent: new Set<string>(),
    today: '2026-10-28',
    nextMonth: true,
    otherPerson: true,
    invoices: new Map([['bb 2026-10', { total: 877.02, mine: 877.02 }]]),
  }

  it('só as que ainda vão vencer e não foram contadas; o Pai fica com o resto', () => {
    const bills = emailBills({
      ...base,
      bills: [
        bill('old', 'bb', '2026-10-05'),
        bill('told', 'bb', '2026-11-05'),
        bill('zero', 'nu', '2026-11-05', 0),
        bill('b10', 'bb', '2026-11-05'),
        bill('n10', 'nu', '2026-11-10', 120),
        bill('other', 'xx', '2026-11-05'),
      ],
      sent: new Set(['bill:told']),
    })
    expect(bills).toEqual([
      {
        id: 'n10',
        card: cards[0],
        month: 'outubro',
        total: 120,
        mine: null,
        other: null,
      },
      {
        id: 'b10',
        card: cards[1],
        month: 'outubro',
        total: 5470.36,
        mine: 877.02,
        other: 4593.34,
      },
    ])
    // Without the convention, the month is the due one; without the other
    // person, only the total.
    expect(
      emailBills({
        ...base,
        nextMonth: false,
        otherPerson: false,
        bills: [bill('b10', 'bb', '2026-01-05')],
        today: '2026-01-01',
      })[0],
    ).toMatchObject({ month: 'janeiro', mine: null, other: null })
    expect(billMonthOf('2026-01-05', true)).toBe('2025-12')
  })

  it('no topo do e-mail, com as partes; sem compra, sem o resumo das compras', () => {
    const [one] = emailBills({
      ...base,
      bills: [bill('b10', 'bb', '2026-11-05')],
    })
    const alone = renderEmail({
      groups: [],
      bills: [one!],
      now: '2026-10-28T21:00:00.000Z',
      appUrl: 'https://app.test',
      otherPerson: 'Pai',
    })
    expect(alone.subject).toBe(
      `Aerarium: fatura do Smiles BB fechou, ${money(5470.36)}`,
    )
    expect(alone.html).toContain('Fatura de outubro fechou')
    expect(alone.html).toContain('Sua parte')
    expect(alone.html).toContain('Parte do Pai')
    expect(alone.html).toContain(money(4593.34))
    expect(alone.html).not.toContain('chegou do banco')
    expect(alone.html).toContain('compra nova ou fatura fechada')
    const both = renderEmail({
      groups: [
        {
          card: cards[0]!,
          total: 10,
          items: [
            {
              id: 'a',
              name: 'LOJA',
              amount: 10,
              when: 'ter 28',
              category: null,
              installment: null,
            },
          ],
        },
      ],
      bills: [one!, { ...one!, id: 'b2', mine: null, other: null }],
      now: '2026-10-28T21:00:00.000Z',
      appUrl: 'https://app.test',
    })
    expect(both.subject).toBe(
      'Aerarium: 2 faturas fecharam, e 1 compra no cartão',
    )
    expect(both.html).toContain('chegou do banco')
    expect(both.html).not.toContain('Sua parte')
  })
})
