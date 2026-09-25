import { useState } from 'react'
import { useAuth } from '../../app/authContext'
import { signOut } from '../../data/auth'

export function SettingsPage() {
  const auth = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const email = auth.status === 'signed-in' ? auth.session.user.email : ''

  return (
    <section className="panel">
      <h2>Ajustes</h2>
      <p className="muted">
        Conectado como <b>{email}</b>
      </p>
      <p className="form-error" role="alert">
        {error}
      </p>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            await signOut()
          } catch (reason) {
            setError((reason as Error).message)
            setBusy(false)
          }
        }}
      >
        Sair
      </button>
    </section>
  )
}
