// Fase 14.3: the daily email at 9h, only for the Open Finance owner
// (PLUGGY_OWNER_USER_ID). It reads the bank (Meu Pluggy) and emails what is
// new, card by card, through Resend. It never writes purchases: the app still
// imports them when opened ("Chegou do banco").
//
//   {action: 'setup'}  the owner's session, when the switch in Ajustes is
//                      turned on: saves where this function is and a secret
//                      for the daily job (private.daily_email), turns the
//                      email on and sends a first one right away.
//   {action: 'send'}   the daily job (pg_cron, 12:00 UTC = 9h in São Paulo),
//                      with the header x-daily-email: that secret.
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.5'
import {
  emailGroups,
  renderEmail,
  type EmailCard,
  type EmailCategory,
  type EmailTransaction,
} from '../_shared/dailyEmail.ts'

const PLUGGY = 'https://api.pluggy.ai'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const env = (name: string) => Deno.env.get(name) ?? ''
const sql = postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 1 })

async function pluggy<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${PLUGGY}${path}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!response.ok)
    throw new Error(`Pluggy ${path.split('?')[0]}: ${response.status}`)
  return (await response.json()) as T
}

type Account = { id: string; type: string }
type Transaction = {
  id: string
  description: string
  amount: number
  date: string
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    totalAmount?: number | null
  } | null
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Before the daily email: asks Pluggy to look at the bank now and waits (up
 * to 40 s: the daily job gives the whole function 60 s) until it is done, so
 * the email has yesterday's purchases instead of whatever Pluggy's own daily
 * look had. Never fails the email: when it
 * cannot ask (too soon, not allowed), the email goes with what there is.
 */
async function askBank(apiKey: string, items: readonly string[]) {
  try {
    let asked = false
    for (const itemId of items) {
      const response = await fetch(`${PLUGGY}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: '{}',
      })
      asked ||= response.ok
    }
    if (!asked) return
    for (let turn = 0; turn < 8; turn++) {
      await wait(5000)
      const states = await Promise.all(
        items.map((itemId) =>
          pluggy<{ status: string }>(apiKey, `/items/${itemId}`),
        ),
      )
      if (states.every((item) => item.status !== 'UPDATING')) return
    }
  } catch (error) {
    console.error('daily-email ask', (error as Error).message)
  }
}

/** The credit card transactions of the owner's items since `from`. */
async function bankTransactions(
  from: string,
  fresh: boolean,
): Promise<EmailTransaction[]> {
  const { apiKey } = await fetch(`${PLUGGY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env('PLUGGY_CLIENT_ID'),
      clientSecret: env('PLUGGY_CLIENT_SECRET'),
    }),
  }).then((response) => {
    if (!response.ok) throw new Error(`Pluggy auth: ${response.status}`)
    return response.json() as Promise<{ apiKey: string }>
  })
  const items = env('PLUGGY_ITEM_IDS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (fresh) await askBank(apiKey, items)
  const result: EmailTransaction[] = []
  for (const itemId of items) {
    const accounts = (
      await pluggy<{ results: Account[] }>(apiKey, `/accounts?itemId=${itemId}`)
    ).results.filter((account) => account.type === 'CREDIT')
    for (const account of accounts) {
      let query = `?accountId=${account.id}&dateFrom=${from}`
      for (let guard = 0; guard < 50; guard++) {
        const page = await pluggy<{
          results: Transaction[]
          next?: string | null
        }>(apiKey, `/v2/transactions${query}`)
        for (const item of page.results)
          result.push({
            id: item.id,
            accountId: account.id,
            description: item.description,
            amount: item.amount,
            date: item.date,
            installmentNumber:
              item.creditCardMetadata?.installmentNumber ?? null,
            totalInstallments:
              item.creditCardMetadata?.totalInstallments ?? null,
            totalAmount: item.creditCardMetadata?.totalAmount ?? null,
          })
        if (!page.next) break
        query = page.next.includes('?')
          ? page.next.slice(page.next.indexOf('?'))
          : `?${page.next}`
      }
    }
  }
  return result
}

const daysAgo = (days: number) =>
  new Date(Date.now() - 3 * 3600_000 - days * 86_400_000)
    .toISOString()
    .slice(0, 10)

/** Builds and sends the owner's email; how many purchases it told about. */
async function sendFor(owner: string, test: boolean): Promise<number> {
  const [user] = await sql<{ email: string | null }[]>`
    select email from auth.users where id = ${owner}`
  if (!user?.email) throw new Error('no email')

  const [start] = await sql<{ external_id: string }[]>`
    select external_id from public.bank_records
    where user_id = ${owner} and external_id like 'start:%' limit 1`
  const recent = daysAgo(test ? 3 : 7)
  const startDay = start?.external_id.slice(6) ?? recent
  const from = startDay > recent ? startDay : recent

  const cards = (
    await sql<{ account: string; name: string; bank: string | null }[]>`
      select a.pluggy_account_id as account, c.name, c.bank
      from public.bank_accounts a
      join public.cards c on c.id = a.card_id and c.user_id = a.user_id
      where a.user_id = ${owner}
      order by c.sort_order, c.name`
  ).map((row): EmailCard => ({
    accountId: row.account,
    name: row.name,
    bank: row.bank && row.bank !== 'none' ? row.bank : null,
  }))
  const categories = new Map<string, EmailCategory>(
    (
      await sql<{ key: string; name: string; color: string }[]>`
        select distinct on (lower(trim(e.description)))
          lower(trim(e.description)) as key, c.name, c.color
        from public.invoice_expenses e
        join public.categories c on c.id = e.category_id and c.user_id = e.user_id
        where e.user_id = ${owner}
        order by lower(trim(e.description)), e.created_at desc`
    ).map((row) => [row.key, { name: row.name, color: row.color }]),
  )
  const sent = new Set(
    (
      await sql<{ external_id: string }[]>`
        select external_id from private.emailed_transactions
        where user_id = ${owner}`
    ).map((row) => row.external_id),
  )

  const now = new Date().toISOString()
  const groups = emailGroups({
    transactions: await bankTransactions(from, !test),
    cards,
    sent,
    from,
    now,
    categories,
  })
  if (!groups.length && !test) return 0

  const [settings] = await sql<{ other_person: string | null }[]>`
    select other_person from public.user_settings where user_id = ${owner}`
  const { subject, html } = renderEmail({
    groups,
    now,
    otherPerson: settings?.other_person ?? null,
    appUrl: env('APP_URL') || 'https://aerarium-delta.vercel.app',
    test,
  })
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Aerarium <onboarding@resend.dev>',
      to: [user.email],
      subject,
      html,
    }),
  })
  if (!response.ok) throw new Error(`Resend: ${response.status}`)

  const ids = groups.flatMap((group) => group.items.map((item) => item.id))
  if (ids.length)
    await sql`
      insert into private.emailed_transactions ${sql(
        ids.map((id) => ({ user_id: owner, external_id: id })),
      )}
      on conflict do nothing`
  await sql`
    delete from private.emailed_transactions
    where user_id = ${owner} and sent_at < now() - interval '90 days'`
  return ids.length
}

