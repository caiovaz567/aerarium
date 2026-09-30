import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { HeaderSlot } from '../../app/headerSlot'
import { currentMonth, parseMonth } from '../../app/paths'
import type { ExpenseRow } from '../../data/finance'
import { ops } from '../../data/financeOps'
import { today, useFinance, useFinanceOp } from '../../data/useFinance'
import { cents, formatMoney } from '../../domain/money'
import { dateBR, type Month } from '../../domain/months'
import { CardArt } from '../../ui/CardArt'
import { AddButton, TrashButton } from '../../ui/controls'
import { EmptyState } from '../../ui/EmptyState'
import { ChevronDownIcon, PlusIcon } from '../../ui/icons'
import { LoadError, Loading } from '../../ui/LoadStates'
import { useToast } from '../../ui/toastContext'
import { cardsView } from '../cartao/cardView'
import { usePlanActions } from '../cartao/planActions'
import { PlanRow } from '../cartao/PlanRow'
import { useEditor } from '../editar/editorContext'
import { ExpenseModal } from '../meses/EditModals'
import { MonthNav } from '../meses/MonthNav'
import { defaultMonth } from '../meses/monthView'
import { CardDetail } from './CardDetail'
import { OtherModal } from './OtherModal'

const ARCHIVE_KEY = 'aerarium.arquivados'
/** The installments paid apart from any card, picked like a card. */
const LOOSE = 'fora'

function readArchiveOpen() {
  try {
    return localStorage.getItem(ARCHIVE_KEY) === '1'
  } catch {
    return false
  }
}

/** Old link to one card: the same screen, with that card picked. */
export function CardRedirect() {
  const { id } = useParams()
  return <Navigate to={`/cartoes?cartao=${id}`} replace />
}

/**
 * Aba Cartões, one screen: the cards in a row, and the picked one's invoice,
 * chart and everything in it (Cartões and the card page were two screens).
 */
export function CardsPage() {
  const [params, setParams] = useSearchParams()
  const query = useFinance()
  const run = useFinanceOp()
  const toast = useToast()
  const editor = useEditor()
  const [archiveOpen, setArchiveOpen] = useState(readArchiveOpen)
  const [dialog, setDialog] = useState<{
    kind: 'expense' | 'invoice'
    id: string
  } | null>(null)
  const close = () => setDialog(null)
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
  const looseTotal = cents(
    view.loose.reduce((sum, line) => sum + line.amount, 0),
  )
  const keys = [
    ...view.blocks.map((block) => block.card.id),
    ...(view.loose.length ? [LOOSE] : []),
  ]
  const asking = params.get('cartao')
  const picked = asking && keys.includes(asking) ? asking : keys[0]
  const pathFor = (month: Month, key = picked) =>
    `/cartoes?mes=${month}${key ? `&cartao=${key}` : ''}`
  const pick = (key: string) =>
    setParams({ mes: selected, cartao: key }, { replace: true })
  const block = view.blocks.find((item) => item.card.id === picked)

  const toggleArchive = () => {
    const open = !archiveOpen
    setArchiveOpen(open)
    try {
      localStorage.setItem(ARCHIVE_KEY, open ? '1' : '0')
    } catch {
      /* private mode: just not remembered */
    }
  }
  const removeExpense = (row: ExpenseRow) => {
    run(ops.removeExpense(row))
    toast('Gasto removido', {
      label: 'Desfazer',
      onClick: () => run(ops.restoreExpense(row)),
    })
  }
  const expense =
    dialog?.kind === 'expense'
      ? finance.expenses.find((item) => item.id === dialog.id)
      : undefined
  const invoice =
    dialog?.kind === 'invoice'
      ? view.blocks.find((item) => item.invoice?.id === dialog.id)
      : undefined

  return (
    <>
      <h2 className="visually-hidden">Cartões</h2>
      <HeaderSlot>
        <MonthNav
          finance={finance}
          selected={selected}
          pathFor={(month) => pathFor(month)}
        />
        <p className="all-invoices">
          Todas as faturas <b>{formatMoney(view.totals.total)}</b>
        </p>
      </HeaderSlot>

      <div className="card-strip" role="group" aria-label="Escolher cartão">
        {view.blocks.map(({ card, invoice, total }) => (
          <button
            type="button"
            key={card.id}
            aria-pressed={card.id === picked}
            onClick={() => pick(card.id)}
          >
            <CardArt card={card} size="xs" />
            <span className="pick-name">
              <b>{card.name}</b>
              <small>{invoice ? formatMoney(total) : 'sem fatura'}</small>
            </span>
          </button>
        ))}
        {view.loose.length > 0 && (
          <button
            type="button"
            aria-pressed={picked === LOOSE}
            onClick={() => pick(LOOSE)}
          >
            <span className="card-art xs none" aria-hidden="true" />
            <span className="pick-name">
              <b>Fora dos cartões</b>
              <small>{formatMoney(looseTotal)}</small>
            </span>
          </button>
        )}
        <button
          type="button"
          className="strip-new"
          aria-label="Novo cartão"
          onClick={() => editor.card(null)}
        >
          <PlusIcon />
        </button>
      </div>

      {!view.blocks.length && (
        <EmptyState title="Nenhum cartão ainda">
          Seus cartões aparecem aqui. Toque no + pra criar o primeiro.
        </EmptyState>
      )}

      {block && (
        <CardDetail
          key={block.card.id}
          card={block.card}
          finance={finance}
          month={selected}
          onExpense={(item) => setDialog({ kind: 'expense', id: item.id })}
          onOther={() =>
            block.invoice &&
            setDialog({ kind: 'invoice', id: block.invoice.id })
          }
          onPaid={(paid) => {
            const row = block.invoice!
            const day = today()
            run(ops.invoicePaid(row, paid, day))
            toast(
              paid
                ? `Fatura ${block.card.name} paga`
                : `Fatura ${block.card.name} em aberto`,
              {
                label: 'Desfazer',
                onClick: () => run(ops.invoicePaid(row, !paid, day)),
              },
            )
          }}
        />
      )}

      {picked === LOOSE && (
        <section className="block card-block" aria-label="Fora dos cartões">
          <div className="card-head">
            <div className="card-title">
              <b>Fora dos cartões</b>
              <small>Parcelas pagas à parte</small>
            </div>
            <span className="sum">{formatMoney(looseTotal)}</span>
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

      {expense && (
        <ExpenseModal
          expense={expense}
          categories={finance.categories}
          otherPerson={finance.otherPerson}
          onClose={close}
          onDelete={() => {
            close()
            removeExpense(expense)
          }}
          onSave={(changes) => {
            run(ops.updateExpense(expense, changes))
            close()
            toast('Salvo')
          }}
        />
      )}
      {invoice?.invoice && (
        <OtherModal
          invoice={invoice.invoice}
          card={invoice.card}
          finance={finance}
          onClose={close}
          onSave={(changes) => {
            run(ops.updateInvoice(invoice.invoice!, changes))
            close()
            toast('Salvo')
          }}
        />
      )}
    </>
  )
}
