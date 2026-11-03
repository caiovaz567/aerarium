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
  readonly fromUsername: string | null
  readonly accepted: boolean
}

export type InviteResult =
  'ok' | 'no-person' | 'no-username' | 'not-found' | 'self' | 'already'

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

export async function loadPeople(): Promise<Person[]> {
  const { data, error } = await supabase().rpc('my_people')
  if (error) throw error
  return data as Person[]
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

export async function invitePerson(
  id: string,
  username: string,
): Promise<InviteResult> {
  const { data, error } = await supabase().rpc('invite_person', {
    p_person: id,
    p_username: username,
  })
  if (error) throw error
  return data as InviteResult
}

export async function unlinkPerson(id: string) {
  const { error } = await supabase().rpc('unlink_person', { p_person: id })
  if (error) throw error
}

export async function loadInvitations(): Promise<Invitation[]> {
  const { data, error } = await supabase().rpc('my_invitations')
  if (error) throw error
  return (
    data as {
      person_id: string
      from_username: string | null
      accepted: boolean
    }[]
  ).map((row) => ({
    personId: row.person_id,
    fromUsername: row.from_username,
    accepted: row.accepted,
  }))
}

/** True accepts; false declines, or leaves one already accepted. */
export async function answerInvitation(id: string, accept: boolean) {
  const { error } = await supabase().rpc('answer_invitation', {
    p_person: id,
    p_accept: accept,
  })
  if (error) throw error
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
