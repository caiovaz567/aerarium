import { useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { shareWith, stopSharing, type ShareRow } from '../../data/shared'
import { useUserId } from '../../data/useFinance'
import { mySharesKey, useMyShares } from '../../data/useShared'
import { BANKS } from '../../domain/banks'
import { ArmedButton, TextField } from '../../ui/controls'
import { EyeIcon } from '../../ui/icons'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

/** Share with the other person's account: e-mail, your name, one Pix key. */
function ShareModal({
  other,
  current,
  onClose,
  onSaved,
}: {
  readonly other: string
  readonly current: ShareRow | null
  readonly onClose: () => void
  readonly onSaved: () => void
}) {
  const ids = { bank: useId() }
  const [email, setEmail] = useState(current?.viewerEmail ?? '')
  const [name, setName] = useState(current?.ownerName ?? '')
  const [pixBank, setPixBank] = useState(current?.pixBank ?? '')
  const [pixKey, setPixKey] = useState(current?.pixKey ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError(`Coloca o e-mail da conta do ${other} no Aerarium.`)
    if (!name.trim())
      return setError('Coloca o seu nome, do jeito que ele te chama.')
    setBusy(true)
    setError('')
    try {
      const found = await shareWith({
        email: email.trim(),
        ownerName: name.trim(),
        pixKey: pixKey.trim(),
        pixBank,
      })
      if (!found)
        return setError(
          `Não achei conta no Aerarium com esse e-mail. O ${other} precisa criar a conta primeiro.`,
        )
      onSaved()
    } catch {
      setError('Não consegui salvar. Confere a internet e tenta de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Compartilhar com o ${other}`} onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <p className="muted small">
          Na conta dele aparece “Cartões do seu nome”, só com o que você marcou
          como dele. Ele não vê nada seu.
        </p>
        <TextField
          label={`E-mail da conta do ${other}`}
          value={email}
          onChange={setEmail}
          placeholder="Ex.: pai@email.com"
        />
        <TextField
          label="Seu nome, como ele vai ver"
          value={name}
          onChange={setName}
          placeholder="Ex.: Caio"
        />
        <div className="field">
          <label htmlFor={ids.bank}>Banco da sua chave Pix</label>
          <select
            id={ids.bank}
            value={pixBank}
            onChange={(event) => setPixBank(event.target.value)}
          >
            <option value="">Sem Pix</option>
            {BANKS.map((bank) => (
              <option key={bank.key} value={bank.key}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Sua chave Pix (opcional)"
          value={pixKey}
          onChange={setPixKey}
          placeholder="CPF, e-mail, celular ou chave aleatória"
        />
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Compartilhar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Ajustes → Bancos conectados, with someone else using the cards: share with
 * their own account, and see it as they do.
 */
export function ShareSettings({ other }: { readonly other: string }) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const shares = useMyShares()
  const [editing, setEditing] = useState(false)
  const current = shares.data?.[0] ?? null
  const refresh = () => {
    void client.invalidateQueries({ queryKey: mySharesKey(userId) })
  }
  return (
    <>
      <li className="settings-row share-row">
        <span className="settings-icon warn" aria-hidden="true">
          <EyeIcon />
        </span>
        <span className="settings-text">
          <b>Conta do {other} no Aerarium</b>
          <small>
            {current
              ? `Compartilhado com ${current.viewerEmail}. Ele vê só o que é dele.`
              : `Ele vê, na conta dele, só o que você marcar como dele.`}
          </small>
          <span className="share-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => setEditing(true)}
            >
              {current ? 'Editar' : 'Compartilhar'}
            </button>
            {current && (
              <ArmedButton
                className="link-button"
                onConfirm={() => {
                  void stopSharing(userId, current.viewerEmail)
                    .then(() => {
                      refresh()
                      toast('Parou de compartilhar')
                    })
                    .catch(() =>
                      toast(
                        'Não consegui salvar. Confere a internet e tenta de novo.',
                      ),
                    )
                }}
              >
                Parar
              </ArmedButton>
            )}
          </span>
        </span>
      </li>
      {editing && (
        <ShareModal
          other={other}
          current={current}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refresh()
            toast(`Compartilhado com o ${other}`)
          }}
        />
      )}
    </>
  )
}
