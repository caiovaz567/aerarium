import { describe, expect, it } from 'vitest'
import {
  dayText,
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
          installmentNumber: 2,
          totalInstallments: 4,
        }),
      ],
      cards,
      sent: new Set(['ja-foi']),
      from: '2026-09-25',
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
      installment: 'Parcela 2 de 4',
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
