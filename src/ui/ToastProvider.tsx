import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TOAST_MS, ToastContext, type ToastAction } from './toastContext'

interface Toast {
  readonly id: number
  readonly message: string
  readonly action?: ToastAction
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const next = useRef(0)

  const show = useCallback((message: string, action?: ToastAction) => {
    next.current += 1
    setToast({ id: next.current, message, action })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(
      () => setToast(null),
      toast.action ? TOAST_MS.withAction : TOAST_MS.plain,
    )
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext value={show}>
      {children}
      {/* Always mounted so screen readers announce changes. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  setToast(null)
                  toast.action!.onClick()
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  )
}
