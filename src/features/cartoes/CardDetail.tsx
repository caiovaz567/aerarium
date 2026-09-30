import { useState } from 'react'
import { today } from '../../data/useFinance'
import type { Card, ExpenseRow, Finance } from '../../data/finance'
import { chargedIn } from '../../domain/cardDates'
import { installmentStatus } from '../../domain/installments'
import { bankFillsOther } from '../../domain/invoices'
import { formatMoney, sumMoney } from '../../domain/money'
import {
  monthLabel,
  monthName,
  monthShort,
  type Month,
} from '../../domain/months'
import { instantToSaoPaulo } from '../../domain/timeline'
import { CardArt } from '../../ui/CardArt'
import { CategoryBadge } from '../../ui/CategoryBadge'
import { AddButton } from '../../ui/controls'
import { CardIcon, CheckIcon, RepeatIcon } from '../../ui/icons'
import { PageColumns } from '../../ui/PageColumns'
import { BankTotalModal } from '../cartao/BankTotalModal'
import {
  cardInvoiceView,
  cardStats,
  dayLabel,
  planLine,
  purchaseDays,
  shortDate,
} from '../cartao/cardView'
import { usePlanActions } from '../cartao/planActions'
import { PlanRow } from '../cartao/PlanRow'
import { useEditor } from '../editar/editorContext'
import { CardChartBlock } from './CardChartBlock'

type List = 'tudo' | 'compras' | 'parcelas' | 'assinaturas'

const STATUS = { open: 'a pagar', paid: 'paga', none: 'sem fatura' } as const

/**
 * One card in Cartões: its invoice for the month on the side, then the chart
 * and one list with everything in the invoice, the newest purchase first.
 * Tapping a row opens it to change anything.
 */
