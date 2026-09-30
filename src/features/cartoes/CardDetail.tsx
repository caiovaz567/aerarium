import { useState } from 'react'
import { today } from '../../data/useFinance'
import type { Card, ExpenseRow, Finance, PlanRow } from '../../data/finance'
import { chargedIn } from '../../domain/cardDates'
import type { CardPart } from '../../domain/chartSeries'
import { installmentStatus } from '../../domain/installments'
import { bankFillsOther } from '../../domain/invoices'
import { cents, formatMoney, sumMoney } from '../../domain/money'
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
import { Button } from '@heroui/react'
import { CardIcon, RepeatIcon } from '../../ui/icons'
import { PageColumns } from '../../ui/PageColumns'
import { BankTotalModal } from '../cartao/BankTotalModal'
import {
  cardInvoiceView,
  dayLabel,
  planLine,
  purchaseDays,
  shortDate,
} from '../cartao/cardView'
import { useEditor } from '../editar/editorContext'
import { visibleNote } from '../meses/monthView'
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
  part,
  onExpense,
  onOther,
  onPaid,
}: {
  readonly card: Card
  readonly finance: Finance
  readonly month: Month
  /** Eu | Pai: everything, yours only, or the other person's only. */
  readonly part: CardPart
  readonly onExpense: (expense: ExpenseRow) => void
  /** "Outros gastos" and the note of the invoice. */
  readonly onOther: () => void
  readonly onPaid: (paid: boolean) => void
}) {
  const editor = useEditor()
  const [list, setList] = useState<List>('tudo')
  const [typingBank, setTypingBank] = useState(false)

  const view = cardInvoiceView(card, finance, month, today())
  const other = finance.otherPerson ?? null
  const categoryOf = (id: string | null | undefined) =>
    finance.categories.find((item) => item.id === id) ?? null

  // Eu | Pai: only what is theirs, or only what is yours.
  const whose = (forOther: boolean | undefined) =>
    part === 'total' || (part === 'other') === Boolean(forOther)
  const days = purchaseDays(card.id, month, finance)
    .map((day) => ({
      ...day,
      items: day.items.filter((item) => whose(item.forOther)),
    }))
    .filter((day) => day.items.length > 0)
  const purchases = days.reduce((sum, day) => sum + day.items.length, 0)
  const newest = days[0]?.items[0]?.id
  const lines = finance.plans
    .filter((plan) => plan.cardId === card.id && whose(plan.forOther))
    .flatMap((plan) => planLine(plan, month, finance) ?? [])
  // Subscriptions and the invoice's rest are the owner's.
  const subscriptions =
    part === 'other'
      ? []
      : finance.subscriptions.filter(
          (item) => item.cardId === card.id && item.active,
        )
  // The invoice's rest: always there, so it can be filled in.
  const rest = part === 'other' ? null : view.invoice
  const restNote = rest && visibleNote(rest.note, card)
  const monthly = lines.length + subscriptions.length + (rest ? 1 : 0)
  const openPlans = finance.plans
    .filter((plan) => plan.cardId === card.id && whose(plan.forOther))
    .map((plan) => ({
      plan,
      status: installmentStatus(plan, finance.payments),
    }))
    .filter((item) => !item.status.settled)
  const outstanding = sumMoney(openPlans.map((item) => item.status.outstanding))
  const lastMonth = openPlans
    .map((item) => item.status.lastMonth)
    .sort()
    .pop()
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

  // One style for every row: category tile, name, details and value.
  const planRow = (plan: PlanRow) => {
    const line = planLine(plan, month, finance)
    const status = installmentStatus(plan, finance.payments)
    const category = categoryOf(plan.categoryId)
    return (
      <li key={plan.id}>
        <button
          type="button"
          className={`feed-row${line ? '' : ' later'}`}
          onClick={() => editor.plan(plan.id)}
        >
          <CategoryBadge category={category} shape="round" />
          <span className="feed-text">
            <span className="feed-name">{plan.description}</span>
            <small>
              {[
                category?.name,
                line
                  ? `parcela ${line.number}/${line.totalInstallments}`
                  : `nenhuma parcela em ${monthShort(month)}`,
                status.remaining ? `faltam ${status.remaining}` : 'quitado',
              ]
                .filter(Boolean)
                .join(' · ')}
              {line && (
                <span className="feed-progress" aria-hidden="true">
                  <span
                    style={{
                      width: `${(line.number / line.totalInstallments) * 100}%`,
                    }}
                  />
                </span>
              )}
            </small>
          </span>
          <b>{formatMoney(line?.amount ?? plan.installmentAmount)}</b>
        </button>
      </li>
    )
  }
  const subscriptionRow = (item: (typeof subscriptions)[number]) => {
    const later = !chargedIn(item, month)
    const category = categoryOf(item.categoryId)
    return (
      <li key={item.id}>
        <button
          type="button"
          className={`feed-row${later ? ' later' : ''}`}
          onClick={() => editor.subscription(item.id)}
        >
          {category ? (
            <CategoryBadge category={category} shape="round" />
          ) : (
            <span className="cat-badge round none" aria-hidden="true">
              <RepeatIcon />
            </span>
          )}
          <span className="feed-text">
            <span className="feed-name">{item.name}</span>
            <small>
              {[
                category?.name ?? 'assinatura',
                `dia ${item.chargeDay}`,
                later &&
                  item.firstMonth &&
                  `entra a partir de ${monthLabel(item.firstMonth).toLowerCase()}`,
                item.note,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </span>
          <b>{formatMoney(item.amount)}</b>
        </button>
      </li>
    )
  }

  const monthlyRows = monthly > 0 && (
    <li className="feed-day">
      <h4>Todo mês</h4>
      <ul>
        {lines.map((line) => planRow(line.plan))}
        {subscriptions.map(subscriptionRow)}
        {rest && (
          <li>
            <button
              type="button"
              className={`feed-row${rest.otherAmount > 0 ? '' : ' later'}`}
              onClick={onOther}
            >
              <span className="cat-badge round none" aria-hidden="true">
                <CardIcon />
              </span>
              <span className="feed-text">
                <span className="feed-name">
                  {purchases ? 'Outros gastos não detalhados' : 'Outros gastos'}
                </span>
                <small>
                  {restNote ??
                    (rest.otherAmount > 0
                      ? 'o resto da fatura'
                      : 'nenhum, toque pra colocar')}
                </small>
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
      {!view.invoice
        ? `Nenhuma fatura desse cartão em ${name}`
        : part === 'other'
          ? `Nenhuma compra do ${other} em ${name}`
          : `Nenhuma compra lançada em ${name}`}
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
              {part === 'mine'
                ? `Sua parte da fatura de ${name}`
                : part === 'other'
                  ? `Parte do ${other} na fatura de ${name}`
                  : `Fatura de ${name}`}{' '}
              ·{' '}
              <span className={`status ${view.status}`}>
                {STATUS[view.status]}
              </span>
            </small>
            <b>
              {formatMoney(
                part === 'mine'
                  ? view.mine
                  : part === 'other'
                    ? view.otherShare
                    : view.total,
              )}
            </b>
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
              {part === 'other' ? (
                <div>
                  <small>Sua parte</small>
                  <b>{formatMoney(view.mine)}</b>
                </div>
              ) : (
                <div className="other">
                  <small>Parte do {other}</small>
                  <b>{formatMoney(view.otherShare)}</b>
                </div>
              )}
            </div>
          )}
          {view.invoice && (
            <Button
              variant={view.invoice.paid ? 'tertiary' : 'secondary'}
              fullWidth
              onPress={() => onPaid(!view.invoice!.paid)}
            >
              {view.invoice.paid
                ? 'Fatura paga · desmarcar'
                : 'Marcar fatura como paga'}
            </Button>
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
      <CardChartBlock card={card} finance={finance} month={month} part={part} />

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
                ? `${openPlans.length} em aberto · ${formatMoney(cents(outstanding))}${
                    lastMonth
                      ? ` até ${monthLabel(lastMonth).toLowerCase()}`
                      : ''
                  }`
                : 'Nenhum parcelamento em aberto'}
            </p>
            {openPlans.length > 0 && (
              <ul className="feed">
                <li className="feed-day">
                  <ul>{openPlans.map((item) => planRow(item.plan))}</ul>
                </li>
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
                : part === 'other'
                  ? 'As assinaturas são suas'
                  : 'Nenhuma assinatura neste cartão'}
            </p>
            {subscriptions.length > 0 && (
              <ul className="feed">
                <li className="feed-day">
                  <ul>{subscriptions.map(subscriptionRow)}</ul>
                </li>
              </ul>
            )}
          </section>
        )}
      </section>
    </PageColumns>
  )
}
