import { useId } from 'react'

/**
 * Fase 12: date and time something happened ("2026-09-26T14:30", São Paulo).
 * The phone shows its own date and time picker.
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
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
