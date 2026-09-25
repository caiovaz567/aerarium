import type { AuthError } from '@supabase/supabase-js'
import { supabase } from './supabase'

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha errados.',
  email_not_confirmed:
    'Falta confirmar o e-mail. Abre o link que mandamos pra você.',
  weak_password: 'Essa senha é fraca demais. Tenta uma mais longa.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  email_address_invalid: 'Esse e-mail não parece válido.',
  validation_failed: 'Confere o e-mail e a senha.',
  signup_disabled: 'Criar conta está desligado no momento.',
  over_email_send_rate_limit:
    'Muitos e-mails em pouco tempo. Espera um pouco e tenta de novo.',
  over_request_rate_limit:
    'Muitas tentativas em pouco tempo. Espera um pouco e tenta de novo.',
  provider_disabled: 'Entrar com Google ainda não está ligado.',
  otp_expired: 'Esse link expirou. Pede outro.',
  manual_linking_disabled: 'Conectar outra forma de entrar está desligado.',
  identity_already_exists:
    'Essa conta Google já está ligada a outra conta do Aerarium.',
}

/** Error the auth server appends to the URL when it sends the person back. */
export function authErrorFromUrl(url: string): string | null {
  const { search, hash } = new URL(url)
  const params = new URLSearchParams(search)
  new URLSearchParams(hash.slice(1)).forEach((value, key) =>
    params.set(key, value),
  )
  if (!params.has('error') && !params.has('error_code')) return null
  return authMessage({
    code: params.get('error_code') ?? undefined,
    status: 400,
  })
}

/** Friendly Portuguese text for Supabase Auth errors. */
export function authMessage(error: Pick<AuthError, 'code' | 'status'>) {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!
  if (!error.status)
    return 'Não consegui falar com o servidor. Confere a internet.'
  return 'Algo deu errado. Tenta de novo.'
}

const origin = () => window.location.origin

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(authMessage(error))
}

/** Returns true when the account still needs the confirmation e-mail. */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${origin()}/` },
  })
  if (error) throw new Error(authMessage(error))
  return !data.session
}

export async function signInWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin()}/` },
  })
  if (error) throw new Error(authMessage(error))
}

/** Adds Google to the account that is signed in, so both ways reach the same data. */
export async function linkGoogle() {
  const { error } = await supabase().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${origin()}/config` },
  })
  if (error) throw new Error(authMessage(error))
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin()}/redefinir-senha`,
  })
  if (error) throw new Error(authMessage(error))
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password })
  if (error) throw new Error(authMessage(error))
}

/** Signs out this device only; other devices keep their session. */
export async function signOut() {
  const { error } = await supabase().auth.signOut({ scope: 'local' })
  if (error) throw new Error(authMessage(error))
}

/** Whether the Google provider is turned on in the project (public settings). */
export async function googleEnabled(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  })
  if (!response.ok) return false
  const settings = (await response.json()) as {
    external?: { google?: boolean }
  }
  return settings.external?.google === true
}
