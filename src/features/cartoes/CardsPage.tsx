import { Masonry } from '../../ui/Masonry'
import { HeaderSlot } from '../../app/headerSlot'
import { cardFinal } from '../../domain/banks'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { currentMonth, parseMonth } from '../../app/paths'
import { useFinance } from '../../data/useFinance'
import { cents, formatMoney, type Cents } from '../../domain/money'
import { dateBR, monthName, type Month } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { AddButton, TrashButton } from '../../ui/controls'
import { EmptyState } from '../../ui/EmptyState'
import { ChevronDownIcon, PlusIcon } from '../../ui/icons'
import { LoadError, Loading } from '../../ui/LoadStates'
import { cardsView, type CardBlock } from '../cartao/cardView'
import { usePlanActions } from '../cartao/planActions'
import { PlanRow } from '../cartao/PlanRow'
import { useEditor } from '../editar/editorContext'
import { MonthNav } from '../meses/MonthNav'
import { defaultMonth } from '../meses/monthView'

const cardsPath = (value: Month) => `/cartoes?mes=${value}`
const ARCHIVE_KEY = 'aerarium.arquivados'

function readArchiveOpen() {
  try {
    return localStorage.getItem(ARCHIVE_KEY) === '1'
  } catch {
    return false
  }
}

/** Stacked bar: installments, subscriptions, the rest. */
function StackBar({
  parts,
  onHero = false,
}: {
  readonly parts: readonly { value: Cents; className: string }[]
  readonly onHero?: boolean
}) {
  const shown = parts.filter((part) => part.value > 0)
  const total = shown.reduce((sum, part) => sum + part.value, 0)
  return (
    <div className={`stack${onHero ? ' on-hero' : ''}`} aria-hidden="true">
      {total > 0 &&
        shown.map((part) => (
          <span
            key={part.className}
            className={part.className}
            style={{ width: `${(part.value / total) * 100}%` }}
          />
        ))}
    </div>
  )
}

