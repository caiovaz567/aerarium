import { useId, useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

/**
 * Password input whose hint is announced separately from the label. The eye
 * shows what was typed.
 */
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
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name="password"
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hint ? hintId : undefined}
        />
        <button
          type="button"
          className="password-eye"
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
