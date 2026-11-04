import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { currentMonth, monthPath } from '../../app/paths'
import { useProfile } from '../../app/profileContext'
import {
  addPerson,
  addPersonByUsername,
  answerInvitation,
  invitationsKey,
  peopleKey,
  saveUsername,
  useInvitations,
  usePeople,
  usernameKey,
  useUsername,
  type AddResult,
  type Person,
} from '../../data/people'
import { financeKey, type Finance } from '../../data/finance'
import { useUserId } from '../../data/useFinance'
import { sharedKey, useSharedWithMe } from '../../data/useShared'
import { monthBalance, personBalance } from '../../domain/balance'
import { cents, formatMoney, type Cents } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'
import {
  cleanUsername,
  readPersonInput,
  usernameProblem,
} from '../../domain/people'
import { AddButton, ArmedButton, TextField } from '../../ui/controls'
import { ChevronRightIcon } from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { sharedLine } from '../compartilhado/sharedFinance'
import { defaultMonth } from '../meses/monthView'
import { OtherPersonRows } from './OtherPersonRows'

const NOT_SAVED = 'Não consegui salvar. Confere a internet e tenta de novo.'

const ADD_PROBLEM: Record<Exclude<AddResult, 'ok'>, string> = {
  'not-found': 'Não achei esse usuário. Confere com a pessoa.',
  self: 'Esse usuário é o seu.',
  already: 'Essa pessoa já está na sua lista.',
}

