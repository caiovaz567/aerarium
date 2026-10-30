import { describe, expect, it } from 'vitest'
import type { ImportResult } from '../../domain/bank'
import { invoiceTotals } from '../../domain/invoices'
import { cents, formatMoney } from '../../domain/money'
import { month } from '../../domain/months'
import { financeFixture } from '../../test/financeFixture'
import { billNotices } from './billNotice'

const sep = month('2026-09')
const empty: ImportResult = {
  invoices: [],
  expenses: [],
  links: [],
  plans: [],
  planLinks: [],
  moves: [],
  invoiceTotals: [],
  bankTotals: [],
  records: [],
  notices: [],
  billChecks: [],
}

describe('aviso de fatura fechada', () => {
  const base = financeFixture()
  const invoice = base.invoices.find(
    (item) => item.cardId === 'c1' && item.month === sep,
  )!
  const closed: ImportResult = {
    ...empty,
    bankTotals: [{ invoiceId: invoice.id, bankTotal: cents(412345) }],
    records: [
      {
        externalId: 'bill:b9',
        kind: 'bill',
        refId: invoice.id,
        amount: cents(412345),
      },
    ],
  }
  const saved = (extra: object = {}) => ({
    ...base,
    ...extra,
    invoices: base.invoices.map((item) =>
      item.id === invoice.id ? { ...item, bankTotal: cents(412345) } : item,
    ),
  })

  it('diz o total, a sua parte e a do Pai (o resto)', () => {
    const finance = saved({
      otherPerson: 'Pai',
      otherBankUntil: month('2100-01'),
    })
    const totals = invoiceTotals(
      finance.invoices.find((item) => item.id === invoice.id)!,
      finance,
    )
    expect(totals.otherShare).toBe(cents(412345 - totals.mine))
    expect(billNotices(finance, closed)).toEqual([
      {
        cardId: 'c1',
        month: sep,
        message: `A fatura do Nubank Teste de setembro fechou: ${formatMoney(cents(412345))}. Sua parte ${formatMoney(totals.mine)}, do Pai ${formatMoney(totals.otherShare)}.`,
      },
    ])
  })

  it('sem outra pessoa, só o total; total só corrigido pelo banco: nada', () => {
    expect(billNotices(saved(), closed)[0]?.message).toBe(
      `A fatura do Nubank Teste de setembro fechou: ${formatMoney(cents(412345))}.`,
    )
    expect(billNotices(saved(), { ...closed, records: [] })).toEqual([])
    expect(
      billNotices(saved(), {
        ...closed,
        bankTotals: [{ invoiceId: 'nenhuma', bankTotal: cents(1) }],
      }),
    ).toEqual([])
  })
})
