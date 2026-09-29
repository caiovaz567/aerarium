import { useState, type ReactNode } from 'react'
import type { BankKey } from '../domain/banks'

/**
 * A bank's logo tile (public/banks, drawn by `npm run banks`). If the image
 * cannot load (offline, a deploy in progress), `fallback` shows instead of a
 * broken picture.
 */
export function BankLogo({
  bank,
  className = '',
  fallback = null,
}: {
  readonly bank: BankKey
  readonly className?: string
  readonly fallback?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return fallback
  return (
    <img
      className={`bank-logo ${className}`.trim()}
      src={`${import.meta.env.BASE_URL}banks/${bank}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
