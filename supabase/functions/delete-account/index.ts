// Seção 5.6: deletes the account of whoever calls it. The database removes
// every row of that user by cascade (checked in supabase/tests/phase1.sql).
// The admin key exists only here, on the server; never in the front.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Injected by Supabase: the legacy service_role key or the new secret keys. */
function adminKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
  const key = keys.default ?? Object.values(keys)[0]
  if (typeof key !== 'string') throw new Error('Admin key missing.')
  return key
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'method' })

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'unauthorized' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // The user comes from their own session token, never from the request body.
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return reply(401, { error: 'unauthorized' })

  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== 'APAGAR') return reply(400, { error: 'confirm' })

  const removed = await admin.auth.admin.deleteUser(data.user.id)
  if (removed.error) {
    console.error('delete-account', removed.error.message)
    return reply(500, { error: 'delete' })
  }
  return reply(200, { deleted: true })
})
