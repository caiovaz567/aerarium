import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  addPerson,
  answerInvitation,
  invitationsKey,
  invitePerson,
  peopleKey,
  removePerson,
  saveUsername,
  unlinkPerson,
  useInvitations,
  usePeople,
  usernameKey,
  useUsername,
  type InviteResult,
  type Person,
} from '../../data/people'
import { useUserId } from '../../data/useFinance'
import {
  cleanUsername,
  personNameProblem,
  usernameProblem,
} from '../../domain/people'
import { AddButton, ArmedButton, TextField } from '../../ui/controls'
import { PeopleIcon } from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

const NOT_SAVED = 'Não consegui salvar. Confere a internet e tenta de novo.'

const INVITE_PROBLEM: Record<Exclude<InviteResult, 'ok'>, string> = {
  'no-person': 'Essa pessoa não está mais na sua lista.',
  'no-username': 'Escolhe o seu usuário primeiro.',
  'not-found': 'Não achei esse usuário. Confere com a pessoa.',
  self: 'Esse usuário é o seu.',
  already: 'Essa conta já está em outra pessoa da sua lista.',
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
          É com ele que outra pessoa te encontra no Aerarium. Ela precisa
          digitar igualzinho, não tem lista nem busca.
        </p>
        <TextField
          label="Usuário"
          value={value}
          onChange={setValue}
          placeholder="Ex.: caio"
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

function AddPersonModal({
  hasUsername,
  onClose,
}: {
  readonly hasUsername: boolean
  readonly onClose: () => void
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = cleanUsername(username)
    const problem =
      personNameProblem(name) ?? (clean ? usernameProblem(clean) : null)
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      const id = await addPerson(userId, name)
      const invite = clean ? await invitePerson(id, clean) : null
      await client.invalidateQueries({ queryKey: peopleKey(userId) })
      // The name is saved either way; a bad username can be tried again.
      toast(
        !invite
          ? `${name.trim()} entrou na sua lista`
          : invite === 'ok'
            ? `Convite enviado pra @${clean}`
            : `${name.trim()} entrou só com o nome. ${INVITE_PROBLEM[invite]}`,
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
        <TextField
          label="Nome"
          value={name}
          onChange={setName}
          placeholder="Ex.: João"
        />
        {hasUsername ? (
          <TextField
            label="Usuário dela no Aerarium (opcional)"
            value={username}
            onChange={setUsername}
            placeholder="Ex.: joao"
          />
        ) : (
          <p className="muted small">
            Pra convidar pelo usuário, escolhe o seu antes. Sem convite, ela
            fica só com o nome na sua lista.
          </p>
        )}
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

function InviteModal({
  person,
  onClose,
}: {
  readonly person: Person
  readonly onClose: () => void
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const [value, setValue] = useState('')
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
      const result = await invitePerson(person.id, username)
      if (result !== 'ok') return setError(INVITE_PROBLEM[result])
      await client.invalidateQueries({ queryKey: peopleKey(userId) })
      toast(`Convite enviado pra @${username}`)
      onClose()
    } catch {
      setError(NOT_SAVED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Convidar ${person.name}`} onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <TextField
          label="Usuário no Aerarium"
          value={value}
          onChange={setValue}
          placeholder="Ex.: joao"
        />
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Enviando…' : 'Convidar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Ajustes → Pessoas: your username, invitations, and who uses your cards. */
export function PeopleSection({
  otherPerson,
}: {
  readonly otherPerson?: string | null
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const username = useUsername()
  const people = usePeople()
  const invitations = useInvitations()
  const [dialog, setDialog] = useState<'username' | 'add' | null>(null)
  const [inviting, setInviting] = useState<Person | null>(null)

  const change = (task: Promise<unknown>, done: string) => {
    void task
      .then(() => {
        void client.invalidateQueries({ queryKey: peopleKey(userId) })
        void client.invalidateQueries({ queryKey: invitationsKey(userId) })
        toast(done)
      })
      .catch(() => toast(NOT_SAVED))
  }

  if (username.isError || people.isError)
    return (
      <p className="muted small" role="alert">
        Não consegui carregar suas pessoas. Confere a internet e abre de novo.
      </p>
    )

  return (
    <>
      <section aria-labelledby="ajustes-usuario">
        <h3 id="ajustes-usuario" className="settings-label">
          Seu usuário
        </h3>
        <ul className="settings-card">
          <li className="settings-row">
            <span className="settings-icon accent" aria-hidden="true">
              <PeopleIcon />
            </span>
            <span className="settings-text">
              <b>{username.data ? `@${username.data}` : 'Nenhum ainda'}</b>
              <small>É assim que outra pessoa te convida.</small>
            </span>
            <button
              type="button"
              className="btn small"
              disabled={username.isPending}
              onClick={() => setDialog('username')}
            >
              {username.data ? 'Trocar' : 'Escolher'}
            </button>
          </li>
        </ul>
      </section>

      {Boolean(invitations.data?.length) && (
        <section aria-labelledby="ajustes-convites">
          <h3 id="ajustes-convites" className="settings-label">
            Quem te adicionou
          </h3>
          <ul className="settings-card">
            {invitations.data!.map((item) => {
              const who = item.fromUsername ? `@${item.fromUsername}` : 'Alguém'
              return (
                <li className="settings-row share-row" key={item.personId}>
                  <span className="settings-text">
                    <b>{who}</b>
                    <small>
                      {item.accepted
                        ? 'Você aceitou. Essa pessoa pode marcar compras como suas.'
                        : 'Quer te adicionar. Aceitando, essa pessoa pode marcar compras como suas, e você vê só essas compras.'}
                    </small>
                    <span className="share-actions">
                      {!item.accepted && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            change(
                              answerInvitation(item.personId, true),
                              `Você aceitou o convite de ${who}`,
                            )
                          }
                        >
                          Aceitar
                        </button>
                      )}
                      <ArmedButton
                        className="link-button"
                        onConfirm={() =>
                          change(
                            answerInvitation(item.personId, false),
                            item.accepted
                              ? `Você saiu da lista de ${who}`
                              : 'Convite recusado',
                          )
                        }
                      >
                        {item.accepted ? 'Sair' : 'Recusar'}
                      </ArmedButton>
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="ajustes-pessoas">
        <h3 id="ajustes-pessoas" className="settings-label">
          Quem usa seus cartões
        </h3>
        <ul className="settings-card">
          {otherPerson && (
            <li className="settings-row">
              <span className="settings-text">
                <b>{otherPerson}</b>
                <small>Fica com o resto das faturas.</small>
              </span>
            </li>
          )}
          {people.data?.map((person) => (
            <li className="settings-row share-row" key={person.id}>
              <span className="settings-text">
                <b>{person.name}</b>
                <small>
                  {!person.username
                    ? 'Só o nome. Essa pessoa não vê nada.'
                    : person.accepted
                      ? `@${person.username}`
                      : `@${person.username}, esperando aceitar`}
                </small>
                <span className="share-actions">
                  {person.username ? (
                    <ArmedButton
                      className="link-button"
                      onConfirm={() =>
                        change(
                          unlinkPerson(person.id),
                          `${person.name} ficou só com o nome`,
                        )
                      }
                    >
                      Desligar conta
                    </ArmedButton>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setInviting(person)}
                    >
                      Convidar
                    </button>
                  )}
                  <ArmedButton
                    className="link-button"
                    onConfirm={() =>
                      change(
                        removePerson(person.id),
                        `${person.name} saiu da sua lista`,
                      )
                    }
                  >
                    Remover
                  </ArmedButton>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <AddButton onClick={() => setDialog('add')}>Adicionar pessoa</AddButton>
      </section>

      {dialog === 'username' && (
        <UsernameModal
          current={username.data ?? null}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'add' && (
        <AddPersonModal
          hasUsername={Boolean(username.data)}
          onClose={() => setDialog(null)}
        />
      )}
      {inviting && (
        <InviteModal person={inviting} onClose={() => setInviting(null)} />
      )}
    </>
  )
}
