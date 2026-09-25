import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../app/authContext'
import { currentMonth, monthPath } from '../../app/paths'
import { updatePassword } from '../../data/auth'
import { Brand } from '../../ui/Brand'
import { PasswordField } from '../../ui/PasswordField'
import { useToast } from '../../ui/toastContext'

/** Landing page of the "Esqueci a senha" e-mail link. */
export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6)
      return setError('A senha precisa de pelo menos 6 caracteres.')
    setBusy(true)
    setError('')
    try {
      await updatePassword(password)
      toast('Senha trocada.')
      navigate(monthPath(currentMonth()), { replace: true })
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  return (
    <main id="conteudo" className="login" tabIndex={-1}>
      <div className="login-card">
        <Brand />
        {auth.status === 'loading' ? null : auth.status === 'signed-out' ? (
          <>
            <h2 className="login-title">Esse link não vale mais.</h2>
            <p className="muted">Pede outro na tela de entrar.</p>
            <Link className="btn primary" to="/login">
              Ir pra tela de entrar
            </Link>
          </>
        ) : (
          <form className="login-form" onSubmit={submit} noValidate>
            <h2 className="login-title">Crie uma senha nova.</h2>
            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint="Pelo menos 6 caracteres."
            />
            <p className="form-error" role="alert">
              {error}
            </p>
            <button type="submit" className="btn primary" disabled={busy}>
              Salvar senha
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
