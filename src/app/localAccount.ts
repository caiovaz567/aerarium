/**
 * Only with `npm run local` (mode "offline", the Supabase on this computer):
 * the fictitious demo account to sign in with by itself. Null everywhere else,
 * the published app included.
 */
export function localAccount(env: {
  readonly MODE: string
  readonly VITE_LOCAL_EMAIL?: string
  readonly VITE_LOCAL_PASSWORD?: string
}) {
  return env.MODE === 'offline' &&
    env.VITE_LOCAL_EMAIL &&
    env.VITE_LOCAL_PASSWORD
    ? { email: env.VITE_LOCAL_EMAIL, password: env.VITE_LOCAL_PASSWORD }
    : null
}
