import { useState, type FormEvent, type ReactNode } from 'react'
import type { BillRow, ExpenseRow, IncomeRow } from '../../data/finance'
import type { Category } from '../../domain/categories'
import { formatMoneyInput, type Cents } from '../../domain/money'
import {
  ArmedButton,
  CheckField,
  MoneyField,
  TextField,
} from '../../ui/controls'
import { CategoryPicker } from '../../ui/CategoryPicker'
import { WhenField } from '../../ui/WhenField'
import { instantToSaoPaulo, saoPauloToInstant } from '../../domain/timeline'
import { dayMonth } from '../../domain/months'
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
  }) => void
  readonly onDelete: () => void
}) {
  const [description, setDescription] = useState(bill.description)
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
  onClose,
  onSave,
  onDelete,
}: {
  readonly expense: ExpenseRow
  readonly categories: readonly Category[]
  readonly onClose: () => void
  readonly onSave: (changes: {
    description: string
    amount: Cents
    categoryId: string | null
    occurredAt: string | null
  }) => void
  readonly onDelete: () => void
}) {
  const [description, setDescription] = useState(expense.description)
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
          description: description.trim(),
          amount: read.amount,
          categoryId,
          occurredAt,
        })
      }}
    >
      <TextField
        label="Descrição"
        value={description}
        onChange={setDescription}
        placeholder="Ex.: Uber"
      />
      <MoneyField label="Valor (R$)" value={value} onChange={setValue} />
      <WhenField
        label="Quando (opcional)"
        value={when}
        onChange={setWhen}
        hint={
          when ? undefined : `Sem hora; o dia é ${dayMonth(expense.spentOn)}.`
        }
      />
      <CategoryPicker
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
      />
    </FormModal>
  )
}
