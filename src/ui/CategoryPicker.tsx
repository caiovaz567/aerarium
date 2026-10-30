import type { CSSProperties } from 'react'
import type { Category } from '../domain/categories'
import { CategoryIcon } from './CategoryIcon'

/**
 * Optional category, as chips. "Sem categoria" first; the chosen one is marked.
 * Radios underneath, so it works with the keyboard and screen readers.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  name = 'categoria',
}: {
  readonly categories: readonly Category[]
  readonly value: string | null
  readonly onChange: (categoryId: string | null) => void
  /** Radio group name; unique per form. */
  readonly name?: string
}) {
  const option = (category: Category | null) => (
    <label
      className="category-chip"
      key={category?.id ?? 'none'}
      style={
        category ? ({ '--cat': category.color } as CSSProperties) : undefined
      }
    >
      <input
        type="radio"
        name={name}
        checked={value === (category?.id ?? null)}
        onChange={() => onChange(category?.id ?? null)}
      />
      <span className={category ? undefined : 'none'}>
        <CategoryIcon icon={category?.icon ?? null} />
        {category?.name ?? 'Sem categoria'}
      </span>
    </label>
  )
  return (
    <fieldset className="field">
      <legend>Categoria</legend>
      <div className="category-chips">
        {option(null)}
        {categories.map((item) => option(item))}
      </div>
    </fieldset>
  )
}
