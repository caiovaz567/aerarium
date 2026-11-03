import { useEffect, useId, useState, type ReactNode } from 'react'
import { ME, OTHER, type Who } from '../domain/people'
import { maskMoneyInput } from '../domain/money'
import { CheckIcon, PlusIcon, TrashIcon } from './icons'

/** Round "paid" toggle used on every outflow row. */
export function CheckButton({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean
  /** What the row is, e.g. "Conta de luz". */
  readonly label: string
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className="check"
      aria-pressed={checked}
      aria-label={`${checked ? 'Pago' : 'Marcar como pago'}: ${label}`}
      onClick={() => onChange(!checked)}
    >
      <CheckIcon />
    </button>
  )
}

export function TrashButton({
  label,
  onClick,
}: {
  readonly label: string
  readonly onClick: () => void
}) {
  return (
    <button
      type="button"
      className="trash"
      aria-label={`Excluir ${label}`}
      onClick={onClick}
    >
      <TrashIcon />
    </button>
  )
}

/** Text input for money, typed left to right: "1250" shows "1.250", a comma starts the cents. */
export function MoneyField({
  label,
  value,
  onChange,
  hint,
  autoFocus,
  allowNegative = false,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly hint?: ReactNode
  readonly autoFocus?: boolean
  /** The iPhone number pad has no minus sign, so these get the full keyboard. */
  readonly allowNegative?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input">
        <span aria-hidden="true">R$</span>
        <input
          id={id}
          inputMode={allowNegative ? 'text' : 'numeric'}
          autoComplete="off"
          placeholder="0,00"
          value={maskMoneyInput(value, allowNegative)}
          autoFocus={autoFocus}
          onChange={(event) =>
            onChange(maskMoneyInput(event.target.value, allowNegative))
          }
        />
      </div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  readonly label: string
  readonly hint?: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <label className="check-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

/** Destructive button that asks for a second tap. */
export function ArmedButton({
  children,
  onConfirm,
  className = 'btn danger',
}: {
  readonly children: string
  readonly onConfirm: () => void
  readonly className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 3500)
    return () => window.clearTimeout(timer)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className}${armed ? ' armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? 'Toca de novo pra confirmar' : children}
    </button>
  )
}

/** "+ Something" at the bottom of a block, with an SVG plus. */
export function AddButton({
  children,
  onClick,
}: {
  readonly children: string
  readonly onClick: () => void
}) {
  return (
    <button type="button" className="add" onClick={onClick}>
      <PlusIcon />
      {children}
    </button>
  )
}

/** Whose a purchase is: the owner's, the other person's or someone's in the list. */
export function WhoField({
  other,
  people,
  value,
  onChange,
}: {
  /** The other person's name ("Pai"), if any. */
  readonly other?: string | null
  readonly people?: readonly { readonly id: string; readonly name: string }[]
  readonly value: Who
  readonly onChange: (who: Who) => void
}) {
  const options: [Who, string][] = [
    [ME, 'Meu'],
    ...(other ? ([[OTHER, other]] as [Who, string][]) : []),
    ...(people ?? []).map((item): [Who, string] => [item.id, item.name]),
  ]
  return (
    <div className="field">
      <span id="de-quem">De quem</span>
      <div className="segmented who" role="group" aria-labelledby="de-quem">
        {options.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
