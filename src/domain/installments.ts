import { cents, nonNegative, sumMoney, type Cents } from './money'
import { addMonths, isoDate, monthsBetween, type Month } from './months'
import type { InstallmentPayment, InstallmentPlan } from './types'

export function validateInstallmentCount(count: number): void {
  if (!Number.isInteger(count) || count < 1 || count > 120)
    throw new RangeError('Escolha de 1 a 120 parcelas.')
}

export function splitInstallments(total: Cents, count: number) {
  validateInstallmentCount(count)
  nonNegative(total)
  const installmentAmount = cents(Math.floor(total / count))
  if (installmentAmount === 0)
    throw new RangeError('Cada parcela precisa ter pelo menos um centavo.')
  return {
    installmentAmount,
    finalAdjustment: cents(total - installmentAmount * count),
  }
}

function validatePlan(plan: InstallmentPlan): void {
  validateInstallmentCount(plan.totalInstallments)
  nonNegative(plan.installmentAmount)
  cents(plan.finalAdjustment)
  if (
    plan.installmentAmount === 0 ||
    plan.installmentAmount + plan.finalAdjustment <= 0 ||
    Math.abs(plan.finalAdjustment) >= plan.totalInstallments
  ) {
    throw new RangeError('Valor ou ajuste final da parcela inválido.')
  }
  addMonths(plan.firstMonth, plan.totalInstallments - 1)
}

export function installmentNumber(
  plan: InstallmentPlan,
  target: Month,
): number | null {
  validatePlan(plan)
  const number = monthsBetween(plan.firstMonth, target) + 1
  return number >= 1 && number <= plan.totalInstallments ? number : null
}

export function installmentSchedule(
  plan: InstallmentPlan,
  payments: readonly InstallmentPayment[] = [],
) {
  validatePlan(plan)
  const byMonth = new Map<Month, InstallmentPayment>()
  for (const payment of payments.filter((item) => item.planId === plan.id)) {
    if (
      installmentNumber(plan, payment.month) === null ||
      byMonth.has(payment.month)
    )
      throw new RangeError('Pagamento duplicado ou fora do cronograma.')
    isoDate(payment.paidOn)
    if ((payment.source === 'invoice') !== (payment.invoiceId !== null))
      throw new RangeError('Origem do pagamento inválida.')
    byMonth.set(payment.month, payment)
  }
  return Array.from({ length: plan.totalInstallments }, (_, index) => {
    const month = addMonths(plan.firstMonth, index)
    const payment = byMonth.get(month)
    return {
      planId: plan.id,
      cardId: plan.cardId,
      description: plan.description,
      month,
      number: index + 1,
      totalInstallments: plan.totalInstallments,
      amount: sumMoney([
        plan.installmentAmount,
        index === plan.totalInstallments - 1 ? plan.finalAdjustment : cents(0),
      ]),
      paid: payment !== undefined,
      paidOn: payment?.paidOn ?? null,
      source: payment?.source ?? null,
      invoiceId: payment?.invoiceId ?? null,
    }
  })
}

export function installmentStatus(
  plan: InstallmentPlan,
  payments: readonly InstallmentPayment[] = [],
) {
  const schedule = installmentSchedule(plan, payments)
  const unpaid = schedule.filter((item) => !item.paid)
  const paidDates = schedule
    .flatMap((item) => (item.paidOn ? [item.paidOn] : []))
    .sort()
  return {
    remaining: unpaid.length,
    paidCount: schedule.length - unpaid.length,
    settled: unpaid.length === 0,
    outstanding: sumMoney(unpaid.map((item) => item.amount)),
    lastMonth: schedule[schedule.length - 1]!.month,
    settledOn: unpaid.length === 0 ? paidDates[paidDates.length - 1]! : null,
  }
}
