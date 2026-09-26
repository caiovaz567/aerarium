import { useId, useState, type FormEvent } from 'react'
import { categoryOps, categorySnapshot } from '../../data/categoryOps'
import type { Finance } from '../../data/finance'
import { useFinanceOp } from '../../data/useFinance'
import {
  CATEGORY_PALETTE,
  nextCategoryColor,
  normalizeText,
  type Category,
} from '../../domain/categories'
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

function CategoryRow({
  category,
  finance,
  onError,
}: {
  readonly category: Category
  readonly finance: Finance
  readonly onError: (message: string) => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const categories = finance.categories
  const [name, setName] = useState(category.name)
  const commit = () => {
    if (name.trim() === category.name) return setName(category.name)
    const problem = nameError(name, categories, category.id)
    if (problem) {
      onError(problem)
      return setName(category.name)
    }
    onError('')
    run(categoryOps.update({ ...category, name: name.trim() }))
  }
  const color = () => {
    const index = CATEGORY_PALETTE.indexOf(
      category.color as (typeof CATEGORY_PALETTE)[number],
    )
    run(
      categoryOps.update({
        ...category,
        color: CATEGORY_PALETTE[(index + 1) % CATEGORY_PALETTE.length]!,
      }),
    )
  }
  return (
    <li>
      <button
        type="button"
        className="category-color"
        aria-label={`Trocar a cor de ${category.name}`}
        onClick={color}
      >
        <i style={{ background: category.color }} />
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
  const categories = finance.categories

  const add = (event: FormEvent) => {
    event.preventDefault()
    const problem = nameError(draft, categories, null)
    if (problem) return setError(problem)
    setError('')
    run(
      categoryOps.add({
        id: crypto.randomUUID(),
        name: draft.trim(),
        color: nextCategoryColor(categories.map((item) => item.color)),
        sortOrder:
          Math.max(-1, ...categories.map((item) => item.sortOrder)) + 1,
      }),
    )
    setDraft('')
  }

  return (
    <Modal title="Categorias" onClose={onClose}>
      <div className="modal-form">
        <p className="muted">
          Toca na bolinha pra trocar a cor. Apagar uma categoria deixa os gastos
          dela sem categoria.
        </p>
        <ul className="category-edit">
          {categories.map((item) => (
            <CategoryRow
              key={`${item.id}-${item.name}`}
              category={item}
              finance={finance}
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
