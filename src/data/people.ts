import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useUserId } from './useFinance'

export interface Person {
  readonly id: string
  readonly name: string
  /** The linked account's username; null when it is only a name. */
  readonly username: string | null
  readonly accepted: boolean
}

export interface Invitation {
  readonly personId: string
  /** "@caio", their Google name, or a masked e-mail. */
  readonly fromName: string
  readonly accepted: boolean
}

export type AddResult = 'ok' | 'not-found' | 'self' | 'already'

export async function loadUsername(): Promise<string | null> {
  const { data, error } = await supabase().from('usernames').select('username')
  if (error) throw error
  return (data as { username: string }[])[0]?.username ?? null
}

/** False when someone else already has that username. */
export async function saveUsername(userId: string, username: string) {
  const { error } = await supabase()
    .from('usernames')
    .upsert({ user_id: userId, username }, { onConflict: 'user_id' })
  if ((error as { code?: string } | null)?.code === '23505') return false
  if (error) throw error
  return true
}

async function people<T>(body: object): Promise<T> {
  const { data, error } = await supabase().functions.invoke('people', { body })
  if (error) throw error
  return data as T
}

export async function loadPeople(): Promise<Person[]> {
  const data = await people<{ people: Person[] }>({ action: 'list' })
  return data.people
}

export async function addPerson(userId: string, name: string) {
  const id = crypto.randomUUID()
  const { error } = await supabase()
    .from('people')
    .insert({ id, user_id: userId, name: name.trim() })
  if (error) throw error
  return id
}

export async function removePerson(id: string) {
  const { error } = await supabase().from('people').delete().eq('id', id)
  if (error) throw error
}

/** Adds and invites in one step; nothing is saved unless it answers ok. */
export async function addPersonByUsername(
  username: string,
): Promise<AddResult> {
  const data = await people<{ result: AddResult }>({ action: 'add', username })
  return data.result
}

export async function loadInvitations(): Promise<Invitation[]> {
  const data = await people<{
    invitations: {
      person_id: string
      from_name: string
      accepted: boolean
    }[]
  }>({ action: 'invitations' })
  return data.invitations.map((row) => ({
    personId: row.person_id,
    fromName: row.from_name,
    accepted: row.accepted,
  }))
}

/** True accepts; false declines, or leaves one already accepted. */
export async function answerInvitation(id: string, accept: boolean) {
  await people({ action: 'answer', person: id, accept })
}

export const usernameKey = (userId: string) => ['username', userId] as const
export const peopleKey = (userId: string) => ['people', userId] as const
export const invitationsKey = (userId: string) =>
  ['invitations', userId] as const

export function useUsername() {
  return useQuery({
    queryKey: usernameKey(useUserId()),
    queryFn: loadUsername,
    retry: false,
  })
}

export function usePeople() {
  return useQuery({
    queryKey: peopleKey(useUserId()),
    queryFn: loadPeople,
    retry: false,
  })
}

/** Runs for everyone, so a failure stays silent and is not tried again. */
export function useInvitations() {
  return useQuery({
    queryKey: invitationsKey(useUserId()),
    queryFn: loadInvitations,
    retry: false,
    refetchOnWindowFocus: true,
  })
}
