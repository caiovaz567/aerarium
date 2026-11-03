import { useState } from 'react'
import type { Finance } from '../../data/finance'
import { settingsOps } from '../../data/settingsOps'
import { useFinanceOp } from '../../data/useFinance'
import { useBankEnabled } from '../banco/useBank'
import { ShareSettings } from '../compartilhado/ShareSettings'

function OtherName({
  name,
  onSave,
}: {
  readonly name: string
  readonly onSave: (name: string) => void
}) {
  const [draft, setDraft] = useState(name)
  return (
    <input
      className="other-name"
      aria-label="Nome de quem usa seus cartões"
      maxLength={30}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const clean = draft.trim()
        if (clean && clean !== name) onSave(clean)
        else setDraft(name)
      }}
    />
  )
}

/**
 * Who keeps the rest of the invoices, first in the list. Only the Open Finance
 * owner can turn it on, name them and share with their account.
 */
export function OtherPersonRows({ finance }: { readonly finance: Finance }) {
  const enabled = useBankEnabled()
  const run = useFinanceOp()
  const name = finance.otherPerson
  if (!enabled)
    return name ? (
      <li className="settings-row">
        <span className="settings-text">
          <b>{name}</b>
          <small>Fica com o resto das faturas.</small>
        </span>
      </li>
    ) : null
  return (
    <>
      <li className="settings-row">
        <label className="settings-text" htmlFor="outra-pessoa">
          <b>
            {name
              ? 'Fica com o resto das faturas'
              : 'Alguém fica com o resto das faturas?'}
          </b>
          <small>
            {!name
              ? 'Liga pra separar o que é seu do que é de outra pessoa.'
              : finance.bankPurchases === false
                ? 'Você lança só o que é seu.'
                : `Cada compra que chega do banco você marca: sua ou de ${name}.`}
          </small>
        </label>
        {name && (
          <OtherName
            name={name}
            onSave={(next) => run(settingsOps.setOtherPerson(next))}
          />
        )}
        <input
          id="outra-pessoa"
          type="checkbox"
          className="toggle"
          aria-label="Alguém fica com o resto das faturas"
          checked={Boolean(name)}
          onChange={(event) =>
            run(settingsOps.setOtherPerson(event.target.checked ? 'Pai' : null))
          }
        />
      </li>
      {name && <ShareSettings other={name} />}
    </>
  )
}
