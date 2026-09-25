import { useId } from 'react'

/** Password input whose hint is announced separately from the label. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly autoComplete: 'current-password' | 'new-password'
  readonly hint?: string
}) {
  const id = useId()
  const hintId = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        name="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
