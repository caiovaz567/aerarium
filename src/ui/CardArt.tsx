import type { CSSProperties } from 'react'
import { cardColor, inkFor } from '../domain/cardColor'

/**
 * Card picture: color gradient and a gold chip; the large one also shows the
 * name and the contactless symbol. Never a bank logo (7.3).
 */
export function CardArt({
  card,
  size = 'sm',
}: {
  readonly card: { readonly name: string; readonly color: string | null }
  readonly size?: 'xs' | 'sm' | 'lg'
}) {
  const color = cardColor(card)
  return (
    <span
      className={`card-art ${size}`}
      style={{ '--cc': color, '--cc-ink': inkFor(color) } as CSSProperties}
      aria-hidden="true"
    >
      <i className="chip" />
      {size === 'lg' && (
        <>
          <i className="waves" />
          <b>{card.name}</b>
        </>
      )}
    </span>
  )
}
