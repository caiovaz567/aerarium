// Leaving a screen to look at something and coming back puts the page where
// it was (Meses → a card in Cartões → Voltar). One place at a time, per tab.
const KEY = 'aerarium.voltar'

/** Keeps where the page is now, for when `path` opens again. */
export function rememberScroll(path: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, y: window.scrollY }))
  } catch {
    /* private mode: it just opens at the top */
  }
}

/** Where `path` was left, once; null when it was not this one. */
export function takeScroll(path: string): number | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as { path?: string; y?: number }
    if (saved.path !== path || typeof saved.y !== 'number') return null
    sessionStorage.removeItem(KEY)
    return saved.y
  } catch {
    return null
  }
}
