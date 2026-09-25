import { describe, expect, it } from 'vitest'
import { cents } from './money'
import { isoDate, month } from './months'
import { keptAdjustment, planEditError } from './planEdit'
import type { InstallmentPayment, InstallmentPlan } from './types'

const plan: InstallmentPlan = {
  id: 'p',
  cardId: 'c1',
  description: 'Notebook',
  installmentAmount: cents(12000),
  finalAdjustment: cents(1),
  totalInstallments: 10,
  firstMonth: month('2026-08'),
}
const paid = (
  ref: string,
  source: 'manual' | 'invoice' = 'manual',
): InstallmentPayment => ({
  planId: 'p',
  month: month(ref),
  paidOn: isoDate(`${ref}-10`),
  source,
  invoiceId: source === 'invoice' ? 'v' : null,
})

describe('editar parcelamento', () => {
  it('aceita uma edição normal', () => {
    expect(
      planEditError(plan, { ...plan, description: 'PC' }, [paid('2026-08')]),
    ).toBeNull()
  })

  it('pede descrição, valor e total válidos', () => {
    expect(planEditError(null, { ...plan, description: '  ' }, [])).toBe(
      'Escreve o que é.',
    )
    expect(
      planEditError(null, { ...plan, installmentAmount: cents(0) }, []),
    ).toBe('O valor da parcela precisa ser maior que zero.')
    expect(planEditError(null, { ...plan, totalInstallments: 121 }, [])).toBe(
      'O total de parcelas precisa ser de 1 a 120.',
    )
  })

  it('o cronograma precisa incluir os meses já pagos', () => {
    const payments = [paid('2026-08'), paid('2026-09')]
    expect(
      planEditError(plan, { ...plan, firstMonth: month('2026-09') }, payments),
    ).toBe(
      'Tem pagamento em Agosto 2026, fora desse cronograma. Ajusta o mês da primeira ou o total de parcelas.',
    )
    expect(
      planEditError(plan, { ...plan, totalInstallments: 1 }, payments),
    ).toMatch(/Setembro 2026/)
  })

  it('não troca de cartão com parcela paga pela fatura', () => {
    expect(
      planEditError(plan, { ...plan, cardId: null }, [
        paid('2026-08', 'invoice'),
      ]),
    ).toBe(
      'Essa compra tem parcela paga junto com a fatura. Desmarca essas faturas antes de trocar o cartão.',
    )
    expect(
      planEditError(plan, { ...plan, cardId: null }, [paid('2026-08')]),
    ).toBeNull()
  })

  it('ajuste de centavos inválido vira mensagem, não erro', () => {
    expect(
      planEditError(plan, { ...plan, finalAdjustment: cents(50) }, []),
    ).toBe('Valor ou ajuste final da parcela inválido.')
  })

  it('o ajuste da última parcela só fica se valor e total não mudaram', () => {
    expect(keptAdjustment(plan, plan)).toBe(1)
    expect(keptAdjustment(plan, { ...plan, totalInstallments: 9 })).toBe(0)
    expect(keptAdjustment(null, plan)).toBe(0)
  })
})
