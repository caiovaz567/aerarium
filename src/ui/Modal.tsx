import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  /** Buttons at the bottom, e.g. Cancelar and the main action. */
  readonly actions?: ReactNode
  /** Selector focused on open even on touch screens, to bring up the keyboard. */
  readonly initialFocus?: string
}

/**
 * Centered dialog (7.4 item 5): dimmed and blurred backdrop, short pop,
 * Esc and backdrop close, focus kept inside and returned on close.
 * Mount it only while open.
 */
export function Modal({
  title,
  onClose,
  children,
  actions,
  initialFocus,
}: ModalProps) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  // Only the first render matters: focus is placed once, when the dialog opens.
  const focusTarget = useRef(initialFocus)

  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    document.body.classList.add('locked')
    const node = dialog.current!
    // On touch screens, focusing an input would pop the keyboard; focus the dialog instead.
    const first = focusTarget.current
      ? node.querySelector<HTMLElement>(focusTarget.current)
      : window.matchMedia('(pointer: fine)').matches
        ? node.querySelector<HTMLElement>(FOCUSABLE)
        : null
    ;(first ?? node).focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('locked')
      previous?.focus()
    }
  }, [])

  return createPortal(
    <div className="modal-wrap">
      <div className="modal-scrim" onClick={() => close.current()} />
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}
