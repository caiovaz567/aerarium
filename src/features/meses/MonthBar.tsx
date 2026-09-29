import { Link } from 'react-router'
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
  pathFor,
  onOpenList,
  onCreateNext,
  canCreate = true,
}: {
  readonly selected: Month
  readonly months: readonly Month[]
  readonly pathFor: (month: Month) => string
  readonly onOpenList: () => void
  readonly onCreateNext: () => void
  /** False at the end of the forecasts: the next month to create is not this one's. */
  readonly canCreate?: boolean
}) {
  const index = months.indexOf(selected)
  const previous = months[index - 1]
  const next = months[index + 1]
  return (
    <StickyBar className="monthbar">
      {previous ? (
        <Link
          className="icon-button"
          to={pathFor(previous)}
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
          to={pathFor(next)}
          aria-label="Próximo mês"
        >
          <ChevronRightIcon />
        </Link>
      ) : canCreate ? (
        <button
          type="button"
          className="icon-button plus"
          aria-label="Criar próximo mês"
          onClick={onCreateNext}
        >
          <PlusIcon />
        </button>
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label="Próximo mês"
          disabled
        >
          <ChevronRightIcon />
        </button>
      )}
    </StickyBar>
  )
}
