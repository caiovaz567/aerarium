// Login for the scripts that read production with the owner's own account.
//
// The first time, it asks for the e-mail and password (typed here, never
// shown or saved) and keeps only the session's refresh token in scripts/data/
// (outside Git). Later runs use that token, which renews itself on each use;
// "Sair" in the app on every device, or deleting the file, ends it. The
// scripts never sign out: that would end the kept session.
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

export const PROD_URL = 'https://kpzupvajcjhjoarxjcvq.supabase.co'
const PROD_APP = 'https://aerarium-delta.vercel.app'

export function env(name) {
  const text = readFileSync('.env.local', 'utf8')
  const line = text.split(/\r?\n/).find((item) => item.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim() ?? ''
}

export async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

/** Reads a line without showing it on screen. */
export function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const input = process.stdin
    let value = ''
    input.setRawMode?.(true)
    input.resume()
    input.setEncoding('utf8')
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          input.setRawMode?.(false)
          input.pause()
          input.off('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === '\u0003') process.exit(1)
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else value += char
      }
    }
    input.on('data', onData)
  })
}

/** The production publishable key is public: the live app carries it. */
export async function prodKey() {
  const html = await fetch(PROD_APP).then((response) => response.text())
  const script = html.match(/assets\/index-[^"]+\.js/)?.[0]
  const code = await fetch(`${PROD_APP}/${script}`).then((r) => r.text())
  const key = code.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
  if (!key) throw new Error('Não achei a chave pública da produção.')
  return key
}

function keep(file, refreshToken) {
  mkdirSync('scripts/data', { recursive: true })
  writeFileSync(file, JSON.stringify({ refresh_token: refreshToken }))
}

function kept(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).refresh_token ?? null
  } catch {
    return null
  }
}

/**
 * A client signed in as the owner: with the kept session when it still works,
 * otherwise with the e-mail and password. `samePassword` offers the password
 * just typed for the other environment.
 */
export async function signedIn({ url, key, label, name, samePassword }) {
  const file = `scripts/data/acesso-${name}.json`
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = kept(file)
  if (token) {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: token,
    })
    if (!error && data.session) {
      keep(file, data.session.refresh_token)
      return { client, userId: data.user.id, password: null }
    }
    console.log(`O acesso guardado ${label} acabou: entra de novo.`)
  }
  const email = env('AERARIUM_EMAIL') || (await ask('Seu e-mail: '))
  const password = samePassword
    ? (await askHidden(`Senha ${label} (Enter se for a mesma): `)) ||
      samePassword
    : await askHidden(`Senha ${label}: `)
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error || !data.session)
    throw new Error(`Não consegui entrar ${label}: ${error?.message ?? ''}`)
  keep(file, data.session.refresh_token)
  return { client, userId: data.user.id, password }
}
