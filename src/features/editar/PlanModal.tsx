import { useId, useState, type FormEvent } from 'react'
import { CategoryPicker } from '../../ui/CategoryPicker'
import { editOps, manualPayment } from '../../data/editOps'
import type { Finance, PaymentRow, PlanRow } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { today, useFinanceOp } from '../../data/useFinance'
import { installmentSchedule } from '../../domain/installments'
import { formatMoneyInput } from '../../domain/money'
import {
  addMonths,
  dateBR,
  isoDate,
  monthLabel,
  monthOf,
  monthRange,
  type Month,
} from '../../domain/months'
import { keptAdjustment, planEditError } from '../../domain/planEdit'
import { ArmedButton, MoneyField, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { readMoney } from '../meses/forms'

/** New or edit installment plan (seção 8.7), with its payment history. */
export function PlanModal({
  finance,
  plan,
  presetCardId,
  onClose,
}: {
  readonly finance: Finance
  readonly plan: PlanRow | null
  readonly presetCardId: string | null
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const ids = {
    card: useId(),
    count: useId(),
    first: useId(),
    date: useId(),
    month: useId(),
  }
  const now = monthOf(today())
  const [description, setDescription] = useState(plan?.description ?? '')
  const [cardId, setCardId] = useState(
    plan ? (plan.cardId ?? '') : (presetCardId ?? ''),
  )
  const [note, setNote] = useState(plan?.note ?? '')
  const [categoryId, setCategoryId] = useState(plan?.categoryId ?? null)
  const [value, setValue] = useState(
    plan ? formatMoneyInput(plan.installmentAmount) : '',
  )
  const [count, setCount] = useState(String(plan?.totalInstallments ?? ''))
  const [first, setFirst] = useState<Month>(plan?.firstMonth ?? now)
  const [error, setError] = useState('')

  // Live from the cache, so adding or removing a payment shows at once.
  const payments = plan
    ? finance.payments
        .filter((item) => item.planId === plan.id)
        .sort((a, b) => b.month.localeCompare(a.month))
    : []
  const schedule = plan ? installmentSchedule(plan, finance.payments) : []
  const unpaid = schedule.filter((item) => !item.paid).map((item) => item.month)
  const [payMonth, setPayMonth] = useState<Month | ''>(
    unpaid.includes(now) ? now : (unpaid[0] ?? ''),
  )
  const [payDate, setPayDate] = useState<string>(today())
  // Once a month is paid it leaves the list; fall back to the next open one.
  const chosenMonth = unpaid.includes(payMonth as Month)
    ? payMonth
    : (unpaid[0] ?? '')
  const firstOptions = monthRange(
    addMonths(first < now ? first : now, -24),
    addMonths(first > now ? first : now, 24),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const read = readMoney(value)
    if ('error' in read) return setError(read.error)
    const totalInstallments = Number(count)
    const draft = {
      id: plan?.id ?? crypto.randomUUID(),
      cardId: cardId || null,
      description: description.trim(),
      installmentAmount: read.amount,
      totalInstallments,
      firstMonth: first,
      note: note.trim() || null,
      categoryId,
    }
    const next: PlanRow = {
      ...draft,
      finalAdjustment: keptAdjustment(plan, draft),
    }
    const problem = planEditError(plan, next, finance.payments)
    if (problem) return setError(problem)
    run(plan ? editOps.updatePlan(next) : ops.restorePlan(next, []))
    onClose()
    toast(plan ? 'Salvo' : `${next.description} adicionado`)
  }

  const remove = () => {
    const old = plan!
    const kept = finance.payments.filter((item) => item.planId === old.id)
    run(ops.removePlan(old))
    onClose()
    toast(`${old.description} excluído`, {
      label: 'Desfazer',
      onClick: () => run(ops.restorePlan(old, kept)),
    })
  }

  const removePayment = (payment: PaymentRow) => {
    if (payment.source === 'invoice')
      return setError(
        'Esse pagamento veio da fatura paga. Pra desfazer, desmarca a fatura nos Meses.',
      )
    run(editOps.removePayment(payment))
    toast(`Pagamento de ${monthLabel(payment.month)} removido`, {
      label: 'Desfazer',
      onClick: () => run(editOps.addPayment(payment)),
    })
  }

  const addPayment = () => {
    if (!plan || !chosenMonth) return
    let paidOn
    try {
      paidOn = isoDate(payDate)
    } catch {
      return setError('Escolhe a data do pagamento.')
    }
    const payment = manualPayment(plan, chosenMonth, paidOn)
    run(editOps.addPayment(payment))
    setError('')
    const left = unpaid.length - 1
    toast(left ? `Registrado, faltam ${left}` : 'Quitado! Foi pra Arquivados', {
      label: 'Desfazer',
      onClick: () => run(editOps.removePayment(payment)),
    })
  }

  return (
    <Modal
      title={plan ? 'Editar parcelamento' : 'Novo parcelamento'}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit} noValidate>
        <TextField
          label="O que é"
          value={description}
          onChange={setDescription}
          placeholder="Ex.: PS5 Pro"
        />
        <div className="field">
          <label htmlFor={ids.card}>Cobrado em</label>
          <select
            id={ids.card}
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
          >
            <option value="">Nenhum, pago à parte</option>
            {finance.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <small>
            No cartão, a parcela é paga junto quando você marca a fatura como
            paga nos Meses.
          </small>
        </div>
        <CategoryPicker
          categories={finance.categories}
          value={categoryId}
          onChange={setCategoryId}
        />
        <TextField
          label="Observação (opcional)"
          value={note}
          onChange={setNote}
          placeholder="Ex.: pra Tia, Pai paga 230"
        />
        <div className="two">
          <MoneyField
            label="Valor da parcela"
            value={value}
            onChange={setValue}
          />
          <div className="field">
            <label htmlFor={ids.count}>Total de parcelas</label>
            <input
              id={ids.count}
              inputMode="numeric"
              autoComplete="off"
              placeholder="10"
              value={count}
              onChange={(event) =>
                setCount(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.first}>Mês da primeira</label>
          <select
            id={ids.first}
            value={first}
            onChange={(event) => setFirst(event.target.value as Month)}
          >
            {firstOptions.map((ref) => (
              <option key={ref} value={ref}>
                {monthLabel(ref)}
              </option>
            ))}
          </select>
        </div>

        {plan && (
          <div className="history">
            <small>Pagamentos registrados</small>
            {payments.length ? (
              <ul>
                {payments.map((payment) => (
                  <li key={payment.id}>
                    <b>{dateBR(payment.paidOn)}</b>
                    <span>
                      {monthLabel(payment.month)}
                      {payment.source === 'invoice' ? ' · pela fatura' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePayment(payment)}
                      aria-label={`Remover pagamento de ${monthLabel(payment.month)}`}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Nenhum ainda.</p>
            )}
            {unpaid.length > 0 && (
              <div className="register">
                <div className="field">
                  <label htmlFor={ids.date}>Quando você pagou</label>
                  <input
                    id={ids.date}
                    type="date"
                    value={payDate}
                    onChange={(event) => setPayDate(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={ids.month}>Referente a</label>
                  <select
                    id={ids.month}
                    value={chosenMonth}
                    onChange={(event) =>
                      setPayMonth(event.target.value as Month)
                    }
                  >
                    {unpaid.map((ref) => (
                      <option key={ref} value={ref}>
                        {monthLabel(ref)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={addPayment}
                >
                  Registrar pagamento
                </button>
              </div>
            )}
          </div>
        )}

        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          {plan && <ArmedButton onConfirm={remove}>Excluir</ArmedButton>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
