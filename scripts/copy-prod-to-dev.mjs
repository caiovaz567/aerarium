// npm run dev:copiar-prod
//
// Copies YOUR data from production into YOUR account in development, so the
// app can be tried locally with real numbers. Production is only read (with
// your own login, through RLS, like the app). Development: your data there is
// replaced by the copy. Login: scripts/login.mjs (asked once, then kept).
// A copy of what was read is saved in scripts/data/ (outside Git).
//
// Left out on purpose: sharing with another account (it points to production
// users) and the daily email (off in development).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ask, env, PROD_URL, prodKey, signedIn } from './login.mjs'
const DEV_REF = JSON.parse(
  readFileSync('supabase/development.json', 'utf8'),
).projectRef

// Parents before children, so every foreign key finds its row.
const TABLES = [
  'categories',
  'cards',
  'months',
  'incomes',
  'bills',
  'invoices',
  'invoice_expenses',
  'installment_plans',
  'installment_payments',
  'subscriptions',
  'bank_accounts',
  'bank_records',
  'user_settings',
]

async function readAll(client, table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + 999)
    if (error) throw new Error(`Lendo ${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

/** Without the production owner: development fills in who is signed in. */
const withoutOwner = (row) => {
  const copy = { ...row }
  delete copy.user_id
  return copy
}

async function insert(client, table, rows) {
  for (let from = 0; from < rows.length; from += 500) {
    const { error } = await client
      .from(table)
      .insert(rows.slice(from, from + 500))
    if (error) throw new Error(`Gravando ${table}: ${error.message}`)
  }
}

async function main() {
  const devUrl = env('VITE_SUPABASE_URL')
  const devKey = env('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!devUrl.includes(DEV_REF))
    throw new Error(`O .env.local não aponta pro desenvolvimento (${DEV_REF}).`)

  console.log('\nCopiar seus dados da PRODUÇÃO pro DESENVOLVIMENTO.')
  console.log(
    'A produção só é lida. No desenvolvimento, seus dados são trocados.\n',
  )
  const prod = await signedIn({
    url: PROD_URL,
    key: await prodKey(),
    label: 'da produção',
    name: 'prod',
  })

  const copy = {}
  for (const table of TABLES) copy[table] = await readAll(prod.client, table)
  mkdirSync('scripts/data', { recursive: true })
  const file = `scripts/data/prod-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify(copy, null, 2))
  console.log(`\nLido da produção (cópia em ${file}):`)
  for (const table of TABLES) console.log(`  ${table}: ${copy[table].length}`)

  const dev = await signedIn({
    url: devUrl,
    key: devKey,
    label: 'do desenvolvimento',
    name: 'dev',
    samePassword: prod.password,
  })
  const sure = await ask(
    '\nApagar seus dados do DESENVOLVIMENTO e colocar a cópia? (s/n) ',
  )
  if (!/^s(im)?$/i.test(sure)) {
    console.log('Nada foi mudado.')
    return
  }

  const db = dev.client
  // Children first, then parents (cascades clean the rest).
  for (const table of [
    'shares',
    'user_settings',
    'bank_records',
    'bank_accounts',
    'subscriptions',
    'installment_plans',
    'months',
    'cards',
    'categories',
  ]) {
    const column = table === 'shares' ? 'owner_id' : 'user_id'
    const { error } = await db.from(table).delete().eq(column, dev.userId)
    if (error) throw new Error(`Limpando ${table}: ${error.message}`)
  }

  const rows = (table) => copy[table].map(withoutOwner)
  await insert(db, 'categories', rows('categories'))
  await insert(db, 'cards', rows('cards'))
  await insert(db, 'months', rows('months'))
  await insert(db, 'incomes', rows('incomes'))
  await insert(db, 'bills', rows('bills'))
  // Invoices go in open; the paid ones are marked after their contents exist.
  await insert(
    db,
    'invoices',
    rows('invoices').map((row) => ({
      ...row,
      paid: false,
      paid_on: null,
      closed_total: null,
    })),
  )
  await insert(db, 'invoice_expenses', rows('invoice_expenses'))
  await insert(db, 'installment_plans', rows('installment_plans'))
  // Payments made by paying an invoice come back when it is marked paid
  // below (the database only takes them from a paid invoice).
  await insert(
    db,
    'installment_payments',
    rows('installment_payments').filter((row) => row.source !== 'invoice'),
  )
  await insert(db, 'subscriptions', rows('subscriptions'))
  for (const invoice of copy.invoices.filter((row) => row.paid)) {
    const { error } = await db
      .from('invoices')
      .update({ paid: true, paid_on: invoice.paid_on })
      .eq('id', invoice.id)
    if (error) throw new Error(`Marcando fatura paga: ${error.message}`)
  }
  await insert(db, 'bank_accounts', rows('bank_accounts'))
  await insert(db, 'bank_records', rows('bank_records'))
  await insert(
    db,
    'user_settings',
    rows('user_settings').map((row) => ({ ...row, daily_email: false })),
  )
  console.log('\nPronto: o desenvolvimento tem a cópia dos seus dados.')
  console.log('Rode npm run dev e entre com o mesmo e-mail.\n')
}

main().catch((error) => {
  console.error(`\n${error.message}\n`)
  process.exit(1)
})
