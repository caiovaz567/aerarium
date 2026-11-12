import { useState } from 'react'

/**
 * A value that softly takes its place when it changes (switching month or
 * person), but not when the screen first shows it.
 */
export function ChangingText({ children }: { readonly children: string }) {
  const [first] = useState(children)
  return (
    <span
      key={children}
      className={children === first ? undefined : 'changed-text'}
    >
      {children}
    </span>
  )
}
