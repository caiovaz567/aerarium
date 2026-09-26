import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../app/authContext'
import { downloadMyData } from '../../data/account'
import { authErrorFromUrl, linkGoogle, signOut } from '../../data/auth'
import { DownloadIcon, GoogleIcon } from '../../ui/icons'
import { useToast } from '../../ui/toastContext'
import { useFinance } from '../../data/useFinance'
import { CategoriesModal } from './CategoriesModal'
import { DeleteAccountModal } from './DeleteAccountModal'

export function SettingsPage() {
  const auth = useAuth()
  const toast = useToast()
  // Coming back from Google with a refusal (for example, already linked elsewhere).
  const [error, setError] = useState(
    () => authErrorFromUrl(window.location.href) ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingCategories, setEditingCategories] = useState(false)
  const finance = useFinance().data
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

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadMyData(user!)
      toast('Seus dados foram baixados')
    } catch {
      setError('Não consegui baixar seus dados. Confere a internet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel settings">
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

      <h3>Categorias</h3>
      <p className="muted">
        Mostram pra onde foi o dinheiro de cada mês, na aba Meses.
      </p>
      <button
        type="button"
        className="btn ghost"
        disabled={!finance}
        onClick={() => setEditingCategories(true)}
      >
        Editar categorias
      </button>
      {editingCategories && finance && (
        <CategoriesModal
          finance={finance}
          onClose={() => setEditingCategories(false)}
        />
      )}

      <h3>Seus dados</h3>
      <p className="muted">
        Uma cópia de tudo que você guardou aqui, num arquivo JSON.
      </p>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={download}
      >
        <DownloadIcon />
        Baixar meus dados
      </button>
      <Link className="link" to="/privacidade">
        Política de privacidade
      </Link>

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

      <h3>Apagar conta</h3>
      <p className="muted">
        Apaga sua conta e tudo que você lançou. Não dá pra desfazer.
      </p>
      <button
        type="button"
        className="btn danger"
        disabled={busy}
        onClick={() => setDeleting(true)}
      >
        Apagar minha conta e meus dados
      </button>
      {deleting && <DeleteAccountModal onClose={() => setDeleting(false)} />}
    </section>
  )
}
