import { useState } from 'react'
import { MonitorIcon, MoonIcon, SunIcon } from '../ui/icons'
import { nextTheme, readTheme, saveTheme, type Theme } from './theme'

const OPTIONS: [Theme, string, () => React.JSX.Element][] = [
  ['light', 'Claro', SunIcon],
  ['dark', 'Escuro', MoonIcon],
  ['system', 'Automático', MonitorIcon],
]
const NAME: Record<Theme, string> = {
  light: 'claro',
  dark: 'escuro',
  system: 'automático',
}

/**
 * Light, dark or the device's, in the main area (the owner's choice): three
 * buttons on a computer, one that cycles on a phone.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const choose = (next: Theme) => {
    saveTheme(next)
    setTheme(next)
  }
  const Current = OPTIONS.find(([key]) => key === theme)![2]
  return (
    <>
      <button
        type="button"
        className="icon-button theme-cycle"
        aria-label={`Tema: ${NAME[theme]}. Tocar pra trocar`}
        onClick={() => choose(nextTheme(theme))}
      >
        <Current />
      </button>
      <div className="theme-toggle" role="group" aria-label="Tema">
        {OPTIONS.map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            aria-label={label}
            aria-pressed={theme === key}
            onClick={() => choose(key)}
          >
            <Icon />
          </button>
        ))}
      </div>
    </>
  )
}
