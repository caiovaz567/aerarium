import type { CSSProperties, PointerEvent } from 'react'
import { useCardPhotoUrl } from '../data/photos'
import { cardColor, inkFor } from '../domain/cardColor'

interface CardLook {
  readonly name: string
  readonly color: string | null
  readonly photoPath?: string | null
}

/** On a mouse, the big card tilts in 3D following the pointer (7.4 item 12). */
function tilt(event: PointerEvent<HTMLSpanElement>) {
  if (event.pointerType !== 'mouse') return
  const node = event.currentTarget
  const box = node.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  const y = (event.clientY - box.top) / box.height
  node.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`)
  node.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`)
  node.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`)
  node.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`)
  node.classList.add('tilt')
}
function untilt(event: PointerEvent<HTMLSpanElement>) {
  const node = event.currentTarget
  node.classList.remove('tilt')
  node.style.setProperty('--rx', '0deg')
  node.style.setProperty('--ry', '0deg')
}

/**
 * Card picture: color gradient and a gold chip; the large one also shows the
 * name and the contactless symbol. A photo replaces the drawing. Never a bank
 * logo (7.3).
 */
export function CardArt({
  card,
  size = 'sm',
}: {
  readonly card: CardLook
  readonly size?: 'xs' | 'sm' | 'lg'
}) {
  const color = cardColor(card)
  const photo = useCardPhotoUrl(card.photoPath ?? null)
  const big = size === 'lg'
  return (
    <span
      className={`card-art ${size}${photo ? ' photo' : ''}`}
      style={{ '--cc': color, '--cc-ink': inkFor(color) } as CSSProperties}
      aria-hidden="true"
      onPointerMove={big ? tilt : undefined}
      onPointerLeave={big ? untilt : undefined}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" />
      ) : (
        <>
          <i className="chip" />
          {big && (
            <>
              <i className="waves" />
              <b>{card.name}</b>
            </>
          )}
        </>
      )}
    </span>
  )
}
