import { useState } from 'react'
import { bankOps } from '../../data/bank'
import type { Finance } from '../../data/finance'
import { useFinanceOp } from '../../data/useFinance'
import type { ImportResult } from '../../domain/bank'
import { settingsOps } from '../../data/settingsOps'
import { BankIcon, PeopleIcon, RefreshIcon } from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { PreviewCards } from './PreviewCards'
import { importMessage, lastSync, useBankEnabled, useBankSync } from './useBank'

const when = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : 'nunca'

/** Name of the other person, saved when the field loses focus. */
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
 * Open Finance in Ajustes (only for the app's owner): each bank card and the
 * app card it feeds, and "Atualizar agora". The first import shows a preview.
 */
export function BankSection({ finance }: { readonly finance: Finance }) {
  const enabled = useBankEnabled()
  const run = useFinanceOp()
  const toast = useToast()
  const { fetchPlan, save } = useBankSync()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [synced, setSynced] = useState(lastSync)
  if (!enabled) return null

  const update = async () => {
    setBusy(true)
    setError('')
    try {
      const outcome = await fetchPlan()
      setSynced(lastSync())
      if (outcome.first && outcome.result.records.length)
        setPreview(outcome.result)
      else {
        save(outcome.result)
        toast(importMessage(outcome.result))
      }
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="ajustes-bancos">
      <h3 id="ajustes-bancos" className="settings-label">
        Bancos conectados
      </h3>
      <ul className="settings-card">
        {finance.bankAccounts.map((account) => (
          <li className="settings-row" key={account.id}>
            <span className="settings-icon accent" aria-hidden="true">
              <BankIcon />
            </span>
            <span className="settings-text">
              <b>{account.name}</b>
              <small>
                {account.number ? `final ${account.number} · ` : ''}
                {account.cardId ? 'entra no cartão' : 'não importa'}
              </small>
            </span>
            <select
              className="bank-card"
              aria-label={`Cartão do app para ${account.name}`}
              value={account.cardId ?? ''}
              onChange={(event) =>
                run(bankOps.setAccountCard(account, event.target.value || null))
              }
            >
              <option value="">Não importar</option>
              {finance.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </li>
        ))}
        <li className="settings-row">
          <span className="settings-icon accent" aria-hidden="true">
            <PeopleIcon />
          </span>
          <label className="settings-text" htmlFor="outra-pessoa">
            <b>Outra pessoa usa seus cartões</b>
            <small>
              {finance.otherPerson
                ? `As compras de ${finance.otherPerson} e o "outros" das faturas ficam separados. Você paga a fatura e ele te devolve.`
                : 'Liga pra separar o que é seu do que é de outra pessoa.'}
            </small>
          </label>
          {finance.otherPerson && (
            <OtherName
              name={finance.otherPerson}
              onSave={(name) => run(settingsOps.setOtherPerson(name))}
            />
          )}
          <input
            id="outra-pessoa"
            type="checkbox"
            className="switch"
            checked={Boolean(finance.otherPerson)}
            onChange={(event) =>
              run(
                settingsOps.setOtherPerson(event.target.checked ? 'Pai' : null),
              )
            }
          />
        </li>
        <li>
          <button
            type="button"
            className="settings-row action"
            aria-label="Atualizar agora"
            disabled={busy}
            onClick={update}
          >
            <span className="settings-icon pos" aria-hidden="true">
              <RefreshIcon />
            </span>
            <span className="settings-text">
              <b>{busy ? 'Buscando no banco…' : 'Atualizar agora'}</b>
              <small>
                {finance.bankAccounts.length
                  ? `Última busca: ${when(synced)}. O banco atualiza uma vez por dia.`
                  : 'Busca seus cartões no banco pela primeira vez.'}
              </small>
            </span>
          </button>
        </li>
      </ul>
      <p className="form-error" role="alert">
        {error}
      </p>

      {preview && (
        <Modal title="Primeira importação" onClose={() => setPreview(null)}>
          <div className="modal-form">
            <p>{importMessage(preview)}</p>
            <p className="muted">
              Começa do zero hoje: as compras que já estavam no banco ficam de
              fora, e seus meses continuam como você lançou. Fatura já fechada
              no banco fica com o total do banco. Daqui pra frente, cada compra
              nova aparece em "Chegou do banco" pra você conferir.
            </p>
            {preview.notices.length > 0 && (
              <ul className="bank-notices">
                {preview.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            )}
            <PreviewCards finance={finance} result={preview} />
            <div className="modal-actions">
              <span className="spacer" />
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPreview(null)}
              >
                Agora não
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  save(preview)
                  setPreview(null)
                  toast('Importado do banco')
                }}
              >
                Importar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
