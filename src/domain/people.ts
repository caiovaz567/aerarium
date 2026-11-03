/** What the person typed, as usernames are stored: "@Caio " is "caio". */
export const cleanUsername = (value: string) =>
  value.trim().replace(/^@+/, '').toLowerCase()

/** What is wrong with a username (already clean), or null. */
export function usernameProblem(username: string): string | null {
  if (username.length < 3 || username.length > 20)
    return 'O usuário precisa ter de 3 a 20 letras.'
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(username))
    return 'Usa só letras sem acento, números, _ e ponto no meio do nome.'
  return null
}

export type PersonInput =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'username'; readonly username: string }
  | { readonly kind: 'problem'; readonly problem: string }

/** The "Adicionar pessoa" field: with @ it is a username, else a name. */
export function readPersonInput(value: string): PersonInput {
  if (value.trim().startsWith('@')) {
    const username = cleanUsername(value)
    const problem = usernameProblem(username)
    return problem
      ? { kind: 'problem', problem }
      : { kind: 'username', username }
  }
  const problem = personNameProblem(value)
  return problem
    ? { kind: 'problem', problem }
    : { kind: 'name', name: value.trim() }
}

/** What is wrong with a person's name, or null. */
export function personNameProblem(name: string): string | null {
  const clean = name.trim()
  if (!clean) return 'Coloca o nome da pessoa.'
  return clean.length > 30 ? 'O nome pode ter até 30 letras.' : null
}
