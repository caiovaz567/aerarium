import { useState } from 'react'
import type { Finance } from '../../data/finance'
import { today } from '../../data/useFinance'
import type { OutflowItem } from '../../domain/categories'
import { formatMoney, sumMoney } from '../../domain/money'
import type { Month } from '../../domain/months'
import {
  dayLabel,
  monthTimeline,
  NO_CARD_FILTER,
  timeLabel,
  timedItems,
  type TimedItem,
} from '../../domain/timeline'
import { CardArt } from '../../ui/CardArt'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { CardIcon, PeopleIcon, WalletIcon } from '../../ui/icons'
import { describeOutflow } from './outflowText'

function Row({
  finance,
  item,
  time,
  onOpen,
}: {
  readonly finance: Finance
  readonly item: OutflowItem
  readonly time: string | null
  readonly onOpen: (item: OutflowItem) => void
}) {
  const text = describeOutflow(finance, item)
  const category =
    finance.categories.find((row) => row.id === item.categoryId) ?? null
  return (
    <li>
      <button
        type="button"
        className="timeline-row"
        onClick={() => onOpen(item)}
      >
        {item.source === 'other' ? (
          <span className="cat-badge round none" aria-hidden="true">
            <CardIcon />
          </span>
        ) : item.source === 'shared' ? (
          <span className="cat-badge round none" aria-hidden="true">
            <PeopleIcon />
          </span>
        ) : (
          <CategoryBadge category={category} shape="round" />
        )}
        <span className="timeline-text">
          <b>
            {text.title}
            {'fresh' in text && text.fresh && (
              <span className="fresh-pill">novo</span>
            )}
          </b>
          {'note' in text && text.note && (
            <span className="timeline-note">{text.note}</span>
          )}
          <small>{[time, text.detail].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="timeline-value">{formatMoney(item.amount)}</span>
      </button>
    </li>
  )
}

/**
 * Fase 12, "Por data": the month's outflows newest first, grouped by day, with
 * the time when known; what has no date goes to "Fixos do mês". A row of the
 * month's cards filters it.
 */
export function TimelineView({
  finance,
  month,
  onOpen,
}: {
  readonly finance: Finance
  readonly month: Month
  readonly onOpen: (item: OutflowItem) => void
}) {
  const [cardFilter, setCard] = useState<string | null>(null)
  const all = timedItems(month, finance)
  const everything = [...all.dated, ...all.fixed]
  if (!everything.length)
    return (
      <p className="empty-hint">Nenhuma saída ainda. Toca no + pra lançar.</p>
    )

  // Only the options this month has.
  const cardIds = new Set(
    everything.map((item) => item.cardId ?? NO_CARD_FILTER),
  )
  const cards = finance.cards.filter((card) => cardIds.has(card.id))
  // A card the month does not have any more (after an edit) is dropped.
  const cardId = cardFilter && cardIds.has(cardFilter) ? cardFilter : null
  const { days, fixed } = monthTimeline(month, finance, {
    cardId,
    categoryId: null,
  })
  const day = today()

  return (
    <div className="timeline">
      {cardIds.size > 1 && (
        // One row of cards that slides sideways (asked by the user); only
        // this row scrolls, never the page. Categories live in "Por categoria".
        <div
          className="card-filter"
          role="group"
          aria-label="Filtrar por cartão"
        >
          <button
            type="button"
            className="filter-chip"
            aria-pressed={cardId === null}
            onClick={() => setCard(null)}
          >
            Todos
          </button>
          {cards.map((card) => (
            <button
              type="button"
              key={card.id}
              className="filter-chip"
              aria-pressed={cardId === card.id}
              onClick={() => setCard(card.id)}
            >
              <CardArt card={card} size="xs" />
              {card.name}
            </button>
          ))}
          {cardIds.has(NO_CARD_FILTER) && (
            <button
              type="button"
              className="filter-chip"
              aria-pressed={cardId === NO_CARD_FILTER}
              onClick={() => setCard(NO_CARD_FILTER)}
            >
              <i className="wallet" aria-hidden="true">
                <WalletIcon />
              </i>
              Fora do cartão
            </button>
          )}
        </div>
      )}

      {!days.length && !fixed.length && (
        <p className="empty-hint">Nada com esse filtro.</p>
      )}

      {days.map((entry) => (
        <section
          className="timeline-day"
          key={entry.day}
          aria-label={dayLabel(entry.day, day)}
        >
          <h3 className="timeline-head">
            <span>{dayLabel(entry.day, day)}</span>
            <span>{formatMoney(entry.total)}</span>
          </h3>
          <ul className="timeline-list">
            {entry.items.map((item: TimedItem) => (
              <Row
                key={`${item.source}-${item.id}`}
                finance={finance}
                item={item}
                time={item.at ? timeLabel(item.at) : null}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}

      {fixed.length > 0 && (
        <section className="timeline-day" aria-label="Fixos do mês">
          <h3 className="timeline-head">
            <span>Fixos do mês</span>
            <span>
              {formatMoney(sumMoney(fixed.map((item) => item.amount)))}
            </span>
          </h3>
          <ul className="timeline-list">
            {fixed.map((item) => (
              <Row
                key={`${item.source}-${item.id}`}
                finance={finance}
                item={item}
                time={null}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
