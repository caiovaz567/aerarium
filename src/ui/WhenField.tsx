import { useId } from 'react'
import { DateInput } from './DateInput'

/**
 * Fase 12: date and time something happened ("2026-09-26T14:30", São Paulo).
 * The phone shows its own date and time picker; the date reads dd/mm/aaaa.
 */
export function WhenField({
  label = 'Quando',
  value,
  onChange,
  hint,
}: {
  readonly label?: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly hint?: string
}) {
  const id = useId()
  const hintId = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <DateInput
        id={id}
        type="datetime-local"
        value={value}
        onChange={onChange}
        describedBy={hint ? hintId : undefined}
      />
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
