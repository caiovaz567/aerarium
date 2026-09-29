import { useId, useState, type FormEvent } from 'react'
import { cardSnapshot, editOps } from '../../data/editOps'
import type { Card, Finance } from '../../data/finance'
import { today, useFinanceOp } from '../../data/useFinance'
import { BANKS, cardBank, NO_BANK } from '../../domain/banks'
import { autoColor, CARD_PALETTE } from '../../domain/cardColor'
import { BankLogo } from '../../ui/BankLogo'
import { CardArt } from '../../ui/CardArt'
import { ArmedButton, CheckField, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

/**
 * New or edit card: preview, name, bank (logo), color, closing and due day.
 * Card photos were removed at the user's request after phase 8.
 */
export function CardModal({
  finance,
  card,
  onClose,
}: {
  readonly finance: Finance
  readonly card: Card | null
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const closingId = useId()
  const dueId = useId()
  const [name, setName] = useState(card?.name ?? '')
  const [color, setColor] = useState<string | null>(card?.color ?? null)
  const [closing, setClosing] = useState(String(card?.closingDay ?? ''))
  const [due, setDue] = useState(String(card?.dueDay ?? ''))
  const [shared, setShared] = useState(card?.shared ?? false)
  // null: follows the name until the person picks one.
  const [bankChoice, setBankChoice] = useState(card?.bank ?? null)
  const shownBank = cardBank({ name, bank: bankChoice }) ?? NO_BANK
  const [error, setError] = useState('')

  const bank = autoColor(name)
  const swatches = [
    bank,
    ...CARD_PALETTE.filter((item) => item.toLowerCase() !== bank.toLowerCase()),
  ]
  const selected = color ?? bank

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Escreve o nome do cartão.')
    if (trimmed.length > 60) return setError('O nome pode ter até 60 letras.')
    const day = closing ? Number(closing) : null
    if (day !== null && !(day >= 1 && day <= 31))
      return setError('O dia de fechamento precisa ser de 1 a 31.')
    const dueDay = due ? Number(due) : null
    if (dueDay !== null && !(dueDay >= 1 && dueDay <= 31))
      return setError('O dia de vencimento precisa ser de 1 a 31.')
    const next: Card = {
      id: card?.id ?? crypto.randomUUID(),
      name: trimmed,
      color,
      closingDay: day,
      dueDay,
      bank: bankChoice,
      shared,
      sortOrder:
        card?.sortOrder ??
        Math.max(0, ...finance.cards.map((item) => item.sortOrder)) + 1,
    }
    run(card ? editOps.updateCard(next) : editOps.addCard(next))
    onClose()
    toast(card ? 'Salvo' : `${next.name} criado`)
  }

  const remove = () => {
    const snapshot = cardSnapshot(finance, card!)
    run(editOps.removeCard(snapshot))
    onClose()
    toast(`${card!.name} excluído`, {
      label: 'Desfazer',
      onClick: () => run(editOps.restoreCard(snapshot, today())),
    })
  }

  return (
    <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="card-edit">
          <CardArt
            card={{ name: name || 'Seu cartão', color, bank: bankChoice }}
            size="lg"
          />
        </div>
        <TextField
          label="Nome do cartão"
          value={name}
          onChange={setName}
          placeholder="Ex.: NuBank"
        />
        <fieldset className="field">
          <legend>Banco</legend>
          <div className="bank-options">
            {BANKS.map((item) => (
              <label className="bank-option" key={item.key} title={item.name}>
                <input
                  type="radio"
                  name="banco"
                  checked={shownBank === item.key}
                  onChange={() => setBankChoice(item.key)}
                  aria-label={item.name}
                />
                <BankLogo bank={item.key} />
              </label>
            ))}
            <label className="bank-option none" title="Sem logo">
              <input
                type="radio"
                name="banco"
                checked={shownBank === NO_BANK}
                onChange={() => setBankChoice(NO_BANK)}
                aria-label="Sem logo"
              />
              <span>Sem logo</span>
            </label>
          </div>
        </fieldset>
        {shownBank === NO_BANK && (
          <fieldset className="field">
            <legend>Cor</legend>
            <div className="swatches">
              {swatches.map((item, index) => (
                <label
                  className="swatch"
                  key={item}
                  title={index === 0 ? 'Cor do banco' : item}
                >
                  <input
                    type="radio"
                    name="cor"
                    checked={selected.toLowerCase() === item.toLowerCase()}
                    onChange={() => setColor(index === 0 ? null : item)}
                    aria-label={index === 0 ? 'Cor do banco' : `Cor ${item}`}
                  />
                  <i style={{ background: item }} />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="field">
          <label htmlFor={closingId}>Dia de fechamento (opcional)</label>
          <input
            id={closingId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 5"
            value={closing}
            onChange={(event) =>
              setClosing(event.target.value.replace(/\D/g, '').slice(0, 2))
            }
          />
          <small>
            Gastos lançados depois desse dia já vão pra fatura do mês seguinte.
          </small>
        </div>
        <div className="field">
          <label htmlFor={dueId}>Dia de vencimento (opcional)</label>
          <input
            id={dueId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 12"
            value={due}
            onChange={(event) =>
              setDue(event.target.value.replace(/\D/g, '').slice(0, 2))
            }
          />
        </div>
        {finance.otherPerson && (
          <CheckField
            label={`O ${finance.otherPerson} usa este cartão`}
            hint={`A parte dele é o total da fatura no banco menos o que é seu.`}
            checked={shared}
            onChange={setShared}
          />
        )}
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          {card && <ArmedButton onConfirm={remove}>Excluir</ArmedButton>}
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
