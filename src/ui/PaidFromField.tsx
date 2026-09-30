import { useId } from 'react'
import {
  BANKS,
  bankName,
  CASH,
  isBankKey,
  paidFromBanks,
} from '../domain/banks'
import { BankLogo } from './BankLogo'
import { WalletIcon } from './icons'

/**
 * "Saiu de" for a Pix, boleto or cash payment: the banks of the person's
 * cards and cash as chips, any other bank in a list. Optional: tapping the
 * chosen chip again clears it.
 */
export function PaidFromField({
  cards,
  value,
  onChange,
}: {
  readonly cards: readonly {
    readonly name: string
    readonly bank?: string | null
  }[]
  readonly value: string | null
  readonly onChange: (value: string | null) => void
}) {
  const otherId = useId()
  const shown = paidFromBanks(cards, value)
  const rest = BANKS.filter((bank) => !shown.includes(bank.key))
  const pick = (key: string) => onChange(value === key ? null : key)
  return (
    <fieldset className="field paid-from">
      <legend>Saiu de (opcional)</legend>
      <div className="paid-from-chips">
        {shown.map((key) => (
          <button
            type="button"
            key={key}
            className="filter-chip"
            aria-pressed={value === key}
            onClick={() => pick(key)}
          >
            <BankLogo bank={key} className="xs" />
            {bankName(key)}
          </button>
        ))}
        <button
          type="button"
          className="filter-chip"
          aria-pressed={value === CASH}
          onClick={() => pick(CASH)}
        >
          <i className="wallet" aria-hidden="true">
            <WalletIcon />
          </i>
          Dinheiro
        </button>
      </div>
      {rest.length > 0 && (
        <>
          <label className="visually-hidden" htmlFor={otherId}>
            Outro banco
          </label>
          <select
            id={otherId}
            value=""
            onChange={(event) =>
              isBankKey(event.target.value) && onChange(event.target.value)
            }
          >
            <option value="">Outro banco…</option>
            {rest.map((bank) => (
              <option key={bank.key} value={bank.key}>
                {bank.name}
              </option>
            ))}
          </select>
        </>
      )}
    </fieldset>
  )
}
