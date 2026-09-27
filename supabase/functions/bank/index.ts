// Open Finance through Meu Pluggy (personal use, free). A thin, read-only
// proxy: it answers only the app's owner (PLUGGY_OWNER_USER_ID), keeps the
// Pluggy keys on the server and returns the credit card accounts, their
// transactions and bills. What to do with them is decided in the app
// (src/domain/bank.ts), which writes through RLS like any other change.
import { createClient } from 'npm:@supabase/supabase-js@2'

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

async function pluggy<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${PLUGGY}${path}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (!response.ok)
    throw new Error(`Pluggy ${path.split('?')[0]}: ${response.status}`)
  return (await response.json()) as T
}

type Paged<T> = { results: T[] }

/**
 * Transactions with the cursor pagination (GET /v2/transactions; the page
 * based listing answers 410 for accounts created since June 2026). `next` is
 * a query string ready to use.
 */
async function transactions<T>(
  apiKey: string,
  accountId: string,
  from: string | null,
): Promise<T[]> {
  const items: T[] = []
  let query = `?accountId=${accountId}${from ? `&dateFrom=${from}` : ''}`
  for (let guard = 0; guard < 200; guard++) {
    const data = await pluggy<{ results: T[]; next?: string | null }>(
      apiKey,
      `/v2/transactions${query}`,
    )
    items.push(...data.results)
    if (!data.next) return items
    const next = data.next.includes('?')
      ? data.next.slice(data.next.indexOf('?'))
      : `?${data.next}`
    query = next
  }
  return items
}

type Account = {
  id: string
  itemId: string
  type: string
  subtype: string
  name: string
  marketingName?: string | null
  number?: string | null
  balance?: number | null
  creditData?: {
    balanceCloseDate?: string | null
    balanceDueDate?: string | null
  } | null
}
type Transaction = {
  id: string
  accountId: string
  description: string
  amount: number
  date: string
  status?: string
  creditCardMetadata?: {
    installmentNumber?: number | null
    totalInstallments?: number | null
    totalAmount?: number | null
    billId?: string | null
  } | null
}
type Bill = { id: string; dueDate: string; totalAmount: number }
type Item = { id: string; status: string; lastUpdatedAt?: string | null }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method' })

  // Who is asking comes from their own session token.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'unauthorized' })
  const auth = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: user } = await auth.auth.getUser(token)
  if (!user.user) return reply(401, { error: 'unauthorized' })

  const owner = env('PLUGGY_OWNER_USER_ID')
  const items = env('PLUGGY_ITEM_IDS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const enabled =
    Boolean(owner) &&
    user.user.id === owner &&
    items.length > 0 &&
    Boolean(env('PLUGGY_CLIENT_ID') && env('PLUGGY_CLIENT_SECRET'))

  const body = await request.json().catch(() => ({}))
  if (body?.action === 'status') return reply(200, { enabled })
  if (!enabled) return reply(403, { error: 'not-enabled' })
  if (body?.action !== 'fetch') return reply(400, { error: 'action' })

  const from =
    typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
      ? body.from
      : null

  try {
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

    const result = {
      items: [] as {
        id: string
        status: string
        lastUpdatedAt: string | null
      }[],
      accounts: [] as {
        id: string
        itemId: string
        name: string
        number: string | null
        closeDate: string | null
        dueDate: string | null
      }[],
      transactions: [] as {
        id: string
        accountId: string
        description: string
        amount: number
        date: string
        pending: boolean
        installmentNumber: number | null
        totalInstallments: number | null
        totalAmount: number | null
        billId: string | null
      }[],
      bills: [] as {
        id: string
        accountId: string
        dueDate: string
        totalAmount: number
      }[],
    }

    for (const itemId of items) {
      const item = await pluggy<Item>(apiKey, `/items/${itemId}`)
      result.items.push({
        id: item.id,
        status: item.status,
        lastUpdatedAt: item.lastUpdatedAt ?? null,
      })
      const accounts = (
        await pluggy<Paged<Account>>(apiKey, `/accounts?itemId=${itemId}`)
      ).results.filter((account) => account.type === 'CREDIT')
      for (const account of accounts) {
        result.accounts.push({
          id: account.id,
          itemId,
          name: account.marketingName || account.name,
          number: account.number ?? null,
          closeDate: account.creditData?.balanceCloseDate ?? null,
          dueDate: account.creditData?.balanceDueDate ?? null,
        })
        for (const transaction of await transactions<Transaction>(
          apiKey,
          account.id,
          from,
        ))
          result.transactions.push({
            id: transaction.id,
            accountId: account.id,
            description: transaction.description,
            amount: transaction.amount,
            date: transaction.date,
            pending: transaction.status === 'PENDING',
            installmentNumber:
              transaction.creditCardMetadata?.installmentNumber ?? null,
            totalInstallments:
              transaction.creditCardMetadata?.totalInstallments ?? null,
            totalAmount: transaction.creditCardMetadata?.totalAmount ?? null,
            billId: transaction.creditCardMetadata?.billId ?? null,
          })
        // Bills only exist for some institutions; none is not an error.
        const bills = await pluggy<Paged<Bill>>(
          apiKey,
          `/bills?accountId=${account.id}`,
        ).catch(() => ({ results: [] as Bill[] }))
        for (const bill of bills.results)
          result.bills.push({
            id: bill.id,
            accountId: account.id,
            dueDate: bill.dueDate,
            totalAmount: bill.totalAmount,
          })
      }
    }
    return reply(200, result)
  } catch (error) {
    console.error('bank', (error as Error).message)
    // Only the step and the HTTP status: never a key or a body.
    return reply(502, { error: 'pluggy', step: (error as Error).message })
  }
})