export function CardDetail({
  card,
  finance,
  month,
  onExpense,
  onInvoice,
  onPaid,
}: {
  readonly card: Card
  readonly finance: Finance
  readonly month: Month
  readonly onExpense: (expense: ExpenseRow) => void
  /** The invoice window, for the undetailed rest. */
  readonly onInvoice: () => void
  readonly onPaid: (paid: boolean) => void
}) {
  const editor = useEditor()
  const actions = usePlanActions(finance)
  const [list, setList] = useState<List>('tudo')
  const [typingBank, setTypingBank] = useState(false)

  const view = cardInvoiceView(card, finance, month, today())
  const other = finance.otherPerson ?? null
  const categoryOf = (id: string | null | undefined) =>
    finance.categories.find((item) => item.id === id) ?? null

  const days = purchaseDays(card.id, month, finance)
  const purchases = days.reduce((sum, day) => sum + day.items.length, 0)
  const newest = days[0]?.items[0]?.id
  const lines = finance.plans
    .filter((plan) => plan.cardId === card.id)
    .flatMap((plan) => planLine(plan, month, finance) ?? [])
  const subscriptions = finance.subscriptions.filter(
    (item) => item.cardId === card.id && item.active,
  )
  const rest =
    view.invoice && view.invoice.otherAmount > 0 ? view.invoice : null
  const monthly = lines.length + subscriptions.length + (rest ? 1 : 0)
  const openPlans = finance.plans.filter(
    (plan) =>
      plan.cardId === card.id &&
      !installmentStatus(plan, finance.payments).settled,
  )
  const stats = cardStats(card.id, finance)
  const charged = sumMoney(
    subscriptions
      .filter((item) => chargedIn(item, month))
      .map((item) => item.amount),
  )
  const name = monthName(month).toLowerCase()

  const purchaseRows = days.map(({ day, items }) => (
    <li key={day} className="feed-day">
      <h4>{dayLabel(day)}</h4>
      <ul>
        {items.map((expense) => {
          const category = categoryOf(expense.categoryId)
          const time = expense.occurredAt
            ? instantToSaoPaulo(expense.occurredAt).slice(11)
            : null
          return (
            <li key={expense.id}>
              <button
                type="button"
                className={`feed-row${expense.id === newest ? ' newest' : ''}`}
                onClick={() => onExpense(expense)}
              >
                <CategoryBadge category={category} shape="round" />
                <span className="feed-text">
                  <span className="feed-name">
                    {expense.description}
                    {expense.id === newest && (
                      <span className="feed-tag last">última</span>
                    )}
                    {other && expense.forOther && (
                      <span className="feed-tag other">{other}</span>
                    )}
                  </span>
                  <small>
                    {[expense.note, category?.name, time]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <b>{formatMoney(expense.amount)}</b>
              </button>
            </li>
          )
        })}
      </ul>
    </li>
  ))

  const monthlyRows = monthly > 0 && (
    <li className="feed-day">
      <h4>Todo mês</h4>
      <ul>
        {lines.map((line) => (
          <li key={line.plan.id}>
            <button
              type="button"
              className="feed-row"
              onClick={() => editor.plan(line.plan.id)}
            >
              <CategoryBadge
                category={categoryOf(line.plan.categoryId)}
                shape="round"
              />
              <span className="feed-text">
                <span className="feed-name">{line.plan.description}</span>
                <small>
                  parcela {line.number}/{line.totalInstallments}
                  <span className="feed-progress" aria-hidden="true">
                    <span
                      style={{
                        width: `${(line.number / line.totalInstallments) * 100}%`,
                      }}
                    />
                  </span>
                </small>
              </span>
              <b>{formatMoney(line.amount)}</b>
            </button>
          </li>
        ))}
        {subscriptions.map((item) => {
          const later = !chargedIn(item, month)
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`feed-row${later ? ' later' : ''}`}
                onClick={() => editor.subscription(item.id)}
              >
                <span className="cat-badge round none" aria-hidden="true">
                  <RepeatIcon />
                </span>
                <span className="feed-text">
                  <span className="feed-name">{item.name}</span>
                  <small>
                    {[
                      `assinatura · dia ${item.chargeDay}`,
                      later &&
                        item.firstMonth &&
                        `entra a partir de ${monthLabel(item.firstMonth).toLowerCase()}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <b>{formatMoney(item.amount)}</b>
              </button>
            </li>
          )
        })}
        {rest && (
          <li>
            <button type="button" className="feed-row" onClick={onInvoice}>
              <span className="cat-badge round none" aria-hidden="true">
                <CardIcon />
              </span>
              <span className="feed-text">
                <span className="feed-name">
                  {purchases ? 'Outros gastos não detalhados' : 'Outros gastos'}
                </span>
                <small>o resto da fatura</small>
              </span>
              <b>{formatMoney(rest.otherAmount)}</b>
            </button>
          </li>
        )}
      </ul>
    </li>
  )

  const noPurchases = (
    <p className="list-meta">
      {view.invoice
        ? `Nenhuma compra lançada em ${name}`
        : `Nenhuma fatura desse cartão em ${name}`}
    </p>
  )

  return (
    <PageColumns
      sideLeft
      side={
        <section className="card-hero" aria-label={`Fatura de ${name}`}>
          <div className="card-hero-head">
            <CardArt card={card} />
            <div>
              <b>{card.name}</b>
              {view.final && <small>final {view.final}</small>}
            </div>
            <button
              type="button"
              className="pill-button"
              onClick={() => editor.card(card.id)}
              aria-label={`Editar ${card.name}`}
            >
              Editar
            </button>
          </div>
          <div className="card-hero-sum">
            <small>
              {other ? 'Sua parte da fatura' : 'Fatura'} de {name} ·{' '}
              <span className={`status ${view.status}`}>
                {STATUS[view.status]}
              </span>
            </small>
            <b>{formatMoney(view.total)}</b>
            {view.due && view.dueText && (
              <small>
                vence {shortDate(view.due)} · {view.dueText}
              </small>
            )}
          </div>
          {other && view.invoice && (
            <div className="card-hero-split">
              {bankFillsOther(view.invoice.month, finance) && (
                <button type="button" onClick={() => setTypingBank(true)}>
                  <small>Total no banco</small>
                  <b>
                    {view.bankTotal === null
                      ? 'Digitar'
                      : formatMoney(view.bankTotal)}
                  </b>
                </button>
              )}
              <div className="other">
                <small>Parte do {other}</small>
                <b>{formatMoney(view.otherShare)}</b>
              </div>
            </div>
          )}
          {view.invoice && (
            <button
              type="button"
              className="card-hero-pay"
              aria-pressed={view.invoice.paid}
              onClick={() => onPaid(!view.invoice!.paid)}
            >
              <CheckIcon />
              {view.invoice.paid ? 'Fatura paga' : 'Marcar fatura como paga'}
            </button>
          )}
          {view.limit && (
            <div className="card-hero-limit" aria-label="Limite">
              <small>
                Limite livre <b>{formatMoney(view.limit.available)}</b> de{' '}
                {formatMoney(view.limit.total)}
              </small>
              <span className="limit-bar" aria-hidden="true">
                <span style={{ width: `${view.limit.share * 100}%` }} />
              </span>
            </div>
          )}
          {view.nextDue || view.bestDay ? (
            <dl className="card-hero-dates">
              <div>
                <dt>Próxima fatura</dt>
                <dd>{view.nextDue ? shortDate(view.nextDue) : 'sem dia'}</dd>
              </div>
              <div>
                <dt>Melhor dia pra comprar</dt>
                <dd>
                  {view.bestDay ? `dia ${view.bestDay}` : 'sem fechamento'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="card-dates-hint">
              Coloca o dia de fechamento e o de vencimento em{' '}
              <button type="button" onClick={() => editor.card(card.id)}>
                Editar
              </button>{' '}
              pra ver o vencimento e o melhor dia pra comprar.
            </p>
          )}
          {typingBank && view.invoice && other && (
            <BankTotalModal
              invoice={view.invoice}
              other={other}
              onClose={() => setTypingBank(false)}
            />
          )}
        </section>
      }
    >
      <CardChartBlock card={card} finance={finance} month={month} />

      <section className="block card-lists" aria-label={`Na fatura de ${name}`}>
        <div
          className="segmented views"
          role="group"
          aria-label="Ver da fatura"
        >
          {(
            [
              ['tudo', `Tudo · ${purchases + monthly}`],
              ['compras', `Compras · ${purchases}`],
              ['parcelas', `Parcelas · ${openPlans.length}`],
              ['assinaturas', `Assinaturas · ${subscriptions.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={list === key}
              onClick={() => setList(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {list === 'tudo' && (
          <div>
            {!purchases && noPurchases}
            <ul className="feed">
              {purchaseRows}
              {monthlyRows}
            </ul>
          </div>
        )}

        {list === 'compras' && (
          <div>
            {purchases ? <ul className="feed">{purchaseRows}</ul> : noPurchases}
          </div>
        )}

        {list === 'parcelas' && (
          <section aria-label="Parcelas">
            <p className="list-meta">
              {openPlans.length
                ? `${openPlans.length} em aberto · ${formatMoney(stats.outstanding)}${
                    stats.lastMonth
                      ? ` até ${monthLabel(stats.lastMonth).toLowerCase()}`
                      : ''
                  }`
                : 'Nenhum parcelamento em aberto'}
            </p>
            {openPlans.length > 0 && (
              <ul className="rows">
                {openPlans.map((plan) => {
                  const line = planLine(plan, month, finance)
                  return line ? (
                    <PlanRow
                      key={plan.id}
                      line={line}
                      onToggle={() => actions.toggle(line, month)}
                      onOpen={() => editor.plan(plan.id)}
                      onDelete={() => actions.remove(plan)}
                    />
                  ) : (
                    <li className="row" key={plan.id}>
                      <span className="check-space" />
                      <button
                        type="button"
                        className="row-main"
                        onClick={() => editor.plan(plan.id)}
                      >
                        <span className="desc">
                          {plan.description}
                          <span className="sub">
                            nenhuma parcela em {monthShort(month)}
                          </span>
                        </span>
                      </button>
                      <span className="trash-space" />
                    </li>
                  )
                })}
              </ul>
            )}
            <AddButton onClick={() => editor.plan(null, { cardId: card.id })}>
              Parcela neste cartão
            </AddButton>
          </section>
        )}

        {list === 'assinaturas' && (
          <section aria-label="Assinaturas do cartão">
            <p className="list-meta">
              {subscriptions.length
                ? `${formatMoney(charged)} em ${name}`
                : 'Nenhuma assinatura neste cartão'}
            </p>
            {subscriptions.length > 0 && (
              <ul className="rows">
                {subscriptions.map((item) => {
                  const later = !chargedIn(item, month)
                  return (
                    <li className={`row${later ? ' later' : ''}`} key={item.id}>
                      <button
                        type="button"
                        className="row-main"
                        onClick={() => editor.subscription(item.id)}
                      >
                        <span className="day">
                          <small>dia</small>
                          <b>{item.chargeDay}</b>
                        </span>
                        <span className="desc">
                          {item.name}
                          {(later || item.note) && (
                            <span className="sub">
                              {[
                                later &&
                                  item.firstMonth &&
                                  `entra a partir de ${monthLabel(item.firstMonth).toLowerCase()}`,
                                item.note,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </span>
                        <span className="val">{formatMoney(item.amount)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </section>
    </PageColumns>
  )
}
