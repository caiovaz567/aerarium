import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../app/authContext'
import { currentMonth, monthPath } from '../../app/paths'
import {
  googleEnabled,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUp,
} from '../../data/auth'
import { Brand } from '../../ui/Brand'
import { GoogleIcon } from '../../ui/icons'
import { PasswordField } from '../../ui/PasswordField'

type Mode = 'entrar' | 'criar' | 'esqueci'

const MIN_PASSWORD = 6

const SUBMIT: Record<Mode, string> = {
  entrar: 'Entrar',
  criar: 'Criar conta',
  esqueci: 'Mandar link',
}

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (auth.status === 'signed-in') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? monthPath(currentMonth())} replace />
  }

  const switchTo = (next: Mode) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await task()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const google = () =>
    run(async () => {
      const enabled = await queryClient.fetchQuery({
        queryKey: ['auth', 'google-enabled'],
        queryFn: googleEnabled,
        staleTime: 5 * 60_000,
      })
      if (!enabled) throw new Error('Entrar com Google ainda não está ligado.')
      await signInWithGoogle()
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return setError('Coloca seu e-mail.')
    if (mode === 'esqueci')
      return run(async () => {
        await sendPasswordReset(email)
        setInfo(
          'Se esse e-mail tiver conta, mandamos um link pra criar uma senha nova.',
        )
      })
    if (password.length < MIN_PASSWORD)
      return setError(
        `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`,
      )
    if (mode === 'entrar') return run(() => signInWithPassword(email, password))
    return run(async () => {
      if (await signUp(email, password))
        setInfo('Enviamos um link pro seu e-mail. Abre ele pra ativar a conta.')
    })
  }

  return (
    <main id="conteudo" className="login" tabIndex={-1}>
      <div className="login-card">
        <Brand />
        <h2 className="login-title">Suas finanças, mês a mês.</h2>

        {mode !== 'esqueci' && (
          <>
            <button
              type="button"
              className="btn google"
              onClick={google}
              disabled={busy}
            >
              <GoogleIcon />
              Entrar com Google
            </button>
            <p className="divider">
              <span>ou com e-mail</span>
            </p>
          </>
        )}

        <form className="login-form" onSubmit={submit} noValidate>
          {mode === 'esqueci' && (
            <p className="muted">
              Coloca seu e-mail que a gente manda um link pra você criar uma
              senha nova.
            </p>
          )}
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {mode !== 'esqueci' && (
            <PasswordField
              label="Senha"
              value={password}
              onChange={setPassword}
              autoComplete={
                mode === 'criar' ? 'new-password' : 'current-password'
              }
              hint={
                mode === 'criar'
                  ? `Pelo menos ${MIN_PASSWORD} caracteres.`
                  : undefined
              }
            />
          )}
          <p className="form-error" role="alert">
            {error}
          </p>
          <p className="form-info" role="status">
            {info}
          </p>
          <button type="submit" className="btn primary" disabled={busy}>
            {SUBMIT[mode]}
          </button>
        </form>

        <div className="login-links">
          {mode === 'entrar' && (
            <>
              <button
                type="button"
                className="link"
                onClick={() => switchTo('esqueci')}
              >
                Esqueci a senha
              </button>
              <button
                type="button"
                className="link"
                onClick={() => switchTo('criar')}
              >
                Criar conta
              </button>
            </>
          )}
          {mode !== 'entrar' && (
            <button
              type="button"
              className="link"
              onClick={() => switchTo('entrar')}
            >
              Já tenho conta
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
