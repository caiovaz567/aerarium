import { useId, useState, type FormEvent } from 'react'
import { editOps } from '../../data/editOps'
import type { Finance, SubscriptionRow } from '../../data/finance'
import { useFinanceOp } from '../../data/useFinance'
import { normalizeText } from '../../domain/categories'
import { formatMoneyInput } from '../../domain/money'
import { CategoryPicker } from '../../ui/CategoryPicker'
import { ArmedButton, MoneyField, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { readMoney } from '../meses/forms'

/** New or edit subscription (seção 8.6). */
export function SubscriptionModal({
  finance,
  subscription,
  onClose,
}: {
  readonly finance: Finance
  readonly subscription: SubscriptionRow | null
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const ids = { day: useId(), card: useId() }
  const [name, setName] = useState(subscription?.name ?? '')
  const [day, setDay] = useState(String(subscription?.chargeDay ?? ''))
  const [value, setValue] = useState(
    subscription ? formatMoneyInput(subscription.amount) : '',
  )
  const [cardId, setCardId] = useState(subscription?.cardId ?? '')
  const [note, setNote] = useState(subscription?.note ?? '')
  // A new one starts in "Assinaturas" when the person has that category.
  const [categoryId, setCategoryId] = useState(
    subscription
      ? (subscription.categoryId ?? null)
      : (finance.categories.find(
          (item) => normalizeText(item.name) === 'assinaturas',
        )?.id ?? null),
  )
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Escreve o nome da assinatura.')
    const chargeDay = Number(day)
    if (!Number.isInteger(chargeDay) || chargeDay < 1 || chargeDay > 31)
      return setError('O dia precisa ser de 1 a 31.')
    const read = readMoney(value)
    if ('error' in read || read.amount <= 0)
      return setError('Esse valor não deu certo. Exemplo: 23,90')
    const row: SubscriptionRow = {
      id: subscription?.id ?? crypto.randomUUID(),
      cardId: cardId || null,
      name: name.trim(),
      amount: read.amount,
      chargeDay,
      note: note.trim() || null,
      active: subscription?.active ?? true,
      categoryId,
    }
    run(
      subscription
        ? editOps.updateSubscription(row)
        : editOps.addSubscription(row),
    )
    onClose()
    toast(subscription ? 'Salvo' : 'Assinatura adicionada')
  }

  const remove = () => {
    const old = subscription!
    run(editOps.removeSubscription(old))
    onClose()
    toast(`${old.name} excluída`, {
      label: 'Desfazer',
      onClick: () => run(editOps.addSubscription(old)),
    })
  }

  return (
    <Modal
      title={subscription ? 'Editar assinatura' : 'Nova assinatura'}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit} noValidate>
        <TextField
          label="Assinatura"
          value={name}
          onChange={setName}
          placeholder="Ex.: Netflix"
        />
        <div className="two">
          <div className="field">
            <label htmlFor={ids.day}>Dia da cobrança</label>
            <input
              id={ids.day}
              inputMode="numeric"
              autoComplete="off"
              placeholder="10"
              value={day}
              onChange={(event) =>
                setDay(event.target.value.replace(/\D/g, ''))
              }
            />
          </div>
          <MoneyField label="Valor" value={value} onChange={setValue} />
        </div>
        <div className="field">
          <label htmlFor={ids.card}>Cartão</label>
          <select
            id={ids.card}
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
          >
            <option value="">Nenhum</option>
            {finance.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <small>A assinatura entra na conta da fatura desse cartão.</small>
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
        />
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          {subscription && (
            <ArmedButton onConfirm={remove}>Excluir</ArmedButton>
          )}
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
