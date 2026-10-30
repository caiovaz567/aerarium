import type { CSSProperties, PointerEvent } from 'react'
import { cardBank } from '../domain/banks'
import { cardColor, inkFor } from '../domain/cardColor'
import { BankLogo } from './BankLogo'

interface CardLook {
  readonly name: string
  readonly color: string | null
  readonly bank?: string | null
}

/** On a mouse, the big card tilts in 3D following the pointer. */
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
 * name and the contactless symbol. With a known bank, small pictures
 * are the bank's logo and the large card carries it.
 */
export function CardArt({
  card,
  size = 'sm',
}: {
  readonly card: CardLook
  readonly size?: 'xs' | 'sm' | 'lg'
}) {
  const color = cardColor(card)
  const big = size === 'lg'
  const bank = cardBank(card)
  const art = (
    <span
      className={`card-art ${size}`}
      style={{ '--cc': color, '--cc-ink': inkFor(color) } as CSSProperties}
      aria-hidden="true"
      onPointerMove={big ? tilt : undefined}
      onPointerLeave={big ? untilt : undefined}
    >
      <i className="card-chip" />
      {big && (
        <>
          {bank && <BankLogo bank={bank} className="on-card" />}
          <i className="waves" />
          <b>{card.name}</b>
        </>
      )}
    </span>
  )
  if (bank && !big)
    return <BankLogo bank={bank} className={size} fallback={art} />
  return art
}
