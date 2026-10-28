// node scripts/ver-banco-prod.mjs
//
// Read only: signs in to production with YOUR login (typed here, never shown
// or saved) and asks the bank function if your account is the bank owner,
// printing the answer or the error. Nothing is written anywhere.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const PROD_URL = 'https://kpzupvajcjhjoarxjcvq.supabase.co'
const PROD_APP = 'https://aerarium-delta.vercel.app'

async function prodKey() {
  const html = await fetch(PROD_APP).then((response) => response.text())
  const script = html.match(/assets\/index-[^"]+\.js/)?.[0]
  const code = await fetch(`${PROD_APP}/${script}`).then((r) => r.text())
  return code.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
}

function askHidden(question) {
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

/** AERARIUM_EMAIL and AERARIUM_SENHA in .env.local spare the typing. */
function env(name) {
  const text = readFileSync('.env.local', 'utf8')
  const line = text.split(/\r?\n/).find((item) => item.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim() ?? ''
}

let email = env('AERARIUM_EMAIL')
if (!email) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  email = (await rl.question('Seu e-mail: ')).trim()
  rl.close()
}
const password =
  env('AERARIUM_SENHA') || (await askHidden('Senha da produção: '))

const db = createClient(PROD_URL, await prodKey(), {
  auth: { persistSession: false },
})
const login = await db.auth.signInWithPassword({ email, password })
console.log('\nEntrar:', login.error ? login.error.message : 'ok')
const { data, error } = await db.functions.invoke('bank', {
  body: { action: 'status' },
})
console.log('Resposta do banco:', JSON.stringify(data ?? null))
if (error) {
  console.log('Erro:', error.name, error.context?.status ?? '')
  const body = await error.context?.text?.().catch(() => '')
  if (body) console.log('Detalhe:', body.slice(0, 300))
}
await db.auth.signOut({ scope: 'local' })