function CardSection({
  block,
  month,
  final,
  onEdit,
  children,
}: {
  readonly block: CardBlock
  readonly month: Month
  /** Last 4 digits, from the bank (Open Finance). */
  readonly final: string | null
  readonly onEdit: () => void
  readonly children: ReactNode
}) {
  const { card, invoice } = block
  const status = invoice
    ? invoice.paid
      ? 'Fatura paga'
      : 'Fatura em aberto'
    : `Sem fatura em ${monthName(month).toLowerCase()}`
  const showBar =
    invoice && block.total > 0 && (block.installments || block.subscriptions)
  return (
    <section className="block card-block" aria-label={card.name}>
      <div className="card-head">
        <Link
          className="card-art-link"
          to={`/cartoes/${card.id}`}
          aria-label={`Ver gráfico de ${card.name}`}
          tabIndex={-1}
        >
          <CardArt card={card} />
        </Link>
        <Link className="card-title" to={`/cartoes/${card.id}`}>
          <b>{card.name}</b>
          <small className={invoice?.paid ? 'ok' : ''}>{status}</small>
          {(final || card.dueDay) && (
            <small>
              {[
                final && `final ${final}`,
                card.dueDay && `vence dia ${card.dueDay}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          )}
        </Link>
        {invoice && <span className="sum">{formatMoney(block.total)}</span>}
        <button
          type="button"
          className="pill-button"
          onClick={onEdit}
          aria-label={`Editar ${card.name}`}
        >
          Editar
        </button>
      </div>
      {showBar && (
        <div className="card-bar">
          <StackBar
            parts={[
              { value: block.installments, className: 'installments' },
              { value: block.subscriptions, className: 'subscriptions' },
              { value: block.other, className: 'other' },
            ]}
          />
          <div className="legend">
            {block.installments > 0 && (
              <span>
                <i className="installments" />
                Parcelas <b>{formatMoney(block.installments)}</b>
              </span>
            )}
            {block.subscriptions > 0 && (
              <span>
                <i className="subscriptions" />
                Assinaturas <b>{formatMoney(block.subscriptions)}</b>
              </span>
            )}
            {block.other > 0 && (
              <span>
                <i className="other" />
                Outros <b>{formatMoney(block.other)}</b>
              </span>
            )}
          </div>
          {block.other < 0 && (
            <p className="warnline">
              A fatura está {formatMoney(cents(-block.other))} abaixo das
              parcelas + assinaturas. Vale conferir o valor.
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

/** Aba Cartões. */
export function CardsPage() {
  const [params] = useSearchParams()
  const query = useFinance()
  const [archiveOpen, setArchiveOpen] = useState(readArchiveOpen)
  const editor = useEditor()
  const actions = usePlanActions(
    query.data ?? {
      cards: [],
      categories: [],
      months: [],
      incomes: [],
      bills: [],
      invoices: [],
      expenses: [],
      plans: [],
      payments: [],
      subscriptions: [],
      bankAccounts: [],
      bankRecords: [],
    },
  )

  if (query.isPending) return <Loading />
  if (!query.data) return <LoadError onRetry={() => query.refetch()} />
  const finance = query.data
  const refs = finance.months.map((item) => item.ref)
  const asked = parseMonth(params.get('mes'))
  const selected =
    asked && refs.includes(asked)
      ? asked
      : defaultMonth(finance, currentMonth())

  if (!selected)
    return (
      <>
        <h2 className="visually-hidden">Cartões</h2>
        <EmptyState
          title="Nenhum mês ainda"
          action={
            <Link className="btn primary" to="/meses">
              Ir pra Meses
            </Link>
          }
        >
          Crie o primeiro mês na aba Meses pra ver as faturas aqui.
        </EmptyState>
      </>
    )

  const view = cardsView(finance, selected)
  const toggleArchive = () => {
    const open = !archiveOpen
    setArchiveOpen(open)
    try {
      localStorage.setItem(ARCHIVE_KEY, open ? '1' : '0')
    } catch {
      /* private mode: just not remembered */
    }
  }

  return (
    <>
      <h2 className="visually-hidden">Cartões</h2>
      <HeaderSlot>
        <MonthNav finance={finance} selected={selected} pathFor={cardsPath} />
      </HeaderSlot>

      <section className="hero" aria-label="Resumo dos cartões">
        <div className="hero-label">Faturas de {monthName(selected)}</div>
        <p className="hero-num">{formatMoney(view.totals.total)}</p>
        <StackBar
          onHero
          parts={[
            { value: view.totals.installments, className: 'installments' },
            { value: view.totals.subscriptions, className: 'subscriptions' },
            { value: view.totals.other, className: 'other' },
          ]}
        />
        <dl className="hero-split">
          <div>
            <dt>Parcelas</dt>
            <dd>{formatMoney(view.totals.installments)}</dd>
          </div>
          <div>
            <dt>Assinaturas</dt>
            <dd>{formatMoney(view.totals.subscriptions)}</dd>
          </div>
          <div>
            <dt>Outros</dt>
            <dd>{formatMoney(view.totals.other)}</dd>
          </div>
        </dl>
        <p className="hero-foot">
          Parcelas em aberto no total: <b>{formatMoney(view.outstanding)}</b>
        </p>
      </section>

      {!view.blocks.length && (
        <EmptyState title="Nenhum cartão ainda">
          Seus cartões aparecem aqui.
        </EmptyState>
      )}

      {/* On a wide screen, the cards side by side. */}
      <Masonry>
        {view.blocks.map((block) => (
          <CardSection
            key={block.card.id}
            block={block}
            month={selected}
            final={cardFinal(
              finance.bankAccounts.find((item) => item.cardId === block.card.id)
                ?.number,
            )}
            onEdit={() => editor.card(block.card.id)}
          >
            {(block.plans.length > 0 || block.subscriptionNames.length > 0) && (
              <ul className="rows">
                {block.plans.map((line) => (
                  <PlanRow
                    key={line.plan.id}
                    line={line}
                    onToggle={() => actions.toggle(line, selected)}
                    onOpen={() => editor.plan(line.plan.id)}
                    onDelete={() => actions.remove(line.plan)}
                  />
                ))}
                {block.subscriptionNames.length > 0 && (
                  <li className="row">
                    <span className="check-space" />
                    <Link className="row-main" to="/assinaturas">
                      <span className="desc">
                        {block.subscriptionNames.length === 1
                          ? '1 assinatura'
                          : `${block.subscriptionNames.length} assinaturas`}
                        <span className="sub link-button">
                          {block.subscriptionNames.join(', ')}
                        </span>
                      </span>
                      <span className="val">
                        {formatMoney(block.subscriptions)}
                      </span>
                    </Link>
                    <span className="trash-space" />
                  </li>
                )}
              </ul>
            )}
            <AddButton
              onClick={() => editor.plan(null, { cardId: block.card.id })}
            >
              Parcela neste cartão
            </AddButton>
          </CardSection>
        ))}

        {view.loose.length > 0 && (
          <section className="block card-block" aria-label="Fora dos cartões">
            <div className="card-head">
              <div className="card-title">
                <b>Fora dos cartões</b>
                <small>Parcelas pagas à parte</small>
              </div>
              <span className="sum">
                {formatMoney(
                  cents(view.loose.reduce((sum, line) => sum + line.amount, 0)),
                )}
              </span>
            </div>
            <ul className="rows">
              {view.loose.map((line) => (
                <PlanRow
                  key={line.plan.id}
                  line={line}
                  onToggle={() => actions.toggle(line, selected)}
                  onOpen={() => editor.plan(line.plan.id)}
                  onDelete={() => actions.remove(line.plan)}
                />
              ))}
            </ul>
            <AddButton onClick={() => editor.plan(null, { cardId: null })}>
              Parcela fora de cartão
            </AddButton>
          </section>
        )}
      </Masonry>

      <button
        type="button"
        className="new-card"
        onClick={() => editor.card(null)}
      >
        <PlusIcon />
        Novo cartão
      </button>

      <section className="block">
        <button
          type="button"
          className="archive-head"
          aria-expanded={archiveOpen}
          onClick={toggleArchive}
        >
          <span>Arquivados</span>
          <span className="meta">
            {view.archived.length
              ? `${view.archived.length} quitado${view.archived.length > 1 ? 's' : ''}`
              : 'vazio'}
          </span>
          <ChevronDownIcon />
        </button>
        {archiveOpen && !view.archived.length && (
          <p className="empty-hint bordered">
            Quando você pagar a última parcela de um parcelamento, ele vem pra
            cá.
          </p>
        )}
        {archiveOpen && view.archived.length > 0 && (
          <ul className="rows bordered">
            {view.archived.map(({ plan, settledOn, paidCount, card }) => (
              <li className="row" key={plan.id}>
                <button
                  type="button"
                  className="row-main"
                  onClick={() => editor.plan(plan.id)}
                >
                  {card ? (
                    <CardArt card={card} size="xs" />
                  ) : (
                    <span className="card-art xs none" aria-hidden="true" />
                  )}
                  <span className="desc">
                    {plan.description}
                    <span className="sub">
                      {[
                        settledOn
                          ? `Quitado em ${dateBR(settledOn)}`
                          : 'Quitado',
                        `${paidCount} pagamento${paidCount > 1 ? 's' : ''}`,
                        card?.name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="val">
                    {formatMoney(plan.installmentAmount)}
                  </span>
                </button>
                <TrashButton
                  label={plan.description}
                  onClick={() => actions.remove(plan)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
