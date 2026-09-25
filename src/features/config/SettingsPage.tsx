import { useState } from 'react'
import { useAuth } from '../../app/authContext'
import { authErrorFromUrl, linkGoogle, signOut } from '../../data/auth'
import { GoogleIcon } from '../../ui/icons'

export function SettingsPage() {
  const auth = useAuth()
  // Coming back from Google with a refusal (for example, already linked elsewhere).
  const [error, setError] = useState(
    () => authErrorFromUrl(window.location.href) ?? '',
  )
  const [busy, setBusy] = useState(false)
  const user = auth.status === 'signed-in' ? auth.session.user : null
  const identities = user?.identities ?? []
  const google = identities.find((item) => item.provider === 'google')
  const hasPassword = identities.some((item) => item.provider === 'email')

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>Ajustes</h2>
      <p className="muted">
        Conectado como <b>{user?.email}</b>
      </p>

      <h3>Formas de entrar</h3>
      <ul className="plain-list">
        {hasPassword && <li>E-mail e senha</li>}
        {google && (
          <li>
            Google
            {google.identity_data?.email
              ? ` (${String(google.identity_data.email)})`
              : ''}
          </li>
        )}
      </ul>
      {!google && (
        <button
          type="button"
          className="btn google"
          disabled={busy}
          onClick={() => run(linkGoogle)}
        >
          <GoogleIcon />
          Conectar conta Google
        </button>
      )}

      <p className="form-error" role="alert">
        {error}
      </p>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={() => run(signOut)}
      >
        Sair
      </button>
    </section>
  )
}
