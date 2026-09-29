import type { MouseEvent } from 'react'
import { brazilianDate } from '../domain/months'

const openPicker = (event: MouseEvent<HTMLInputElement>) => {
  try {
    event.currentTarget.showPicker()
  } catch {
    /* older browsers open it themselves, or not at all */
  }
}

/**
 * The phone's (or computer's) own date picker, but the date always reads the
 * Brazilian way, day/month/year and 24 hours, whatever the device's language.
 */
export function DateInput({
  id,
  type = 'date',
  value,
  onChange,
  empty = 'Sem data',
  describedBy,
}: {
  readonly id: string
  readonly type?: 'date' | 'datetime-local'
  readonly value: string
  readonly onChange: (value: string) => void
  /** Shown when there is no date. */
  readonly empty?: string
  readonly describedBy?: string
}) {
  return (
    <div className="date-input">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openPicker}
        aria-describedby={describedBy}
      />
      <span className={value ? 'date-text' : 'date-text empty'} aria-hidden>
        {value ? brazilianDate(value) : empty}
      </span>
    </div>
  )
}
