import type { User } from '@supabase/supabase-js'
import { dateInSaoPaulo } from '../domain/months'
import { supabase } from './supabase'

/** Every table with the user's data (seção 5.2). RLS limits reads to the user. */
export const ACCOUNT_TABLES = [
  'cards',
  'months',
  'incomes',
  'bills',
  'invoices',
  'invoice_expenses',
  'installment_plans',
  'installment_payments',
  'subscriptions',
  'categories',
] as const

type Rows = Record<string, unknown>[]
export type AccountTables = Record<(typeof ACCOUNT_TABLES)[number], Rows>

/** PostgREST returns at most 1000 rows per request. */
const PAGE = 1000

async function readTable(table: string): Promise<Rows> {
  const rows: Rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data as Rows))
    if (data.length < PAGE) return rows
  }
}

/** Seção 5.6: the JSON of "Baixar meus dados", exactly as stored. */
export function buildExport(user: User, tables: AccountTables, now: Date) {
  return {
    app: 'Aerarium',
    exportedAt: now.toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      signIn: (user.identities ?? []).map((identity) => identity.provider),
    },
    ...tables,
  }
}

export const exportFileName = (now: Date) =>
  `Aerarium_dados_${dateInSaoPaulo(now)}.json`

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the file after click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadMyData(user: User, now = new Date()) {
  const entries = await Promise.all(
    ACCOUNT_TABLES.map(async (table) => [table, await readTable(table)]),
  )
  const data = buildExport(
    user,
    Object.fromEntries(entries) as AccountTables,
    now,
  )
  saveFile(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    exportFileName(now),
  )
}

/** The word typed to confirm; case does not matter (iPhone capitalizes it). */
export const DELETE_WORD = 'APAGAR'
export const confirmsDelete = (typed: string) =>
  typed.trim().toUpperCase() === DELETE_WORD

/**
 * Seção 5.6: the Edge Function deletes the auth user and the database removes
 * the rest by cascade. Only the server may delete users.
 */
export async function deleteMyAccount() {
  const { error } = await supabase().functions.invoke('delete-account', {
    body: { confirm: DELETE_WORD },
  })
  if (error)
    throw new Error(
      'Não consegui apagar a conta. Confere a internet e tenta de novo.',
    )
  // The session died with the account; just forget it on this device.
  await supabase().auth.signOut({ scope: 'local' })
}
