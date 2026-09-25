import type { Finance, PlanRow } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { today, useFinanceOp } from '../../data/useFinance'
import type { Month } from '../../domain/months'
import { useToast } from '../../ui/toastContext'
import type { PlanLine } from './cardView'

/** Paying one installment and deleting a plan, both with "Desfazer". */
export function usePlanActions(finance: Finance) {
  const run = useFinanceOp()
  const toast = useToast()
  return {
    toggle(line: PlanLine, target: Month) {
      if (line.paidWithInvoice)
        return toast(
          'Essa parcela foi paga junto com a fatura. Pra desfazer, desmarca a fatura.',
        )
      const paid = !line.paid
      const day = today()
      run(ops.loosePaid(line.plan, target, paid, day))
      const remaining = line.remaining + (paid ? -1 : 1)
      toast(
        paid
          ? `${line.plan.description}: ${remaining ? `faltam ${remaining}` : 'quitado'}`
          : `${line.plan.description}: pagamento desfeito`,
        {
          label: 'Desfazer',
          onClick: () => run(ops.loosePaid(line.plan, target, !paid, day)),
        },
      )
    },
    remove(plan: PlanRow) {
      const payments = finance.payments.filter(
        (item) => item.planId === plan.id,
      )
      run(ops.removePlan(plan))
      toast(`${plan.description} excluído`, {
        label: 'Desfazer',
        onClick: () => run(ops.restorePlan(plan, payments)),
      })
    },
  }
}
