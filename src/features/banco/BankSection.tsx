import { useEffect, useRef, useState } from 'react'
import { askBankUpdate, bankOps, setupDailyEmail } from '../../data/bank'
import type { Finance } from '../../data/finance'
import { useFinanceOp } from '../../data/useFinance'
import type { ImportResult } from '../../domain/bank'
import { settingsOps } from '../../data/settingsOps'
import {
  BankIcon,
  CardIcon,
  ChevronRightIcon,
  MailIcon,
  PeopleIcon,
  RefreshIcon,
} from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { ShareSettings } from '../compartilhado/ShareSettings'
import { bankItemLines, savedItems } from './bankItems'
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

/** How long the banks that are fine stay on screen after "Atualizar agora". */
const SHOWN_MS = 30_000

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

/** "6 cartões · 5 entram no app". */
function accountsText(finance: Finance) {
  const total = finance.bankAccounts.length
  const used = finance.bankAccounts.filter((item) => item.cardId).length
  return `${total} ${total === 1 ? 'cartão' : 'cartões'} · ${used} ${
    used === 1 ? 'entra' : 'entram'
  } no app`
}

/** Each bank card and the app card it feeds (or "Não importar"). */
function AccountsModal({
  finance,
  onClose,
}: {
  readonly finance: Finance
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  return (
    <Modal title="Cartões do banco" onClose={onClose}>
      <p className="muted small">
        Escolha em qual cartão do app entra cada cartão do banco.
      </p>
      <ul className="bank-accounts">
        {finance.bankAccounts.map((account) => (
          <li key={account.id} className="field">
            <label htmlFor={`conta-${account.id}`}>
              <b>{account.name}</b>
              {account.number && <small> · final {account.number}</small>}
            </label>
            <select
              id={`conta-${account.id}`}
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
      </ul>
      <div className="modal-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          Pronto
        </button>
      </div>
    </Modal>
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
  const [mailing, setMailing] = useState(false)
  const [accounts, setAccounts] = useState(false)
  const [items, setItems] = useState(savedItems)
  // After asking the bank, look again by itself a minute later (a few times).
  const again = useRef<number | undefined>(undefined)
  // The banks that are fine only show for a while after "Atualizar agora";
  // one with a problem stays until it is solved.
  const [fresh, setFresh] = useState(false)
  const hide = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(again.current)
      window.clearTimeout(hide.current)
    },
    [],
  )
  if (!enabled) return null

  const toggleEmail = async (on: boolean) => {
    setError('')
    if (!on) {
      run(settingsOps.setDailyEmail(false))
      return
    }
    setMailing(true)
    try {
      const sent = await setupDailyEmail()
      run(settingsOps.setDailyEmail(true))
      toast(
        sent
          ? `Ligado. Mandei um e-mail com ${sent} ${sent === 1 ? 'compra' : 'compras'} dos últimos dias.`
          : 'Ligado. Mandei um e-mail de teste.',
      )
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setMailing(false)
    }
  }

  const update = async (tries = 3) => {
    setBusy(true)
    setError('')
    window.clearTimeout(again.current)
    try {
      // The bank is only looked at once a day: ask for a look right now.
      const asked = tries === 3 && (await askBankUpdate())
      const outcome = await fetchPlan()
      setSynced(lastSync())
      setItems(outcome.data.items ?? [])
      setFresh(true)
      window.clearTimeout(hide.current)
      hide.current = window.setTimeout(() => setFresh(false), SHOWN_MS)
      const waiting =
        asked || outcome.data.items?.some((item) => item.status === 'UPDATING')
      if (outcome.first && outcome.result.records.length)
        setPreview(outcome.result)
      else {
        save(outcome.result)
        toast(
          waiting && tries > 0
            ? `${importMessage(outcome.result)} Pedi pro banco mandar o que tem de novo; olho de novo em 1 minuto.`
            : importMessage(outcome.result),
        )
        if (waiting && tries > 0)
          again.current = window.setTimeout(
            () => void update(tries - 1),
            60_000,
          )
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
        {finance.bankAccounts.length > 0 && (
          <li>
            <button
              type="button"
              className="settings-row action"
              aria-label="Cartões do banco"
              onClick={() => setAccounts(true)}
            >
              <span className="settings-icon accent" aria-hidden="true">
                <BankIcon />
              </span>
              <span className="settings-text">
                <b>Cartões do banco</b>
                <small>{accountsText(finance)}</small>
              </span>
              <span className="settings-chevron" aria-hidden="true">
                <ChevronRightIcon />
              </span>
            </button>
          </li>
        )}
        <li className="settings-row">
          <span className="settings-icon accent" aria-hidden="true">
            <CardIcon />
          </span>
          <label className="settings-text" htmlFor="compras-do-banco">
            <b>Trazer as compras do banco</b>
            <small>
              {finance.bankPurchases === false
                ? `Desligado: você lança suas compras e, quando a fatura fecha, vem só o total do banco.${finance.otherPerson ? ` O resto é de ${finance.otherPerson}.` : ''}`
                : 'Cada compra do cartão chega sozinha no dia seguinte.'}
            </small>
          </label>
          <input
            id="compras-do-banco"
            type="checkbox"
            className="toggle"
            checked={finance.bankPurchases !== false}
            onChange={(event) =>
              run(settingsOps.setBankPurchases(event.target.checked))
            }
          />
        </li>
        <li className="settings-row">
          <span className="settings-icon accent" aria-hidden="true">
            <MailIcon />
          </span>
          <label className="settings-text" htmlFor="email-diario">
            <b>Resumo por e-mail às 18h</b>
            <small>
              {mailing
                ? 'Ligando e mandando o primeiro…'
                : 'As compras novas do banco, por cartão, no e-mail da sua conta. Só nos dias com compra nova.'}
            </small>
          </label>
          <input
            id="email-diario"
            type="checkbox"
            className="toggle"
            checked={Boolean(finance.dailyEmail)}
            disabled={mailing}
            onChange={(event) => void toggleEmail(event.target.checked)}
          />
        </li>
        <li>
          <button
            type="button"
            className="settings-row action"
            aria-label="Atualizar agora"
            disabled={busy}
            onClick={() => void update()}
          >
            <span className="settings-icon accent" aria-hidden="true">
              <RefreshIcon />
            </span>
            <span className="settings-text">
              <b>{busy ? 'Buscando no banco…' : 'Atualizar agora'}</b>
              <small>
                {finance.bankAccounts.length
                  ? `Última busca: ${when(synced)}. Pede pro banco mandar o que tem de novo.`
                  : 'Busca seus cartões no banco pela primeira vez.'}
              </small>
            </span>
          </button>
        </li>
        {bankItemLines(finance, items, new Date())
          .filter((line) => fresh || line.tone !== 'ok')
          .map((line) => (
            <li className={`settings-row bank-item ${line.tone}`} key={line.id}>
              <span className="settings-text">
                <b>{line.name}</b>
                <small>{line.text}</small>
              </span>
            </li>
          ))}
      </ul>
      <p className="form-error" role="alert">
        {error}
      </p>
      {accounts && (
        <AccountsModal finance={finance} onClose={() => setAccounts(false)} />
      )}
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

/**
 * Ajustes → Pai (only for the Open Finance owner): someone else uses the
 * cards, their name, and sharing with their own account.
 */
export function OtherPersonSection({ finance }: { readonly finance: Finance }) {
  const enabled = useBankEnabled()
  const run = useFinanceOp()
  if (!enabled) return null
  return (
    <section aria-labelledby="ajustes-outra-pessoa">
      <h3 id="ajustes-outra-pessoa" className="settings-label">
        Quem usa seus cartões
      </h3>
      <ul className="settings-card">
        <li className="settings-row">
          <span className="settings-icon warn" aria-hidden="true">
            <PeopleIcon />
          </span>
          <label className="settings-text" htmlFor="outra-pessoa">
            <b>Outra pessoa usa seus cartões</b>
            <small>
              {finance.otherPerson
                ? finance.bankPurchases === false
                  ? `Você lança só o que é seu. O resto da fatura do banco é de ${finance.otherPerson}.`
                  : `Cada compra que chega do banco você marca: sua ou de ${finance.otherPerson}. O que for de ${finance.otherPerson} fica separado.`
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
            className="toggle"
            checked={Boolean(finance.otherPerson)}
            onChange={(event) =>
              run(
                settingsOps.setOtherPerson(event.target.checked ? 'Pai' : null),
              )
            }
          />
        </li>
        {finance.otherPerson && <ShareSettings other={finance.otherPerson} />}
      </ul>
    </section>
  )
}