function UsernameModal({
  current,
  onClose,
}: {
  readonly current: string | null
  readonly onClose: () => void
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const [value, setValue] = useState(current ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const username = cleanUsername(value)
    const problem = usernameProblem(username)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      if (!(await saveUsername(userId, username)))
        return setError('Esse usuário já é de outra pessoa. Tenta outro.')
      await client.invalidateQueries({ queryKey: usernameKey(userId) })
      toast(`Agora você é @${username}`)
      onClose()
    } catch {
      setError(NOT_SAVED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Seu usuário" onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <p className="muted small">
          É com ele que outra pessoa te convida. Ela precisa digitar igualzinho,
          não tem lista nem busca.
        </p>
        <TextField
          label="Usuário"
          value={value}
          onChange={setValue}
          placeholder="Ex.: caio.vaz"
        />
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddPersonModal({ onClose }: { readonly onClose: () => void }) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const [hasAccount, setHasAccount] = useState(true)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = (next: boolean) => {
    setHasAccount(next)
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const input = readPersonInput(
      hasAccount ? `@${cleanUsername(value)}` : value.trim().replace(/^@+/, ''),
    )
    if (input.kind === 'problem') return setError(input.problem)
    setBusy(true)
    setError('')
    try {
      if (input.kind === 'username') {
        const result = await addPersonByUsername(input.username)
        if (result !== 'ok') return setError(ADD_PROBLEM[result])
      } else await addPerson(userId, input.name)
      await client.invalidateQueries({ queryKey: peopleKey(userId) })
      void client.invalidateQueries({ queryKey: financeKey(userId) })
      toast(
        input.kind === 'username'
          ? `Convite enviado pra @${input.username}`
          : `${input.name} entrou na sua lista`,
      )
      onClose()
    } catch {
      setError(NOT_SAVED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Adicionar pessoa" onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div
          className="segmented"
          role="group"
          aria-label="A pessoa usa o Aerarium?"
        >
          <button
            type="button"
            aria-pressed={hasAccount}
            onClick={() => pick(true)}
          >
            Tem Aerarium
          </button>
          <button
            type="button"
            aria-pressed={!hasAccount}
            onClick={() => pick(false)}
          >
            Não tem
          </button>
        </div>
        <TextField
          label={hasAccount ? 'Usuário da pessoa' : 'Nome'}
          value={value}
          onChange={setValue}
          placeholder={hasAccount ? 'Ex.: @joao' : 'Ex.: Prima'}
        />
        <p className="muted small">
          {hasAccount
            ? 'Peça o usuário que aparece na tela Pessoas dela. Ela recebe um convite e vê só as compras que você marcar como dela.'
            : 'Só você vê. Serve pra separar as compras dessa pessoa das suas.'}
        </p>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** The username others invite you with, ready to pass along. */
function UsernameSection() {
  const username = useUsername()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const copy = () => {
    const value = `@${username.data}`
    void (navigator.clipboard?.writeText(value) ?? Promise.reject())
      .then(() => toast('Usuário copiado'))
      .catch(() => toast(`Seu usuário: ${value}`))
  }
  return (
    <section aria-labelledby="pessoas-usuario">
      <h3 id="pessoas-usuario" className="settings-label">
        Seu usuário
      </h3>
      <ul className="settings-card">
        <li className="settings-row share-row">
          <span className="settings-text">
            <b>{username.data ? `@${username.data}` : 'Nenhum ainda'}</b>
            <small>
              {username.data
                ? 'Passe pra quem quer te adicionar.'
                : 'Escolha um pra outra pessoa poder te adicionar.'}
            </small>
            <span className="share-actions">
              {username.data && (
                <button type="button" className="link-button" onClick={copy}>
                  Copiar
                </button>
              )}
              <button
                type="button"
                className="link-button"
                disabled={username.isPending || username.isError}
                onClick={() => setEditing(true)}
              >
                {username.data ? 'Trocar' : 'Escolher'}
              </button>
            </span>
          </span>
        </li>
      </ul>
      {editing && (
        <UsernameModal
          current={username.data ?? null}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  )
}

/** One line in the list: tapping it opens the person's month in Meses. */
function PersonRow({
  title,
  status,
  owed,
  due,
  month,
  profile,
}: {
  readonly title: string
  readonly status: string
  readonly owed: Cents
  readonly due: Cents
  readonly month: Month
  readonly profile: string
}) {
  const { setProfile } = useProfile(undefined)
  const money =
    due > 0
      ? `Te deve ${formatMoney(due)} em ${monthName(month)}`
      : owed > 0
        ? `Pagou ${monthName(month)}`
        : null
  return (
    <li>
      <Link
        className="settings-row action"
        to={monthPath(month)}
        onClick={() => setProfile(profile)}
      >
        <span className="settings-text">
          <b>{title}</b>
          <small>{money ? `${status} · ${money}` : status}</small>
        </span>
        <span className="settings-chevron" aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </Link>
    </li>
  )
}

const statusOf = (person: Person) =>
  !person.username
    ? 'Só você vê'
    : person.accepted
      ? 'Vê só as compras marcadas'
      : 'Esperando aceitar'

const NOTHING = { owed: cents(0), due: cents(0) }

/**
 * Pessoas: your username, invitations waiting, the cards you follow, and who
 * uses your cards. A person's details are their month in Meses.
 */
export function PeopleSection({ finance }: { readonly finance?: Finance }) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const people = usePeople()
  const invitations = useInvitations()
  const shared = useSharedWithMe(false)
  const [adding, setAdding] = useState(false)

  const change = (task: Promise<unknown>, done: string) => {
    void task
      .then(() => {
        void client.invalidateQueries({ queryKey: peopleKey(userId) })
        void client.invalidateQueries({ queryKey: invitationsKey(userId) })
        void client.invalidateQueries({ queryKey: sharedKey(userId) })
        toast(done)
      })
      .catch(() => toast(NOT_SAVED))
  }

  const month =
    (finance && defaultMonth(finance, currentMonth())) ?? currentMonth()
  const known = finance?.months.some((item) => item.ref === month)
    ? finance
    : null
  const pai = known && monthBalance(month, known)
  const waiting = invitations.data?.filter((item) => !item.accepted) ?? []
  const views = shared.data ?? []
  // Accepted, but with no copy to open: the way out still has to be here.
  const noCopy = shared.data
    ? (invitations.data ?? []).filter(
        (item) =>
          item.accepted &&
          !views.some((view) => view.personId === item.personId),
      )
    : []
  const nobody = !finance?.otherPerson && people.data?.length === 0

  return (
    <>
      <UsernameSection />

      {waiting.length > 0 && (
        <section aria-labelledby="pessoas-convites">
          <h3 id="pessoas-convites" className="settings-label">
            Convites
          </h3>
          <ul className="settings-card">
            {waiting.map((item) => (
              <li className="settings-row share-row" key={item.personId}>
                <span className="settings-text">
                  <b>{item.fromName}</b>
                  <small>
                    Quer te adicionar. Aceitando, você vê as compras que essa
                    pessoa marcar como suas.
                  </small>
                  <span className="share-actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() =>
                        change(
                          answerInvitation(item.personId, true),
                          `Você aceitou o convite de ${item.fromName}`,
                        )
                      }
                    >
                      Aceitar
                    </button>
                    <ArmedButton
                      className="link-button"
                      onConfirm={() =>
                        change(
                          answerInvitation(item.personId, false),
                          'Convite recusado',
                        )
                      }
                    >
                      Recusar
                    </ArmedButton>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {views.length + noCopy.length > 0 && (
        <section aria-labelledby="pessoas-acompanha">
          <h3 id="pessoas-acompanha" className="settings-label">
            Cartões que você acompanha
          </h3>
          <ul className="settings-card">
            {views.map((view) => (
              <li key={view.ownerId}>
                <Link
                  className="settings-row action"
                  to={`/compartilhado?de=${view.ownerId}`}
                >
                  <span className="settings-text">
                    <b>Cartões do {view.ownerName}</b>
                    <small>{sharedLine(view)}</small>
                  </span>
                  <span className="settings-chevron" aria-hidden="true">
                    <ChevronRightIcon />
                  </span>
                </Link>
              </li>
            ))}
            {noCopy.map((item) => (
              <li className="settings-row share-row" key={item.personId}>
                <span className="settings-text">
                  <b>Cartões do {item.fromName}</b>
                  <small>Nada por enquanto</small>
                  <span className="share-actions">
                    <ArmedButton
                      className="link-button"
                      onConfirm={() =>
                        change(
                          answerInvitation(item.personId, false),
                          `Você saiu da lista de ${item.fromName}`,
                        )
                      }
                    >
                      Sair
                    </ArmedButton>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pessoas-lista">
        <h3 id="pessoas-lista" className="settings-label">
          Quem usa seus cartões
        </h3>
        <ul className="settings-card">
          {finance?.otherPerson ? (
            <PersonRow
              title={finance.otherPerson}
              status="Fica com o resto das faturas"
              owed={pai ? pai.otherOwed : NOTHING.owed}
              due={pai ? pai.otherDue : NOTHING.due}
              month={month}
              profile="other"
            />
          ) : (
            finance && <OtherPersonRows finance={finance} />
          )}
          {people.isError && (
            <li className="settings-row" role="alert">
              <span className="settings-text">
                <small>
                  Não consegui carregar as outras pessoas. Confere a internet e
                  abre de novo.
                </small>
              </span>
            </li>
          )}
          {people.data?.map((person) => {
            const balance = known
              ? personBalance(month, known, person.id)
              : NOTHING
            return (
              <PersonRow
                key={person.id}
                title={person.username ? `@${person.username}` : person.name}
                status={statusOf(person)}
                owed={balance.owed}
                due={balance.due}
                month={month}
                profile={person.id}
              />
            )
          })}
          {nobody && (
            <li className="settings-row">
              <span className="settings-text">
                <small>
                  Ninguém ainda. Adicione quem compra nos seus cartões pra
                  separar o que é de cada um.
                </small>
              </span>
            </li>
          )}
        </ul>
        <AddButton onClick={() => setAdding(true)}>Adicionar pessoa</AddButton>
      </section>

      {adding && <AddPersonModal onClose={() => setAdding(false)} />}
    </>
  )
}
