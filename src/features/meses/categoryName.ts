import type { Finance } from '../../data/finance'
import { UNCATEGORIZED, UNDETAILED } from '../../domain/categories'

export const percent = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

/** A category's name, or what stands for the items without one. */
export function categoryName(finance: Finance, key: string) {
  return key === UNCATEGORIZED
    ? 'Sem categoria'
    : key === UNDETAILED
      ? 'Outros gastos das faturas'
      : (finance.categories.find((item) => item.id === key)?.name ??
        'Sem categoria')
}
