// One command instead of four to apply new migrations and server functions.
//   npm run db:dev   → development: db push, functions, then the SQL tests.
//   npm run db:prod  → production: link, show what changes, ask, push, ask to
//                      publish the functions, and always link back to
//                      development (even on errors).
// Production is run by the owner only (AGENTS.md).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const PROD = 'kpzupvajcjhjoarxjcvq'
const DEV = JSON.parse(
  readFileSync('supabase/development.json', 'utf8'),
).projectRef

const FUNCTIONS = ['bank', 'delete-account', 'daily-email', 'share']

// Fixed arguments only, so one command line is safe (and Windows needs it).
const run = (args, options = {}) => {
  const result = spawnSync(`npx supabase ${args.join(' ')}`, {
    stdio: options.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    shell: true,
  })
  if (result.status !== 0) throw new Error(`Falhou: supabase ${args.join(' ')}`)
  return result.stdout ?? ''
}
const linked = () => readFileSync('supabase/.temp/project-ref', 'utf8').trim()

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return /^s(im)?$/i.test(answer.trim())
}

const deploy = (ref) => {
  for (const name of FUNCTIONS)
    run(['functions', 'deploy', name, '--project-ref', ref, '--use-api'])
}

const target = process.argv[2]

if (target === 'dev') {
  if (linked() !== DEV)
    throw new Error(`O terminal não está ligado ao desenvolvimento (${DEV}).`)
  run(['db', 'push', '--agent', 'yes'])
  deploy(DEV)
  const test = spawnSync('node', ['scripts/database.mjs', 'test'], {
    stdio: 'inherit',
  })
  process.exit(test.status ?? 1)
} else if (target === 'prod') {
  try {
    console.log('\nLigando na PRODUÇÃO...')
    run(['link', '--project-ref', PROD])
    const plan = run(['db', 'push', '--dry-run', '--agent', 'yes'], {
      capture: true,
    })
    // With --agent yes the CLI answers in JSON: {"migrations": [...]}.
    const reply = plan.trim().split('\n').pop() ?? '{}'
    const files = /** @type {string[]} */ (JSON.parse(reply).migrations ?? [])
    if (!files.length) {
      console.log('\nA produção já está em dia. Nada pra aplicar.')
    } else {
      console.log('\nVai aplicar na produção:')
      for (const file of files) console.log(`  • ${file}`)
      if (await ask('\nAplicar? (s/n) ')) {
        run(['db', 'push', '--agent', 'yes'])
        console.log('\nPronto: a produção está em dia.')
      } else console.log('\nNada foi aplicado.')
    }
    if (await ask('\nPublicar também as funções do servidor? (s/n) ')) {
      deploy(PROD)
      console.log('\nPronto: funções publicadas.')
    }
  } finally {
    console.log('\nVoltando pro desenvolvimento...')
    run(['link', '--project-ref', DEV])
  }
} else {
  console.log('Use: npm run db:dev  ou  npm run db:prod')
  process.exit(1)
}
