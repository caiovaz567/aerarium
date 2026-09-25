import type { CSSProperties } from 'react'
import { cardColor, inkFor } from '../domain/cardColor'

/** Card thumbnail: color gradient and a gold chip. Never a bank logo (7.3). */
export function CardArt({
  card,
  size = 'sm',
}: {
  readonly card: { readonly name: string; readonly color: string | null }
  readonly size?: 'xs' | 'sm'
}) {
  const color = cardColor(card)
  return (
    <span
      className={`card-art ${size}`}
      style={{ '--cc': color, '--cc-ink': inkFor(color) } as CSSProperties}
      aria-hidden="true"
    >
      <i className="chip" />
    </span>
  )
}
