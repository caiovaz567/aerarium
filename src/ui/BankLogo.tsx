import type { BankKey } from '../domain/banks'

/** A bank's logo tile (public/banks, drawn by `npm run banks`). */
export function BankLogo({
  bank,
  className = '',
}: {
  readonly bank: BankKey
  readonly className?: string
}) {
  return (
    <img
      className={`bank-logo ${className}`.trim()}
      src={`${import.meta.env.BASE_URL}banks/${bank}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
