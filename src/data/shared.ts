import type { Category } from '../domain/categories'
import { fromDecimal, type Cents } from '../domain/money'
import { isoDate, month, type ISODate, type Month } from '../domain/months'
import { supabase } from './supabase'

/**
 * What an owner shows the other person who uses their cards (read only):
 * what was marked theirs, the cards with a Pix key to pay back, and what was
 * already paid back. From public.shared_with_me() (the other person) or
 * public.my_shared_preview() (the owner, to see it as they do).
 */
export interface SharedView {
  readonly ownerName: string
  /** One Pix key to pay it all back, and the bank it is at. */
  readonly pixKey: string | null
  readonly pixBank: string | null
  readonly cards: readonly {
    readonly id: string
    readonly name: string
    readonly color: string | null
    readonly bank: string | null
    readonly sortOrder: number
  }[]
  readonly expenses: readonly {
    readonly id: string
    readonly cardId: string
    readonly month: Month
    readonly description: string
    readonly note: string | null
    readonly amount: Cents
    readonly spentOn: ISODate
    readonly occurredAt: string | null
    readonly categoryId: string | null
  }[]
  readonly plans: readonly {
    readonly id: string
    readonly cardId: string | null
    readonly description: string
    readonly installmentAmount: Cents
    readonly finalAdjustment: Cents
    readonly totalInstallments: number
    readonly firstMonth: Month
    readonly categoryId: string | null
  }[]
  /** Old months: their part of the bank's invoice that is not itemized. */
  readonly rests: readonly {
    readonly cardId: string
    readonly month: Month
    readonly amount: Cents
  }[]
  readonly categories: readonly Category[]
  readonly paidBack: readonly {
    readonly month: Month
    readonly amount: Cents
  }[]
}

type Raw = Record<string, unknown>
const list = (value: unknown) => (Array.isArray(value) ? (value as Raw[]) : [])
const text = (value: unknown) => String(value)
const orNull = (value: unknown) => (value == null ? null : String(value))

/** The JSON from the database, checked into typed values. */
export function parseShared(raw: unknown): SharedView {
  const view = raw as Raw
  return {
    ownerName: text(view.ownerName),
    pixKey: orNull(view.pixKey),
    pixBank: orNull(view.pixBank),
    cards: list(view.cards).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      color: orNull(row.color),
      bank: orNull(row.bank),
      sortOrder: Number(row.sortOrder ?? 0),
    })),
    expenses: list(view.expenses).map((row) => ({
      id: text(row.id),
      cardId: text(row.cardId),
      month: month(text(row.month)),
      description: text(row.description),
      note: orNull(row.note),
      amount: fromDecimal(text(row.amount)),
      spentOn: isoDate(text(row.spentOn)),
      occurredAt: orNull(row.occurredAt),
      categoryId: orNull(row.categoryId),
    })),
    plans: list(view.plans).map((row) => ({
      id: text(row.id),
      cardId: orNull(row.cardId),
      description: text(row.description),
      installmentAmount: fromDecimal(text(row.installmentAmount)),
      finalAdjustment: fromDecimal(text(row.finalAdjustment)),
      totalInstallments: Number(row.totalInstallments),
      firstMonth: month(text(row.firstMonth)),
      categoryId: orNull(row.categoryId),
    })),
    rests: list(view.rests).map((row) => ({
      cardId: text(row.cardId),
      month: month(text(row.month)),
      amount: fromDecimal(text(row.amount)),
    })),
    categories: list(view.categories).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      color: text(row.color),
      icon: text(row.icon),
      sortOrder: Number(row.sortOrder ?? 0),
    })),
    paidBack: list(view.paidBack).map((row) => ({
      month: month(text(row.month)),
      amount: fromDecimal(text(row.amount)),
    })),
  }
}

/** The other person: the owners who share with them (usually none or one). */
export async function loadSharedWithMe(userId: string): Promise<SharedView[]> {
  const { data, error } = await supabase()
    .from('shares')
    .select('owner_name,pix_key,pix_bank,data')
    .eq('viewer_id', userId)
  if (error) throw error
  return list(data).map((row) =>
    parseShared({
      ...((row.data as Raw | null) ?? {}),
      ownerName: row.owner_name,
      pixKey: row.pix_key,
      pixBank: row.pix_bank,
    }),
  )
}

export interface ShareRow {
  readonly viewerEmail: string
  readonly ownerName: string
  readonly pixKey: string | null
  readonly pixBank: string | null
  /** The copy the other person reads (shares.data). */
  readonly data: unknown
}

/** The owner's shares (whom they share with). */
export async function loadMyShares(userId: string): Promise<ShareRow[]> {
  const { data, error } = await supabase()
    .from('shares')
    .select('viewer_email,owner_name,pix_key,pix_bank,data')
    .eq('owner_id', userId)
  if (error) throw error
  return list(data).map((row) => ({
    viewerEmail: text(row.viewer_email),
    ownerName: text(row.owner_name),
    pixKey: orNull(row.pix_key),
    pixBank: orNull(row.pix_bank),
    data: row.data ?? {},
  }))
}

/**
 * Shares (or updates the share) through the Edge Function `share`, which finds
 * the account by e-mail. False when no Aerarium account has that e-mail.
 */
export async function shareWith(share: {
  readonly email: string
  readonly ownerName: string
  readonly pixKey: string
  readonly pixBank: string
}): Promise<boolean> {
  const { data, error } = await supabase().functions.invoke('share', {
    body: share,
  })
  if (error) throw error
  return data?.found === true
}

/** The owner writes what the other person sees (only their part). */
export async function saveShareData(userId: string, data: unknown) {
  const { error } = await supabase()
    .from('shares')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('owner_id', userId)
  if (error) throw error
}

export async function stopSharing(userId: string, email: string) {
  const { error } = await supabase()
    .from('shares')
    .delete()
    .eq('owner_id', userId)
    .eq('viewer_email', email)
  if (error) throw error
}
