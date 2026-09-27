import { installmentSchedule } from './installments'
import { cents } from './money'
import { addMonths, monthLabel } from './months'
import type { InstallmentPayment, InstallmentPlan } from './types'

/**
 * Checks an edited (or new) plan before saving, with the same rules the
 * database enforces, so the person gets a clear message.
 */
export function planEditError(
  original: InstallmentPlan | null,
  next: InstallmentPlan,
  payments: readonly InstallmentPayment[],
): string | null {
  if (!next.description.trim()) return 'Escreve o que é.'
  if (next.installmentAmount <= 0)
    return 'O valor da parcela precisa ser maior que zero.'
  if (
    !Number.isInteger(next.totalInstallments) ||
    next.totalInstallments < 1 ||
    next.totalInstallments > 120
  )
    return 'O total de parcelas precisa ser de 1 a 120.'
  const own = payments.filter((item) => item.planId === next.id)
  const last = addMonths(next.firstMonth, next.totalInstallments - 1)
  const outside = own
    .map((item) => item.month)
    .filter((month) => month < next.firstMonth || month > last)
    .sort()
  if (outside.length)
    return `Tem pagamento em ${monthLabel(outside[0]!)}, fora desse cronograma. Ajusta o mês da primeira ou o total de parcelas.`
  if (
    original &&
    original.cardId !== next.cardId &&
    own.some((item) => item.source === 'invoice')
  )
    return 'Essa compra tem parcela paga junto com a fatura. Desmarca essas faturas antes de trocar o cartão.'
  try {
    installmentSchedule(next, own)
  } catch (error) {
    return (error as Error).message
  }
  return null
}

/**
 * The last-installment cent adjustment only makes sense for the amount and
 * count it was computed for; editing either drops it.
 */
export function keptAdjustment(
  original: InstallmentPlan | null,
  next: Pick<InstallmentPlan, 'installmentAmount' | 'totalInstallments'>,
) {
  return original &&
    original.installmentAmount === next.installmentAmount &&
    original.totalInstallments === next.totalInstallments
    ? original.finalAdjustment
    : cents(0)
}
