import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ImportResult } from '../../domain/bank'
import { cents } from '../../domain/money'
import { isoDate, month } from '../../domain/months'
import { financeFixture } from '../../test/financeFixture'
import { PreviewCards } from './PreviewCards'
import { importMessage } from './useBank'

const sep = month('2026-09')
const result: ImportResult = {
  invoices: [],
  expenses: [
    {
      id: 'e1',
      invoiceId: 'inv-sep',
      description: 'POSTO SHELL',
      amount: cents(20000),
      spentOn: isoDate('2026-09-05'),
      occurredAt: null,
      categoryId: null,
      externalId: 't1',
      forOther: true,
      reviewed: true,
    },
    {
      id: 'e2',
      invoiceId: 'inv-sep',
      description: 'IFD*IFOOD',
      amount: cents(4590),
      spentOn: isoDate('2026-09-07'),
      occurredAt: null,
      categoryId: null,
      externalId: 't2',
      forOther: false,
      reviewed: true,
    },
  ],
  links: [],
  plans: [
    {
      id: 'p1',
      cardId: 'c1',
      description: 'MAGALU',
      installmentAmount: cents(10000),
      totalInstallments: 5,
      firstMonth: sep,
      categoryId: null,
      externalKey: 'k',
      forOther: true,
      reviewed: true,
    },
  ],
  planLinks: [],
  moves: [],
  invoiceTotals: [],
  bankTotals: [],
  records: [],
  notices: [],
  billChecks: [
    {
      cardId: 'c1',
      month: sep,
      bank: cents(30000),
      installments: cents(22000),
      subscriptions: cents(3990),
      purchases: cents(24590),
    },
  ],
}

describe('prévia da primeira importação', () => {
  it('por cartão: a conta da fatura, parcelamentos e compras com o dono', () => {
    const finance = financeFixture()
    const invoice = finance.invoices.find(
      (item) => item.cardId === 'c1' && item.month === sep,
    )!
    render(
      <PreviewCards
        finance={{ ...finance, otherPerson: 'Pai' }}
        result={{
          ...result,
          expenses: result.expenses.map((item) => ({
            ...item,
            invoiceId: invoice.id,
          })),
        }}
      />,
    )
    const card = screen.getByText('Nubank Teste').closest('details')!
    fireEvent.click(within(card).getByText('Nubank Teste'))
    expect(card.textContent?.replace(/\s/g, ' ')).toContain(
      '2 compras · R$ 245,90 · 1 do Pai · 1 parcelamentos novos',
    )
    expect(card.querySelector('.bill-check.over')?.textContent).toMatch(
      /R\$\s205,80 a mais/,
    )
    expect(within(card).getAllByText('Pai')).toHaveLength(2)
    expect(within(card).getByText(/5x · desde set/)).toBeInTheDocument()
  })
})

describe('aviso depois da busca', () => {
  it('só com o total de faturas fechadas, ainda tem o que salvar e avisar', () => {
    const onlyTotals: ImportResult = {
      ...result,
      expenses: [],
      plans: [],
      billChecks: [],
      bankTotals: [{ invoiceId: 'i', bankTotal: cents(100) }],
    }
    expect(importMessage(onlyTotals)).toBe('1 fatura fechada.')
    expect(importMessage({ ...onlyTotals, bankTotals: [] })).toBe(
      'Nada novo no banco.',
    )
  })
})
