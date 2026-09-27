import {
  DEFAULT_CATEGORIES,
  suggestExisting,
  type CategorizedText,
  type Category,
} from '../domain/categories'
import type { Finance } from './finance'
import { ok, patch, table, without, type FinanceOp } from './financeOps'

// Fase 11: categories and the category of each outflow.

/** The four kinds of things that can have a category, and their tables. */
export const CATEGORIZED = {
  bill: 'bills',
  expense: 'invoice_expenses',
  plan: 'installment_plans',
  subscription: 'subscriptions',
} as const
export type CategorizedKind = keyof typeof CATEGORIZED

const LISTS = {
  bill: 'bills',
  expense: 'expenses',
  plan: 'plans',
  subscription: 'subscriptions',
} as const satisfies Record<CategorizedKind, keyof Finance>

const categoryRecord = (category: Category) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  sort_order: category.sortOrder,
})

/** Everything already named, oldest first, to suggest from what was chosen before. */
export function categoryHistory(finance: Finance): CategorizedText[] {
  return [
    ...finance.plans,
    ...finance.subscriptions.map((item) => ({
      description: item.name,
      categoryId: item.categoryId,
    })),
    ...[...finance.bills].sort((a, b) => a.month.localeCompare(b.month)),
    ...finance.expenses,
  ]
}

function withCategory(
  finance: Finance,
  kind: CategorizedKind,
  ids: ReadonlySet<string>,
  categoryId: string | null,
): Finance {
  const list = LISTS[kind]
  return {
    ...finance,
    [list]: (finance[list] as readonly { id: string }[]).map((item) =>
      ids.has(item.id) ? { ...item, categoryId } : item,
    ),
  }
}

/** Ids of each kind that use a category, to put them back after an undo. */
export type CategoryLinks = Record<CategorizedKind, readonly string[]>

export interface CategorySnapshot {
  readonly category: Category
  readonly links: CategoryLinks
}

export function categorySnapshot(
  finance: Finance,
  category: Category,
): CategorySnapshot {
  const using = (kind: CategorizedKind) =>
    (finance[LISTS[kind]] as readonly { id: string; categoryId?: unknown }[])
      .filter((item) => item.categoryId === category.id)
      .map((item) => item.id)
  return {
    category,
    links: {
      bill: using('bill'),
      expense: using('expense'),
      plan: using('plan'),
      subscription: using('subscription'),
    },
  }
}

async function link(links: CategoryLinks, categoryId: string) {
  for (const kind of Object.keys(CATEGORIZED) as CategorizedKind[])
    if (links[kind].length)
      await ok(
        table(CATEGORIZED[kind])
          .update({ category_id: categoryId })
          .in('id', [...links[kind]]),
      )
}

export const categoryOps = {
  /**
   * First time (no categories yet): the default list, and the keyword
   * suggestion applied once to what already exists without a category.
   */
  setup(
    finance: Finance,
    newId: () => string = () => crypto.randomUUID(),
  ): FinanceOp {
    const categories: Category[] = DEFAULT_CATEGORIES.map((item, index) => ({
      id: newId(),
      name: item.name,
      color: item.color,
      icon: item.icon,
      sortOrder: index,
    }))
    const found: Record<CategorizedKind, Map<string, string>> = {
      bill: suggestExisting(finance.bills, categories),
      expense: suggestExisting(finance.expenses, categories),
      plan: suggestExisting(finance.plans, categories),
      subscription: suggestExisting(
        finance.subscriptions.map((item) => ({
          id: item.id,
          description: item.name,
          categoryId: item.categoryId,
        })),
        categories,
      ),
    }
    return {
      run: async () => {
        await ok(table('categories').insert(categories.map(categoryRecord)))
        for (const kind of Object.keys(found) as CategorizedKind[])
          for (const category of categories) {
            const ids = [...found[kind]]
              .filter(([, id]) => id === category.id)
              .map(([itemId]) => itemId)
            if (ids.length)
              await ok(
                table(CATEGORIZED[kind])
                  .update({ category_id: category.id })
                  .in('id', ids)
                  // Never over a choice made meanwhile on another device.
                  .is('category_id', null),
              )
          }
      },
      apply: (f) => {
        let next: Finance = { ...f, categories }
        for (const kind of Object.keys(found) as CategorizedKind[])
          for (const [itemId, categoryId] of found[kind])
            next = withCategory(next, kind, new Set([itemId]), categoryId)
        return next
      },
    }
  },

  add(category: Category): FinanceOp {
    return {
      run: () => ok(table('categories').insert(categoryRecord(category))),
      apply: (f) => ({ ...f, categories: [...f.categories, category] }),
    }
  },

  update(category: Category): FinanceOp {
    const { id, ...record } = categoryRecord(category)
    return {
      run: () => ok(table('categories').update(record).eq('id', id)),
      apply: (f) => ({
        ...f,
        categories: patch(f.categories, category.id, category),
      }),
    }
  },

  /** Its items stay, without a category (the database sets them to null). */
  remove(snapshot: CategorySnapshot): FinanceOp {
    return {
      run: () =>
        ok(table('categories').delete().eq('id', snapshot.category.id)),
      apply: (f) => {
        let next: Finance = {
          ...f,
          categories: without(f.categories, snapshot.category.id),
        }
        for (const kind of Object.keys(CATEGORIZED) as CategorizedKind[])
          next = withCategory(next, kind, new Set(snapshot.links[kind]), null)
        return next
      },
    }
  },

  restore(snapshot: CategorySnapshot): FinanceOp {
    const id = snapshot.category.id
    return {
      run: async () => {
        await ok(table('categories').insert(categoryRecord(snapshot.category)))
        await link(snapshot.links, id)
      },
      apply: (f) => {
        let next: Finance = {
          ...f,
          categories: [...f.categories, snapshot.category].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          ),
        }
        for (const kind of Object.keys(CATEGORIZED) as CategorizedKind[])
          next = withCategory(next, kind, new Set(snapshot.links[kind]), id)
        return next
      },
    }
  },

  /** The category of one bill, card expense, plan or subscription. */
  setItem(
    kind: CategorizedKind,
    itemId: string,
    categoryId: string | null,
  ): FinanceOp {
    return {
      run: () =>
        ok(
          table(CATEGORIZED[kind])
            .update({ category_id: categoryId })
            .eq('id', itemId),
        ),
      apply: (f) => withCategory(f, kind, new Set([itemId]), categoryId),
    }
  },
}
