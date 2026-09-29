import { describe, expect, it } from 'vitest'
import { emptyData, invoice, plan } from './__fixtures__/seed'
import {
  invoiceTotals,
  setInvoiceOther,
  setInvoicePaid,
  setInvoiceTotal,
} from './invoices'
import { cents } from './money'
import { isoDate, month } from './months'

const data = emptyData({
  plans: [
    plan(),
    plan({ id: 'outside', cardId: null }),
    plan({ id: 'another-card', cardId: 'other' }),
  ],
  subscriptions: [
    { id: 'active', cardId: 'card', amount: cents(2000), active: true },
    { id: 'inactive', cardId: 'card', amount: cents(9000), active: false },
    { id: 'outside', cardId: null, amount: cents(9000), active: true },
  ],
  expenses: [
    { invoiceId: 'invoice', amount: cents(1200) },
    { invoiceId: 'invoice', amount: cents(800) },
    { invoiceId: 'other', amount: cents(9999) },
  ],
})

describe('composição, congelamento e pagamentos', () => {
  it('soma parcela, assinatura ativa, gastos e outros sem duplicar', () => {
    expect(invoiceTotals(invoice({ otherAmount: cents(3000) }), data)).toEqual({
      installmentsAmount: 10000,
      subscriptionsAmount: 2000,
      expensesAmount: 2000,
      otherAmount: 3000,
      calculatedTotal: 17000,
      total: 17000,
      otherShare: 0,
      mine: 17000,
    })
    expect(invoiceTotals(invoice(), emptyData()).total).toBe(0)
  })
  it('sei o total considera gastos lançados e rejeita total abaixo do fixo', () => {
    expect(setInvoiceTotal(invoice(), cents(17000), data)).toMatchObject({
      otherAmount: 3000,
      estimated: false,
    })
    expect(setInvoiceTotal(invoice(), cents(14000), data).otherAmount).toBe(0)
    expect(() => setInvoiceTotal(invoice(), cents(13999), data)).toThrow(
      'gastos lançados',
    )
    expect(setInvoiceOther(invoice(), cents(0)).estimated).toBe(false)
    expect(() => setInvoiceOther(invoice(), cents(-1))).toThrow()
  })
  it('congela, preserva total e data e reabre com cálculo atual', () => {
    const original = invoice({ otherAmount: cents(3000) })
    const paid = setInvoicePaid(original, true, isoDate('2026-09-24'), data)
    const changed = {
      ...data,
      plans: [plan({ installmentAmount: cents(11000) })],
      payments: paid.payments,
    }
    expect(paid.invoice).toMatchObject({
      paid: true,
      closedTotal: 17000,
      paidOn: '2026-09-24',
    })
    expect(paid.payments).toEqual([
      {
        planId: 'plan',
        month: '2026-09',
        paidOn: '2026-09-24',
        source: 'invoice',
        invoiceId: 'invoice',
      },
    ])
    expect(invoiceTotals(paid.invoice, changed)).toMatchObject({
      total: 17000,
      calculatedTotal: 18000,
    })
    expect(
      setInvoicePaid(paid.invoice, true, isoDate('2026-10-01'), changed),
    ).toEqual(paid)
    const reopened = setInvoicePaid(
      paid.invoice,
      false,
      isoDate('2026-10-01'),
      changed,
    )
    expect(reopened.invoice).toMatchObject({
      paid: false,
      closedTotal: null,
      paidOn: null,
    })
    expect(reopened.payments).toEqual([])
    expect(invoiceTotals(reopened.invoice, changed).total).toBe(18000)
    expect(original.paid).toBe(false)
    expect(data.payments).toEqual([])
  })
  it('pagar e reabrir preserva manuais e pagamentos de outra fatura', () => {
    const payments = [
      {
        planId: 'plan',
        month: month('2026-09'),
        paidOn: isoDate('2026-09-02'),
        source: 'manual' as const,
        invoiceId: null,
      },
      {
        planId: 'plan',
        month: month('2026-10'),
        paidOn: isoDate('2026-10-02'),
        source: 'invoice' as const,
        invoiceId: 'other-invoice',
      },
    ]
    const context = { ...data, payments }
    const paid = setInvoicePaid(invoice(), true, isoDate('2026-09-24'), context)
    expect(paid.payments).toEqual(payments)
    expect(
      setInvoicePaid(paid.invoice, false, isoDate('2026-09-24'), context)
        .payments,
    ).toEqual(payments)
  })
  it('recusa fatura paga sem total/data', () => {
    expect(() => invoiceTotals(invoice({ paid: true }), data)).toThrow()
    expect(() =>
      invoiceTotals(invoice({ paid: true, closedTotal: cents(0) }), data),
    ).toThrow()
  })
})
