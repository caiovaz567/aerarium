import { useId, useState, type FormEvent } from 'react'
import type { Finance } from '../../data/finance'
import { today as todayDate, useFinanceOp } from '../../data/useFinance'
import { monthLabel, type Month } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { CheckField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { readMoney } from '../meses/forms'
import {
  buildLaunch,
  installmentPreview,
  launchMonths,
  NO_CARD,
  suggestMonth,
  type LaunchKind,
} from './launch'

const WHERE_KEY = 'aerarium.lancar.onde'
const KINDS: readonly [LaunchKind, string][] = [
  ['gasto', 'Gasto'],
  ['parcelado', 'Parcelado'],
  ['entrada', 'Entrada'],
]
const EXAMPLE: Record<LaunchKind, string> = {
  gasto: 'Ex.: Uber',
  parcelado: 'Ex.: Notebook',
  entrada: 'Ex.: Freela, reembolso',
}

function rememberedWhere(finance: Finance) {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(WHERE_KEY)
  } catch {
    /* private mode */
  }
  if (saved === NO_CARD || finance.cards.some((card) => card.id === saved))
    return saved!
  return finance.cards[0]?.id ?? NO_CARD
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16" height="11" rx="2.5" />
      <path d="M16 13.5h.01" />
    </svg>
  )
}

/** Lançar (seção 8.5): Gasto, Parcelado or Entrada in a few taps. */
export function LaunchModal({
  finance,
  openMonth,
  onClose,
}: {
  readonly finance: Finance
  /** Month open in Meses, if any. */
  readonly openMonth: Month | null
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const day = todayDate()
  const [kind, setKind] = useState<LaunchKind>('gasto')
  const [value, setValue] = useState('')
  const [count, setCount] = useState('')
  const [description, setDescription] = useState('')
  const [where, setWhere] = useState(() => rememberedWhere(finance))
  const [paid, setPaid] = useState(true)
  // Follows the card's closing day until the person picks a month themselves.
  const [pickedMonth, setPickedMonth] = useState<Month | null>(null)
  const [error, setError] = useState('')
  const ids = { count: useId(), text: useId(), month: useId() }

  const card = finance.cards.find((item) => item.id === where) ?? null
  const usesCard = kind !== 'entrada'
  const suggested = suggestMonth(finance, {
    openMonth,
    card: usesCard ? card : null,
    today: day,
  })
  const target = pickedMonth ?? suggested
  const months = launchMonths(finance)
  const existing = new Set(finance.months.map((item) => item.ref))
  const typed = (() => {
    const read = value.trim() ? readMoney(value) : null
    return read && 'amount' in read ? read.amount : null
  })()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const read = readMoney(value)
    if ('error' in read || read.amount <= 0)
      return setError('Coloca o valor. Exemplo: 12,50')
    const installments = Number(count)
    if (
      kind === 'parcelado' &&
      !(
        Number.isInteger(installments) &&
        installments >= 2 &&
        installments <= 120
      )
    )
      return setError('Em quantas vezes? Coloca um número de 2 a 120.')
    if (kind !== 'parcelado' && !target)
      return setError('Crie um mês primeiro, na aba Meses.')
    let launch
    try {
      launch = buildLaunch(finance, {
        kind,
        amount: read.amount,
        installments,
        description,
        where: usesCard ? where : NO_CARD,
        paid,
        month: target ?? months[0]!,
        today: day,
      })
    } catch (reason) {
      return setError((reason as Error).message)
    }
    if (usesCard)
      try {
        localStorage.setItem(WHERE_KEY, where)
      } catch {
        /* private mode: not remembered */
      }
    run(launch.op)
    onClose()
    toast(launch.message, {
      label: 'Desfazer',
      onClick: () => run(launch.undo),
    })
  }

  return (
    <Modal title="Lançar" onClose={onClose} initialFocus="#lancar-valor">
      <form className="launch" onSubmit={submit} noValidate>
        <div className="segmented" role="group" aria-label="Tipo">
          {KINDS.map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={kind === key}
              onClick={() => {
                setKind(key)
                setError('')
                document.getElementById('lancar-valor')?.focus()
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="field launch-value">
          <label htmlFor="lancar-valor">
            {kind === 'parcelado' ? 'Valor total da compra' : 'Valor'}
          </label>
          <input
            id="lancar-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        {kind === 'parcelado' && (
          <div className="field">
            <label htmlFor={ids.count}>Em quantas vezes</label>
            <input
              id={ids.count}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 10"
              value={count}
              onChange={(event) =>
                setCount(event.target.value.replace(/\D/g, ''))
              }
            />
            <small className="launch-preview" aria-live="polite">
              {installmentPreview(typed, Number(count))}
            </small>
          </div>
        )}

        <div className="field">
          <label htmlFor={ids.text}>Descrição</label>
          <input
            id={ids.text}
            autoComplete="off"
            placeholder={EXAMPLE[kind]}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {usesCard && (
          <fieldset className="field where">
            <legend>Onde</legend>
            <div className="where-grid">
              {finance.cards.map((item) => (
                <label className="where-option" key={item.id}>
                  <input
                    type="radio"
                    name="onde"
                    value={item.id}
                    checked={where === item.id}
                    onChange={() => setWhere(item.id)}
                  />
                  <span>
                    <CardArt card={item} size="xs" />
                    <b>{item.name}</b>
                  </span>
                </label>
              ))}
              <label className="where-option">
                <input
                  type="radio"
                  name="onde"
                  value={NO_CARD}
                  checked={where === NO_CARD}
                  onChange={() => setWhere(NO_CARD)}
                />
                <span>
                  <i className="wallet">
                    <WalletIcon />
                  </i>
                  <b>Pix, boleto ou dinheiro</b>
                </span>
              </label>
            </div>
          </fieldset>
        )}

        {kind === 'gasto' && where === NO_CARD && (
          <CheckField
            label="Já paguei"
            hint="Desmarca se for uma conta que você ainda vai pagar."
            checked={paid}
            onChange={setPaid}
          />
        )}

        {kind !== 'parcelado' && target && (
          <div className="field">
            <label htmlFor={ids.month}>Entra em</label>
            <select
              id={ids.month}
              value={target}
              onChange={(event) => setPickedMonth(event.target.value as Month)}
            >
              {months.map((ref) => (
                <option key={ref} value={ref}>
                  {monthLabel(ref)}
                  {existing.has(ref) ? '' : ' (novo)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Lançar
          </button>
        </div>
      </form>
    </Modal>
  )
}
