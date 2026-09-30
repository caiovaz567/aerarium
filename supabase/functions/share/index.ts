// Sharing the cards with the other person's own Aerarium account. Only an
// owner with someone else using the cards (user_settings.other_person) can
// share, and only with an account that exists: this finds it by e-mail (the
// app cannot read other accounts) and creates or updates public.shares. What
// the other person sees is written later by the owner's app, through RLS.
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

const clean = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim().length <= max ? value.trim() : null

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
  const email = clean(body?.email, 320)?.toLowerCase() ?? ''
  const ownerName = clean(body?.ownerName, 30) ?? ''
  const pixKey = clean(body?.pixKey, 140) || null
  const pixBank = clean(body?.pixBank, 30) || null
  if (!/^\S+@\S+\.\S+$/.test(email) || !ownerName)
    return reply(400, { error: 'input' })
  if (pixBank && !/^[a-z0-9-]{1,30}$/.test(pixBank))
    return reply(400, { error: 'input' })

  try {
    const [settings] = await sql<{ other_person: string | null }[]>`
      select other_person from public.user_settings where user_id = ${me}`
    if (!settings?.other_person) return reply(403, { error: 'not-enabled' })
    const [viewer] = await sql<{ id: string }[]>`
      select id from auth.users where lower(email) = ${email} limit 1`
    if (!viewer || viewer.id === me) return reply(200, { found: false })
    await sql`
      insert into public.shares
        (owner_id, viewer_id, viewer_email, owner_name, pix_key, pix_bank)
      values (${me}, ${viewer.id}, ${email}, ${ownerName}, ${pixKey}, ${pixBank})
      on conflict (owner_id, viewer_id) do update set
        viewer_email = excluded.viewer_email,
        owner_name = excluded.owner_name,
        pix_key = excluded.pix_key,
        pix_bank = excluded.pix_bank`
    return reply(200, { found: true })
  } catch (error) {
    console.error('share', (error as Error).message)
    return reply(502, { error: 'failed' })
  }
})
