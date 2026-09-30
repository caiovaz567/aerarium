import type { CSSProperties } from 'react'
import type { Category } from '../domain/categories'
import { CategoryIcon } from './CategoryIcon'

/**
 * Fase 11: a small tile the size of a card thumbnail, so bills and loose
 * installments line up with the cards. The category's own icon and color; a
 * gray receipt when there is none.
 */
export function CategoryBadge({
  category,
  shape = 'card',
}: {
  readonly category: Category | null
  /** "card" lines up with card thumbnails; "round" is a small circle. */
  readonly shape?: 'card' | 'round'
}) {
  return (
    <span
      className={`cat-badge${shape === 'round' ? ' round' : ''}${category ? '' : ' none'}`}
      style={category ? ({ '--cat': category.color } as CSSProperties) : {}}
      aria-hidden="true"
    >
      <CategoryIcon icon={category?.icon ?? null} />
    </span>
  )
}
