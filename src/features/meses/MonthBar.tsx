import { Link } from 'react-router'
import { monthPath } from '../../app/paths'
import { monthLabel, monthName, type Month } from '../../domain/months'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from '../../ui/icons'
import { StickyBar } from '../../ui/StickyBar'

/** ‹ Setembro 2026 › , or + on the last month to create the next one. */
export function MonthBar({
  selected,
  months,
  onOpenList,
  onCreateNext,
}: {
  readonly selected: Month
  readonly months: readonly Month[]
  readonly onOpenList: () => void
  readonly onCreateNext: () => void
}) {
  const index = months.indexOf(selected)
  const previous = months[index - 1]
  const next = months[index + 1]
  return (
    <StickyBar className="monthbar">
      {previous ? (
        <Link
          className="icon-button"
          to={monthPath(previous)}
          aria-label="Mês anterior"
        >
          <ChevronLeftIcon />
        </Link>
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label="Mês anterior"
          disabled
        >
          <ChevronLeftIcon />
        </button>
      )}
      <button
        type="button"
        className="monthname"
        onClick={onOpenList}
        aria-label={`${monthLabel(selected)}. Escolher mês`}
      >
        {monthName(selected)}
        <small>
          {selected.slice(0, 4)}
          <ChevronDownIcon />
        </small>
      </button>
      {next ? (
        <Link
          className="icon-button"
          to={monthPath(next)}
          aria-label="Próximo mês"
        >
          <ChevronRightIcon />
        </Link>
      ) : (
        <button
          type="button"
          className="icon-button plus"
          aria-label="Criar próximo mês"
          onClick={onCreateNext}
        >
          <PlusIcon />
        </button>
      )}
    </StickyBar>
  )
}
