import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Only the publishable key belongs in the browser; RLS protects the data. */
export function supabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    string | undefined
  if (!url || !key)
    throw new Error(
      'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local.',
    )
  if (!key.startsWith('sb_publishable_'))
    throw new Error('Use a chave pública sb_publishable_ no front.')
  client = createClient(url, key, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
