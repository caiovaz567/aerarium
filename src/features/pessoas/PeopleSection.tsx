import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  addPerson,
  addPersonByUsername,
  answerInvitation,
  invitationsKey,
  peopleKey,
  removePerson,
  saveUsername,
  useInvitations,
  usePeople,
  usernameKey,
  useUsername,
  type AddResult,
} from '../../data/people'
import { financeKey } from '../../data/finance'
import { useUserId } from '../../data/useFinance'
import {
  cleanUsername,
  readPersonInput,
  usernameProblem,
} from '../../domain/people'
import { AddButton, ArmedButton, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

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
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const input = readPersonInput(value)
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
        <TextField
          label="Nome ou @usuário"
          value={value}
          onChange={setValue}
          placeholder="Ex.: Prima ou @joao"
        />
        <p className="muted small">
          Só o nome, só você vê. Com @, a pessoa recebe um convite e também vê a
          parte dela.
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

/** Who uses your cards, and who added you. */
export function PeopleSection({
  otherPerson,
}: {
  readonly otherPerson?: string | null
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const people = usePeople()
  const invitations = useInvitations()
  const [adding, setAdding] = useState(false)

  const change = (task: Promise<unknown>, done: string) => {
    void task
      .then(() => {
        void client.invalidateQueries({ queryKey: peopleKey(userId) })
        void client.invalidateQueries({ queryKey: invitationsKey(userId) })
        toast(done)
      })
      .catch(() => toast(NOT_SAVED))
  }

  if (people.isError)
    return (
      <p className="muted small" role="alert">
        Não consegui carregar suas pessoas. Confere a internet e abre de novo.
      </p>
    )

  return (
    <>
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
                <b>{person.username ? `@${person.username}` : person.name}</b>
                <small>
                  {!person.username
                    ? 'Só você vê.'
                    : person.accepted
                      ? 'Aceitou. Vê a parte dela.'
                      : 'Esperando aceitar.'}
                </small>
                <span className="share-actions">
                  <ArmedButton
                    className="link-button"
                    onConfirm={() =>
                      void removePerson(person.id)
                        .then((removed) => {
                          if (!removed)
                            return toast(
                              'Essa pessoa tem compras marcadas. Troca o "De quem" delas antes.',
                            )
                          void client.invalidateQueries({
                            queryKey: peopleKey(userId),
                          })
                          void client.invalidateQueries({
                            queryKey: financeKey(userId),
                          })
                          toast(`${person.name} saiu da sua lista`)
                        })
                        .catch(() => toast(NOT_SAVED))
                    }
                  >
                    Remover
                  </ArmedButton>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <AddButton onClick={() => setAdding(true)}>Adicionar pessoa</AddButton>
      </section>

      {Boolean(invitations.data?.length) && (
        <section aria-labelledby="ajustes-convites">
          <h3 id="ajustes-convites" className="settings-label">
            Quem te adicionou
          </h3>
          <ul className="settings-card">
            {invitations.data!.map((item) => (
              <li className="settings-row share-row" key={item.personId}>
                <span className="settings-text">
                  <b>{item.fromName}</b>
                  <small>
                    {item.accepted
                      ? 'Você aceitou. Essa pessoa pode marcar compras como suas.'
                      : 'Quer te adicionar. Aceitando, pode marcar compras como suas, e você vê só essas compras.'}
                  </small>
                  <span className="share-actions">
                    {!item.accepted && (
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
                    )}
                    <ArmedButton
                      className="link-button"
                      onConfirm={() =>
                        change(
                          answerInvitation(item.personId, false),
                          item.accepted
                            ? `Você saiu da lista de ${item.fromName}`
                            : 'Convite recusado',
                        )
                      }
                    >
                      {item.accepted ? 'Sair' : 'Recusar'}
                    </ArmedButton>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adding && <AddPersonModal onClose={() => setAdding(false)} />}
    </>
  )
}

/** Ajustes → Conta: the username others invite you with. */
export function UsernameSection() {
  const username = useUsername()
  const [editing, setEditing] = useState(false)
  return (
    <section aria-labelledby="ajustes-usuario">
      <h3 id="ajustes-usuario" className="settings-label">
        Seu usuário
      </h3>
      <ul className="settings-card">
        <li className="settings-row">
          <span className="settings-text">
            <b>{username.data ? `@${username.data}` : 'Nenhum ainda'}</b>
            <small>Só precisa dele quem quer ser convidado.</small>
          </span>
          <button
            type="button"
            className="link-button"
            disabled={username.isPending || username.isError}
            onClick={() => setEditing(true)}
          >
            {username.data ? 'Trocar' : 'Escolher'}
          </button>
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
