import { PaidFromField } from '../../ui/PaidFromField'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { BillRow, ExpenseRow, IncomeRow } from '../../data/finance'
import type { Category } from '../../domain/categories'
import { formatMoneyInput, type Cents } from '../../domain/money'
import {
  ArmedButton,
  CheckField,
  MoneyField,
  TextField,
  WhoField,
} from '../../ui/controls'
import { CategoryPicker } from '../../ui/CategoryPicker'
import { WhenField } from '../../ui/WhenField'
import { instantToSaoPaulo, saoPauloToInstant } from '../../domain/timeline'
import { dayMonth, monthLabel, type Month } from '../../domain/months'
import { Modal } from '../../ui/Modal'
import { readMoney } from './forms'

function FormModal({
  title,
  error,
  onClose,
  onSubmit,
  onDelete,
  children,
}: {
  readonly title: string
  readonly error: string
  readonly onClose: () => void
  readonly onSubmit: () => void
  readonly onDelete?: () => void
  readonly children: ReactNode
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        {children}
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          {onDelete && <ArmedButton onConfirm={onDelete}>Excluir</ArmedButton>}
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

export function IncomeModal({
  income,
  onClose,
  onSave,
  onDelete,
}: {
  readonly income: IncomeRow
  readonly onClose: () => void
  readonly onSave: (changes: { description: string; amount: Cents }) => void
  readonly onDelete: () => void
}) {
  const [description, setDescription] = useState(income.description)
  const [value, setValue] = useState(formatMoneyInput(income.amount))
  const [error, setError] = useState('')
  const carryover = income.kind === 'carryover'
  return (
    <FormModal
      title="Editar entrada"
      error={error}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={() => {
        if (!description.trim()) return setError('Escreve uma descrição.')
        const read = readMoney(value, carryover)
        if ('error' in read) return setError(read.error)
        onSave({ description: description.trim(), amount: read.amount })
      }}
    >
      <TextField
        label="Descrição"
        value={description}
        onChange={setDescription}
        placeholder="Ex.: Salário"
      />
      <MoneyField
        label="Valor (R$)"
        value={value}
        onChange={setValue}
        allowNegative={carryover}
        hint={
          carryover
            ? 'Pode ser negativo, quando o mês fechou no vermelho.'
            : undefined
        }
      />
    </FormModal>
  )
}

export function BillModal({
  bill,
  cards,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  readonly bill: BillRow
  readonly categories: readonly Category[]
  readonly onClose: () => void
  readonly onSave: (changes: {
    description: string
    amount: Cents
    paid: boolean
    categoryId: string | null
    occurredAt: string | null
    paidFrom: string | null
  }) => void
  readonly onDelete: () => void
  /** For "Saiu de": the banks of these cards come first. */
  readonly cards: readonly {
    readonly name: string
    readonly bank?: string | null
  }[]
}) {
  const [description, setDescription] = useState(bill.description)
  const [paidFrom, setPaidFrom] = useState(bill.paidFrom ?? null)
  const [when, setWhen] = useState(
    bill.occurredAt ? instantToSaoPaulo(bill.occurredAt) : '',
  )
  const [value, setValue] = useState(formatMoneyInput(bill.amount))
  const [paid, setPaid] = useState(bill.paid)
  const [categoryId, setCategoryId] = useState(bill.categoryId ?? null)
  const [error, setError] = useState('')
  return (
    <FormModal
      title="Editar conta"
      error={error}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={() => {
        if (!description.trim()) return setError('Escreve uma descrição.')
        const read = readMoney(value)
        if ('error' in read) return setError(read.error)
        let occurredAt: string | null = null
        if (when)
          try {
            occurredAt = saoPauloToInstant(when)
          } catch {
            return setError('Escolhe a data e a hora.')
          }
        onSave({
          description: description.trim(),
          amount: read.amount,
          paid,
          categoryId,
          occurredAt,
          paidFrom,
        })
      }}
    >
      <TextField
        label="Descrição"
        value={description}
        onChange={setDescription}
        placeholder="Ex.: Conta de luz"
      />
      <MoneyField label="Valor (R$)" value={value} onChange={setValue} />
      <CheckField label="Já paguei" checked={paid} onChange={setPaid} />
      <PaidFromField cards={cards} value={paidFrom} onChange={setPaidFrom} />
      <WhenField label="Quando (opcional)" value={when} onChange={setWhen} />
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />
    </FormModal>
  )
}

/** A launched card expense (Fase 11): description, value and category. */
export function ExpenseModal({
  expense,
  categories,
  otherPerson = null,
  month,
  months = [],
  onClose,
  onSave,
  onDelete,
}: {
  readonly expense: ExpenseRow
  readonly categories: readonly Category[]
  /** The invoice month it is in, and the ones it can go to (expenseMonths). */
  readonly month?: Month
  readonly months?: readonly Month[]
  /** Fase 13.3: who else uses the cards, if anyone. */
  readonly otherPerson?: string | null
  readonly onClose: () => void
  readonly onSave: (changes: {
    description: string
    amount: Cents
    categoryId: string | null
    occurredAt: string | null
    note?: string | null
    forOther?: boolean
    /** Only when the person picked another invoice month. */
    month?: Month
  }) => void
  readonly onDelete: () => void
}) {
  const [forOther, setForOther] = useState(expense.forOther ?? false)
  const [invoiceMonth, setInvoiceMonth] = useState(month)
  const monthId = useId()
  // A purchase from the bank keeps the bank's name; the person adds a note.
  const fromBank = Boolean(expense.externalId)
  const [description, setDescription] = useState(expense.description)
  const [note, setNote] = useState(expense.note ?? '')
  const [when, setWhen] = useState(
    expense.occurredAt ? instantToSaoPaulo(expense.occurredAt) : '',
  )
  const [value, setValue] = useState(formatMoneyInput(expense.amount))
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? null)
  const [error, setError] = useState('')
  return (
    <FormModal
      title="Editar gasto"
      error={error}
      onClose={onClose}
      onDelete={onDelete}
      onSubmit={() => {
        if (!description.trim()) return setError('Escreve uma descrição.')
        const read = readMoney(value)
        if ('error' in read) return setError(read.error)
        if (read.amount <= 0)
          return setError('O valor precisa ser maior que zero.')
        let occurredAt: string | null = null
        if (when)
          try {
            occurredAt = saoPauloToInstant(when)
          } catch {
            return setError('Escolhe a data e a hora.')
          }
        onSave({
          description: fromBank ? expense.description : description.trim(),
          amount: read.amount,
          categoryId,
          occurredAt,
          ...(fromBank && { note: note.trim().slice(0, 200) || null }),
          ...(otherPerson && { forOther }),
          ...(invoiceMonth !== month && { month: invoiceMonth }),
        })
      }}
    >
      {fromBank ? (
        <>
          <div className="field">
            <span>Nome no banco</span>
            <p className="bank-name">{expense.description}</p>
          </div>
          <TextField
            label="Descrição (opcional)"
            value={note}
            onChange={setNote}
            placeholder="Ex.: presente da Ana"
          />
        </>
      ) : (
        <TextField
          label="Descrição"
          value={description}
          onChange={setDescription}
          placeholder="Ex.: Uber"
        />
      )}
      {otherPerson && (
        <WhoField
          other={otherPerson}
          forOther={forOther}
          onChange={setForOther}
        />
      )}
      <MoneyField label="Valor (R$)" value={value} onChange={setValue} />
      <WhenField
        label="Quando (opcional)"
        value={when}
        onChange={setWhen}
        hint={
          when ? undefined : `Sem hora; o dia é ${dayMonth(expense.spentOn)}.`
        }
      />
      {months.length > 1 && (
        <div className="field">
          <label htmlFor={monthId}>Fatura</label>
          <select
            id={monthId}
            value={invoiceMonth}
            onChange={(event) => setInvoiceMonth(event.target.value as Month)}
          >
            {months.map((ref) => (
              <option key={ref} value={ref}>
                {monthLabel(ref)}
              </option>
            ))}
          </select>
          <small>Troca se a compra caiu na fatura do mês errado.</small>
        </div>
      )}
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />
    </FormModal>
  )
}
