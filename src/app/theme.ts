/** The look the person chose: always light, always dark, or the device's. */
export type Theme = 'light' | 'dark' | 'system'

const KEY = 'aerarium.tema'

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* private mode: the device's */
  }
  return 'system'
}

/**
 * Light or dark on <html data-theme>, which tokens.css (and HeroUI) follow;
 * "system" leaves it to prefers-color-scheme.
 */
export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
) {
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    /* private mode: only for this visit */
  }
  applyTheme(theme)
}

/** The phone's single button: automático → claro → escuro → automático. */
export const nextTheme = (theme: Theme): Theme =>
  theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
