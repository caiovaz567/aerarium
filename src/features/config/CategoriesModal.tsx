import { useId, useState, type CSSProperties, type FormEvent } from 'react'
import { categoryOps, categorySnapshot } from '../../data/categoryOps'
import type { Finance } from '../../data/finance'
import { useFinanceOp } from '../../data/useFinance'
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICONS,
  CATEGORY_PALETTE,
  DEFAULT_ICON,
  nextCategoryColor,
  normalizeText,
  type Category,
} from '../../domain/categories'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { TrashButton } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

const MAX = 40

/** Problem with a name, or null. Names are unique ignoring case and accents. */
function nameError(
  name: string,
  categories: readonly Category[],
  ownId: string | null,
) {
  const trimmed = name.trim()
  if (!trimmed) return 'Escreve um nome.'
  if (trimmed.length > MAX) return `O nome pode ter até ${MAX} letras.`
  const key = normalizeText(trimmed)
  if (
    categories.some(
      (item) => item.id !== ownId && normalizeText(item.name) === key,
    )
  )
    return 'Já existe uma categoria com esse nome.'
  return null
}

/** Icon grid and colors of one category; each tap is saved. */
function Appearance({ category }: { readonly category: Category }) {
  const run = useFinanceOp()
  const name = useId()
  const save = (changes: Partial<Category>) =>
    run(categoryOps.update({ ...category, ...changes }))
  return (
    <div
      className="category-look"
      style={{ '--cat': category.color } as CSSProperties}
    >
      <fieldset>
        <legend>Ícone</legend>
        <div className="icon-grid">
          {CATEGORY_ICONS.map((icon) => (
            <label key={icon} className="icon-option">
              <input
                type="radio"
                name={`${name}-icone`}
                checked={category.icon === icon}
                onChange={() => save({ icon })}
                aria-label={CATEGORY_ICON_LABELS[icon]}
              />
              <span>
                <CategoryIcon icon={icon} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Cor</legend>
        <div className="swatches">
          {CATEGORY_PALETTE.map((color) => (
            <label className="swatch" key={color}>
              <input
                type="radio"
                name={`${name}-cor`}
                checked={category.color.toUpperCase() === color}
                onChange={() => save({ color })}
                aria-label={`Cor ${color}`}
              />
              <i style={{ background: color }} />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

function CategoryRow({
  category,
  finance,
  open,
  onToggle,
  onError,
}: {
  readonly category: Category
  readonly finance: Finance
  readonly open: boolean
  readonly onToggle: () => void
  readonly onError: (message: string) => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const [name, setName] = useState(category.name)
  const commit = () => {
    if (name.trim() === category.name) return setName(category.name)
    const problem = nameError(name, finance.categories, category.id)
    if (problem) {
      onError(problem)
      return setName(category.name)
    }
    onError('')
    run(categoryOps.update({ ...category, name: name.trim() }))
  }
  return (
    <li>
      <div className="category-line">
        <button
          type="button"
          className="category-look-toggle"
          aria-label={`Ícone e cor de ${category.name}`}
          aria-expanded={open}
          onClick={onToggle}
        >
          <CategoryBadge category={category} shape="round" />
        </button>
        <input
          aria-label={`Nome da categoria ${category.name}`}
          autoComplete="off"
          maxLength={MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
        />
        <TrashButton
          label={category.name}
          onClick={() => {
            const snapshot = categorySnapshot(finance, category)
            run(categoryOps.remove(snapshot))
            toast(`${category.name} excluída`, {
              label: 'Desfazer',
              onClick: () => run(categoryOps.restore(snapshot)),
            })
          }}
        />
      </div>
      {open && <Appearance category={category} />}
    </li>
  )
}

/** Fase 11: the person's categories. Changes are saved as they happen. */
export function CategoriesModal({
  finance,
  onClose,
}: {
  readonly finance: Finance
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const newId = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const categories = finance.categories

  const add = (event: FormEvent) => {
    event.preventDefault()
    const problem = nameError(draft, categories, null)
    if (problem) return setError(problem)
    setError('')
    const id = crypto.randomUUID()
    run(
      categoryOps.add({
        id,
        name: draft.trim(),
        color: nextCategoryColor(categories.map((item) => item.color)),
        icon: DEFAULT_ICON,
        sortOrder:
          Math.max(-1, ...categories.map((item) => item.sortOrder)) + 1,
      }),
    )
    setDraft('')
    // Right away, so the person picks its icon.
    setOpen(id)
  }

  return (
    <Modal title="Categorias" onClose={onClose}>
      <div className="modal-form">
        <p className="muted">
          Toca no ícone pra escolher outro desenho e a cor. Apagar uma categoria
          deixa os gastos dela sem categoria.
        </p>
        <ul className="category-edit">
          {categories.map((item) => (
            <CategoryRow
              key={`${item.id}-${item.name}`}
              category={item}
              finance={finance}
              open={open === item.id}
              onToggle={() => setOpen(open === item.id ? null : item.id)}
              onError={setError}
            />
          ))}
        </ul>
        <form className="category-new" onSubmit={add} noValidate>
          <label className="visually-hidden" htmlFor={newId}>
            Nova categoria
          </label>
          <input
            id={newId}
            autoComplete="off"
            maxLength={MAX}
            placeholder="Nova categoria"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn ghost">
            Adicionar
          </button>
        </form>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={onClose}>
            Pronto
          </button>
        </div>
      </div>
    </Modal>
  )
}
