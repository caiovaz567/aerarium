import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { currentMonth } from '../../app/paths'
import { useFinance } from '../../data/useFinance'
import {
  chartAverage,
  chartComparison,
  chartSeries,
} from '../../domain/chartSeries'
import { installmentStatus } from '../../domain/installments'
import { cents, formatMoney } from '../../domain/money'
import {
  monthLabel,
  monthName,
  monthShort,
  type Month,
} from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { EmptyState } from '../../ui/EmptyState'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { LoadError, Loading } from '../../ui/LoadStates'
import { StickyBar } from '../../ui/StickyBar'
import { CardChart } from './CardChart'
import { cardStats, monthDetail, planLine, pointStatus } from './cardView'
import { usePlanActions } from './planActions'
import { PlanRow } from './PlanRow'

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function Triangle({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path
        d={up ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'}
        fill="currentColor"
      />
    </svg>
  )
}

/** Card page (seção 8.4): big card, three numbers, the chart and the month detail. */
export function CardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useFinance()
  const finance = query.data
  const card = finance?.cards.find((item) => item.id === id)
  const now = currentMonth()
  const points = useMemo(
    () => (finance && card ? chartSeries(card.id, now, finance) : []),
    [finance, card, now],
  )
  const [picked, setPicked] = useState<Month | null>(null)
  const selected =
    picked && points.some((point) => point.month === picked)
      ? picked
      : (points.find((point) => point.month === now)?.month ??
        points[points.length - 1]?.month)
  const index = points.findIndex((point) => point.month === selected)
  const step = (delta: number) => {
    const next = points[index + delta]
    if (next) setPicked(next.month)
  }

  // Esc goes back; ← → walk the months (computer). Not while a dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.body.classList.contains('locked')) return
      if (/input|select|textarea/i.test((event.target as Element).tagName))
        return
      if (event.key === 'Escape') navigate('/cartoes')
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const next = points[index + (event.key === 'ArrowLeft' ? -1 : 1)]
        if (next) setPicked(next.month)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate, points, index])

  const actions = usePlanActions(finance ?? emptyFinance)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (query.isPending) return <Loading />
  if (!finance) return <LoadError onRetry={() => query.refetch()} />
  if (!card || !selected)
    return (
      <EmptyState
        title="Cartão não encontrado"
        action={
          <Link className="btn primary" to="/cartoes">
            Voltar pros cartões
          </Link>
        }
      >
        Ele pode ter sido excluído.
      </EmptyState>
    )

  const point = points[index]!
  const status = pointStatus(point, now)
  const comparison = chartComparison(points, selected)
  const average = chartAverage(points, now)
  const stats = cardStats(card.id, finance)
  const detail = monthDetail(card.id, point, finance, now)
  const plans = finance.plans.filter(
    (plan) =>
      plan.cardId === card.id &&
      !installmentStatus(plan, finance.payments).settled,
  )
  const subscriptions = finance.subscriptions.filter(
    (item) => item.cardId === card.id && item.active,
  )

  return (
    <>
      <StickyBar className="page-bar">
        <Link
          className="icon-button"
          to="/cartoes"
          aria-label="Voltar pros cartões"
        >
          <ChevronLeftIcon />
        </Link>
        <h2 className="page-title">{card.name}</h2>
      </StickyBar>

      <div className="card-hero">
        <div className="card-hero-art">
          <CardArt card={card} size="lg" />
        </div>
        <dl className="card-stats">
          <div>
            <dt>Parcelas em aberto</dt>
            <dd>{formatMoney(stats.outstanding)}</dd>
          </div>
          <div>
            <dt>Última parcela</dt>
            <dd>{stats.lastMonth ? monthLabel(stats.lastMonth) : 'Nenhuma'}</dd>
          </div>
          <div>
            <dt>Assinaturas</dt>
            <dd>
              {formatMoney(stats.subscriptions)}
              <span>/mês</span>
            </dd>
          </div>
        </dl>
      </div>

      <section className="block card-chart" aria-label="Fatura por mês">
        <div className="chart-top">
          <div className="chart-head" aria-live="polite">
            <small>
              {monthLabel(selected)} ·{' '}
              <span className={status.tone}>{status.text}</span>
            </small>
            <b>{formatMoney(point.total)}</b>
            <div className="change-row">
              {comparison &&
                (comparison.direction === 'equal' ? (
                  <span className="change equal">
                    igual a {monthShort(comparison.previousMonth).slice(0, 3)}
                  </span>
                ) : (
                  <span className={`change ${comparison.direction}`}>
                    <Triangle up={comparison.direction === 'up'} />
                    {formatMoney(cents(Math.abs(comparison.difference)))}
                    {comparison.percentage !== null &&
                      ` (${percent.format(comparison.percentage)}%)`}
                    <small>
                      vs {monthShort(comparison.previousMonth).slice(0, 3)}
                    </small>
                  </span>
                ))}
            </div>
          </div>
          <div className="chart-nav">
            <button
              type="button"
              className="icon-button"
              aria-label="Mês anterior"
              disabled={index <= 0}
              onClick={() => step(-1)}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Próximo mês"
              disabled={index >= points.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
        {average && (
          <p className="average">
            média {average.count} meses <b>{formatMoney(average.amount)}</b>
          </p>
        )}
        <CardChart
          points={points}
          selected={selected}
          current={now}
          onSelect={setPicked}
        />
      </section>

      <section
        className="month-detail"
        aria-label={`O que tem em ${monthName(selected).toLowerCase()}`}
      >
        <small>O que tem em {monthName(selected).toLowerCase()}</small>
        <ul>
          {detail.items.map((item) => (
            <li key={item.key}>
              <i className={`dot ${item.kind}`} />
              <span>
                {item.name}
                <small>{item.sub}</small>
              </span>
              <b>{formatMoney(item.amount)}</b>
            </li>
          ))}
          {detail.warning !== null && (
            <li className="warn">
              <span>
                Foi paga com {formatMoney(detail.warning)} a menos do que as
                partes somam hoje
              </span>
            </li>
          )}
          {detail.emptyText && (
            <li className="none">
              <span>{detail.emptyText}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="block" aria-labelledby="parcelas-cartao">
        <div className="block-head">
          <h2 id="parcelas-cartao">Parcelas</h2>
          <span className="meta">
            {plans.length ? `${plans.length} em aberto` : 'nenhuma'}
          </span>
        </div>
        {plans.length > 0 && (
          <ul className="rows">
            {plans.map((plan) => {
              const line = planLine(plan, selected, finance)
              return line ? (
                <PlanRow
                  key={plan.id}
                  line={line}
                  onToggle={() => actions.toggle(line, selected)}
                />
              ) : (
                <li className="row" key={plan.id}>
                  <span className="check-space" />
                  <div className="row-main static">
                    <span className="desc">
                      {plan.description}
                      <span className="sub">
                        nenhuma parcela em {monthShort(selected)}
                      </span>
                    </span>
                  </div>
                  <span className="trash-space" />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {subscriptions.length > 0 && (
        <section className="block" aria-labelledby="assinaturas-cartao">
          <div className="block-head">
            <h2 id="assinaturas-cartao">Assinaturas</h2>
            <span className="sum">{formatMoney(stats.subscriptions)}</span>
          </div>
          <ul className="rows">
            {subscriptions.map((item) => (
              <li className="row" key={item.id}>
                <Link className="row-main" to="/assinaturas">
                  <span className="day">
                    <small>dia</small>
                    <b>{item.chargeDay}</b>
                  </span>
                  <span className="desc">
                    {item.name}
                    {item.note && <span className="sub">{item.note}</span>}
                  </span>
                  <span className="val">{formatMoney(item.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

const emptyFinance = {
  cards: [],
  months: [],
  incomes: [],
  bills: [],
  invoices: [],
  expenses: [],
  plans: [],
  payments: [],
  subscriptions: [],
}
