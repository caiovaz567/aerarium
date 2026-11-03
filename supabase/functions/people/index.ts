// The people who use someone's cards. The app cannot read other accounts: this
// checks the session and calls the private functions, always as that account.
//
//   {action: 'list'}                      the owner's list
//   {action: 'invitations'}               who invited this account
//   {action: 'add', username}             adds and invites by exact username
//   {action: 'answer', person, accept}    accepts, declines or leaves
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'npm:postgres@3.4.5'

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method' })

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'unauthorized' })
  const auth = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await auth.auth.getUser(token)
  const me = data.user?.id
  if (!me) return reply(401, { error: 'unauthorized' })

  const body = await request.json().catch(() => ({}))
  try {
    if (body?.action === 'list')
      return reply(200, {
        people: await sql`select * from private.my_people(${me}::uuid)`,
      })
    if (body?.action === 'invitations')
      return reply(200, {
        invitations:
          await sql`select * from private.my_invitations(${me}::uuid)`,
      })
    if (body?.action === 'add') {
      const username = body.username
      if (typeof username !== 'string' || username.length > 40)
        return reply(400, { error: 'input' })
      const [row] = await sql<{ result: string }[]>`
        select private.add_person(${me}::uuid, ${username}) as result`
      return reply(200, { result: row!.result })
    }
    if (body?.action === 'answer') {
      const { person, accept } = body
      if (
        typeof person !== 'string' ||
        !UUID.test(person) ||
        typeof accept !== 'boolean'
      )
        return reply(400, { error: 'input' })
      await sql`
        select private.answer_invitation(${me}::uuid, ${person}::uuid, ${accept})`
      return reply(200, { ok: true })
    }
    return reply(400, { error: 'action' })
  } catch (error) {
    console.error('people', (error as Error).message)
    return reply(502, { error: 'failed' })
  }
})
