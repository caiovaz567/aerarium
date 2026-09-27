import { useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  confirmsDelete,
  deleteMyAccount,
  DELETE_WORD,
} from '../../data/account'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

/** Typing APAGAR confirms; there is no undo. */
export function DeleteAccountModal({
  onClose,
}: {
  readonly onClose: () => void
}) {
  const client = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = confirmsDelete(typed)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      await deleteMyAccount()
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
      return
    }
    client.clear()
    toast('Sua conta e seus dados foram apagados.')
    navigate('/login', { replace: true })
  }

  return (
    <Modal
      title="Apagar sua conta?"
      onClose={busy ? () => {} : onClose}
      initialFocus="input[name=confirmar]"
    >
      <form className="modal-form" onSubmit={submit} noValidate>
        <p>
          Sua conta e todos os seus dados (meses, cartões, parcelamentos e
          assinaturas) vão ser apagados pra sempre. Se quiser guardar uma cópia,
          baixe seus dados antes.
        </p>
        <div className="field">
          <label htmlFor={inputId}>Digite {DELETE_WORD} pra confirmar</label>
          <input
            id={inputId}
            name="confirmar"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <span className="spacer" />
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn danger armed"
            disabled={!ready || busy}
          >
            {busy ? 'Apagando…' : 'Apagar tudo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
