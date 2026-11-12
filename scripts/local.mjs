// Runs the app against a Supabase on this computer (Docker), with fictitious
// data: nothing in the cloud is read or changed. The first run downloads the
// Supabase images and fills a demo account; `npm run local -- --novos-dados`
// wipes and refills it.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

// The app uses the database, sign-in and functions only.
const SKIP = 'realtime,storage-api,imgproxy,vector,logflare,supavisor'
const ENV_FILE = '.env.offline.local'
const EMAIL = 'aerarium.demo@example.test'
// A local, fictitious account: this password opens nothing outside this computer.
const PASSWORD = 'aerarium-local'

// One command line (the arguments here are fixed, nothing typed by anyone).
const line = (command, args) => [command, ...args].join(' ')
const run = (command, args, options = {}) =>
  spawnSync(line(command, args), { encoding: 'utf8', shell: true, ...options })
const free = (port) =>
  new Promise((done) => {
    const server = createServer()
    server.once('error', () => done(false))
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)))
  })
const dockerUp = () => run('docker', ['info']).status === 0
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

if (!dockerUp()) {
  const paths = [
    join(homedir(), 'AppData/Local/Programs/DockerDesktop/Docker Desktop.exe'),
    'C:/Program Files/Docker/Docker/Docker Desktop.exe',
  ]
  const exe = paths.find((path) => existsSync(path))
  if (!exe) {
    console.error('Docker Desktop não encontrado. Instale e rode de novo.')
    process.exit(1)
  }
  console.log('Abrindo o Docker Desktop…')
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 40 && !dockerUp(); i++) await wait(3000)
  if (!dockerUp()) {
    console.error('O Docker não ligou. Abra o Docker Desktop e rode de novo.')
    process.exit(1)
  }
}

const status = () => {
  const result = run('npx', ['supabase', 'status', '-o', 'env'])
  if (result.status !== 0) return null
  return Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  )
}

let env = status()
if (!env?.API_URL) {
  console.log('Ligando o Supabase local (a primeira vez demora)…')
  const started = run('npx', ['supabase', 'start', '-x', SKIP], {
    stdio: 'inherit',
  })
  if (started.status !== 0) process.exit(started.status ?? 1)
  env = status()
}
const url = env?.API_URL
const publishable = env?.PUBLISHABLE_KEY || env?.ANON_KEY
const secret = env?.SECRET_KEY || env?.SERVICE_ROLE_KEY
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('O Supabase local não respondeu. Rode: npx supabase status')
  process.exit(1)
}

// Only the app's address and public key; the secret key stays in this script.
writeFileSync(
  ENV_FILE,
  [
    '# Written by npm run local: the Supabase on this computer.',
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
    `E2E_PASSWORD=${PASSWORD}`,
    '',
  ].join('\n'),
)

// The demo account: created once, filled when it is new or when asked.
const created = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  }),
})
if (created.ok || process.argv.includes('--novos-dados')) {
  console.log('Preenchendo a conta de demonstração…')
  const filled = run('npx', ['tsx', 'scripts/demo-data.ts'], {
    stdio: 'inherit',
    env: { ...process.env, DEMO_ENV_FILE: ENV_FILE },
  })
  if (filled.status !== 0) process.exit(filled.status ?? 1)
}

// The functions (people, share…) run here too, quietly.
const functions = spawn(line('npx', ['supabase', 'functions', 'serve']), {
  shell: true,
  stdio: 'ignore',
})
// 5173 is the usual one; when another "npm run dev" holds it, the next one.
const port = (await free(5173)) ? 5173 : 5174
const app = spawn(
  line('npx', [
    'vite',
    '--host',
    '127.0.0.1',
    '--port',
    port,
    '--mode',
    'offline',
  ]),
  { shell: true, stdio: 'inherit' },
)
console.log(`
  Aerarium local: http://127.0.0.1:${port}
  Entrar com ${EMAIL} e a senha ${PASSWORD}
  Ver o banco: http://127.0.0.1:54323
  Pra desligar o banco: npx supabase stop
`)
const stop = () => {
  functions.kill()
  app.kill()
}
process.on('SIGINT', stop)
app.on('exit', (code) => {
  functions.kill()
  process.exit(code ?? 0)
})
