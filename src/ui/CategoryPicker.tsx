import type { Category } from '../domain/categories'

/**
 * Fase 11: optional category, as chips. "Sem categoria" first; the chosen one
 * is marked. Radios underneath, so it works with the keyboard and screen readers.
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
  const option = (id: string | null, label: string, color: string | null) => (
    <label className="category-chip" key={id ?? 'none'}>
      <input
        type="radio"
        name={name}
        checked={value === id}
        onChange={() => onChange(id)}
      />
      <span>
        {color ? (
          <i style={{ background: color }} aria-hidden="true" />
        ) : (
          <i className="none" aria-hidden="true" />
        )}
        {label}
      </span>
    </label>
  )
  return (
    <fieldset className="field">
      <legend>Categoria</legend>
      <div className="category-chips">
        {option(null, 'Sem categoria', null)}
        {categories.map((item) => option(item.id, item.name, item.color))}
      </div>
    </fieldset>
  )
}
