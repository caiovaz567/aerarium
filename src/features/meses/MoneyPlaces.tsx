import type { Finance } from '../../data/finance'
import { groupByCategory, monthOutflowItems } from '../../domain/categories'
import type { Month } from '../../domain/months'
import { categoryName, percent } from './categoryName'

/** Wide screens, beside Saídas: the biggest categories of the month. */
export function MoneyPlaces({
  finance,
  month,
}: {
  readonly finance: Finance
  readonly month: Month
}) {
  const groups = groupByCategory(monthOutflowItems(month, finance)).slice(0, 5)
  if (!groups.length) return null
  return (
    <section className="block money-places" aria-labelledby="onde-foi">
      <div className="block-head">
        <h2 id="onde-foi">Onde foi o dinheiro</h2>
      </div>
      <ul>
        {groups.map((group) => {
          const share = percent.format(group.share * 100)
          return (
            <li key={group.key}>
              <span>{categoryName(finance, group.key)}</span>
              <b>{share}%</b>
              <span className="money-bar" aria-hidden="true">
                <span style={{ width: `${group.share * 100}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