/** Same length and every character equal, without stopping early. */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++)
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method' })
  const owner = env('PLUGGY_OWNER_USER_ID')
  if (!owner || !env('RESEND_API_KEY'))
    return reply(403, { error: 'not-enabled' })
  const body = await request.json().catch(() => ({}))

  try {
    if (body?.action === 'setup') {
      const token = request.headers
        .get('Authorization')
        ?.replace(/^Bearer\s+/i, '')
      if (!token) return reply(401, { error: 'unauthorized' })
      const auth = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data } = await auth.auth.getUser(token)
      if (data.user?.id !== owner) return reply(403, { error: 'not-enabled' })
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      await sql`
        insert into private.daily_email (id, url, secret)
        values (1, ${`${env('SUPABASE_URL')}/functions/v1/daily-email`}, ${secret})
        on conflict (id) do update set url = excluded.url`
      await sql`
        insert into public.user_settings (user_id, daily_email)
        values (${owner}, true)
        on conflict (user_id) do update set daily_email = true, updated_at = now()`
      return reply(200, { sent: await sendFor(owner, true) })
    }

    if (body?.action === 'send') {
      const [config] = await sql<{ secret: string }[]>`
        select secret from private.daily_email where id = 1`
      const given = request.headers.get('x-daily-email') ?? ''
      if (!config || !sameSecret(given, config.secret))
        return reply(401, { error: 'unauthorized' })
      const [settings] = await sql<{ daily_email: boolean }[]>`
        select daily_email from public.user_settings where user_id = ${owner}`
      if (!settings?.daily_email) return reply(200, { sent: 0 })
      return reply(200, { sent: await sendFor(owner, false) })
    }
    return reply(400, { error: 'action' })
  } catch (error) {
    console.error('daily-email', (error as Error).message)
    // Only the step and the status: never a key, an address or a body.
    return reply(502, { error: 'failed', step: (error as Error).message })
  }
})
