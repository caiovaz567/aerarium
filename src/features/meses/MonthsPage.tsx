import { useProfile } from '../../app/profileContext'
import { useEffect, useState, type MouseEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { HeaderSlot } from '../../app/headerSlot'
import { useWide } from '../../app/headerSlotContext'
import { rememberScroll, takeScroll } from '../../app/scrollBack'
import { currentMonth, monthPath, parseMonth } from '../../app/paths'
import type {
  BillRow,
  ExpenseRow,
  Finance,
  IncomeRow,
} from '../../data/finance'
import type { OutflowItem } from '../../domain/categories'
import { ops } from '../../data/financeOps'
import { today, useFinance, useFinanceOp } from '../../data/useFinance'
import { monthLabel, monthName, type Month } from '../../domain/months'
import { addMonths } from '../../domain/months'
import { EmptyState } from '../../ui/EmptyState'
import { SharedEntry } from '../compartilhado/SharedEntry'
import { LoadError, Loading } from '../../ui/LoadStates'
import { useToast } from '../../ui/toastContext'
import { useEditor } from '../editar/editorContext'
import { BillModal, ExpenseModal, IncomeModal } from './EditModals'
import { expenseMonth, expenseMonths, saveExpense } from './expenseMove'
import { IncomesBlock } from './MonthBlocks'
import { OtherMonth } from './OtherMonth'
import { OwedBlock } from './OwedBlock'
import { paidBack } from './paidBack'
import { ProfileSwitch } from './ProfileSwitch'
import { OutflowViews } from './OutflowViews'
import { NewMonthModal } from './MonthModals'
import { MonthNav } from './MonthNav'
import { MonthSummary } from './MonthSummary'
import { MoneyPlaces } from './MoneyPlaces'
import { forecastFinance, forecastUntil } from './forecast'
import {
  buildNewMonth,
  defaultMonth,
  monthView,
  type CardOutflow,
  type LooseOutflow,
} from './monthView'

type Dialog =
  | { readonly kind: 'income'; readonly id: string }
  | { readonly kind: 'bill'; readonly id: string }
  | { readonly kind: 'expense'; readonly id: string }
  | {
      readonly kind: 'new'
      readonly target: Month
      readonly previous: Month | null
    }

/** /meses and /: opens today's month, or the closest one that exists. */
export function MonthsIndex() {
  const query = useFinance()
  if (query.isPending) return <Loading />
  const target = query.data && defaultMonth(query.data, currentMonth())
  return <Navigate to={monthPath(target ?? currentMonth())} replace />
}

export function MonthsPage() {
  const { ym } = useParams()
  const navigate = useNavigate()
  const query = useFinance()
  const run = useFinanceOp()
  const toast = useToast()
  const editor = useEditor()
  const wide = useWide()
  const { profile } = useProfile(query.data?.otherPerson)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)
  // Like v1: a new month starts from the top; back from a card in Cartões,
  // where it was. Braces matter: newer browsers return a promise from scrollTo.
  useEffect(() => {
    window.scrollTo(0, takeScroll(`/meses/${ym}`) ?? 0)
  }, [ym])

  if (query.isPending) return <Loading />
  // A failed background reload keeps showing what is already loaded.
  if (!query.data) return <LoadError onRetry={() => query.refetch()} />

  const finance: Finance = query.data
  const refs = finance.months.map((item) => item.ref)
  const selected = parseMonth(ym)
  const last = refs[refs.length - 1]

  const createMonth = (
    target: Month,
    previous: Month | null,
    options: { copy: boolean; carryover: boolean },
  ) => {
    run(ops.createMonth(buildNewMonth(finance, target, previous, options)))
    close()
    navigate(monthPath(target))
    toast(`${monthLabel(target)} criado`)
  }
  const newMonthDialog = dialog?.kind === 'new' && (
    <NewMonthModal
      finance={finance}
      target={dialog.target}
      previous={dialog.previous}
      onClose={close}
      onCreate={(options) =>
        createMonth(dialog.target, dialog.previous, options)
      }
    />
  )

  if (!last)
    return (
      <>
        <h2 className="visually-hidden">Meses</h2>
        <SharedEntry />
        <EmptyState
          title="Nenhum mês ainda"
          action={
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                setDialog({
                  kind: 'new',
                  target: currentMonth(),
                  previous: null,
                })
              }
            >
              Criar {monthLabel(currentMonth())}
            </button>
          }
        >
          Crie o primeiro mês pra começar.
        </EmptyState>
        {newMonthDialog}
      </>
    )

  // Past the last month: a forecast, as if it had been created (not saved).
  const until = forecastUntil(finance)
  const forecast =
    selected !== null && selected > last && until !== null && selected <= until
  if (!selected || (!refs.includes(selected) && !forecast))
    return (
      <Navigate
        to={monthPath(defaultMonth(finance, currentMonth()) ?? last)}
        replace
      />
    )

  const shown = forecast ? forecastFinance(finance, selected) : finance
  // A forecast is only for looking: its rows are not saved, so nothing opens.
  // Switching views, filtering and opening a card's items still work.
  const onlyLook = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('.segmented, .card-filter, [aria-expanded]')) return
    event.preventDefault()
    event.stopPropagation()
  }
  const view = monthView(shown, selected)

  const deleteIncome = (income: IncomeRow) => {
    run(ops.removeIncome(income))
    close()
    toast(`${income.description} excluído`, {
      label: 'Desfazer',
      onClick: () => run(ops.restoreIncome(income)),
    })
  }
  const deleteBill = (bill: BillRow) => {
    run(ops.removeBill(bill))
    close()
    toast(`${bill.description} excluído`, {
      label: 'Desfazer',
      onClick: () => run(ops.restoreBill(bill)),
    })
  }
  const deleteInvoice = ({ invoice, card }: CardOutflow) => {
    const expenses = finance.expenses.filter(
      (item) => item.invoiceId === invoice.id,
    )
    run(ops.removeInvoice(invoice))
    toast(`Fatura ${card.name} excluída`, {
      label: 'Desfazer',
      onClick: () => run(ops.restoreInvoice(invoice, expenses, today())),
    })
  }
  const loosePaid = (item: LooseOutflow, paid: boolean) => {
    const day = today()
    run(ops.loosePaid(item.plan, selected, paid, day))
    const remaining = item.remaining + (paid ? -1 : 1)
    toast(
      paid
        ? `${item.plan.description}: ${remaining ? `faltam ${remaining}` : 'quitado'}`
        : `${item.plan.description}: pagamento desfeito`,
      {
        label: 'Desfazer',
        onClick: () => run(ops.loosePaid(item.plan, selected, !paid, day)),
      },
    )
  }

  const income =
    dialog?.kind === 'income'
      ? view.incomes.find((item) => item.id === dialog.id)
      : undefined
  const bill =
    dialog?.kind === 'bill'
      ? view.bills.find((item) => item.id === dialog.id)
      : undefined
  // A card's invoice lives in Cartões, with everything in it.
  const openInvoice = (invoiceId: string) => {
    const row = finance.invoices.find((item) => item.id === invoiceId)
    if (!row) return
    rememberScroll(`/meses/${ym}`)
    navigate(`/cartoes?mes=${row.month}&cartao=${row.cardId}`, {
      state: { from: 'meses' },
    })
  }
  const expense =
    dialog?.kind === 'expense'
      ? finance.expenses.find((item) => item.id === dialog.id)
      : undefined
  const removeExpense = (row: ExpenseRow) => {
    run(ops.removeExpense(row))
    toast('Gasto removido', {
      label: 'Desfazer',
      onClick: () => run(ops.restoreExpense(row)),
    })
  }
  const openOutflow = (item: OutflowItem) => {
    if (item.source === 'bill') setDialog({ kind: 'bill', id: item.id })
    else if (item.source === 'expense')
      setDialog({ kind: 'expense', id: item.id })
    else if (item.source === 'other') openInvoice(item.id)
    else if (item.source === 'installment') editor.plan(item.id)
    else editor.subscription(item.id)
  }

  const summary = <MonthSummary month={selected} balance={view.balance} />
  // "Pai pagou", in your view and in his: settles his part of the month.
  const otherPaid = (income: IncomeRow) => {
    run(ops.restoreIncome(income))
    toast(`${income.description}: parte dele acertada`, {
      label: 'Desfazer',
      onClick: () => run(ops.removeIncome(income)),
    })
  }
  const undoPaid = () => {
    const back = paidBack(finance, selected)
    for (const income of back) run(ops.removeIncome(income))
    toast(`${finance.otherPerson} pagou: desfeito`, {
      label: 'Refazer',
      onClick: () => {
        for (const income of back) run(ops.restoreIncome(income))
      },
    })
  }
  const owed = finance.otherPerson && (
    <OwedBlock
      finance={shown}
      month={selected}
      owed={view.balance.otherOwed}
      due={view.balance.otherDue}
      onPaid={otherPaid}
      onUndo={undoPaid}
    />
  )
  const outflows = (
    <OutflowViews
      finance={shown}
      month={selected}
      onOpen={openOutflow}
      view={view}
      categories={finance.categories}
      onInvoice={(item) => openInvoice(item.invoice.id)}
      onInvoicePaid={(item, paid) =>
        run(ops.invoicePaid(item.invoice, paid, today()))
      }
      onInvoiceDelete={deleteInvoice}
      onLoosePaid={loosePaid}
      onLooseOpen={(item) => editor.plan(item.plan.id)}
      onBill={(item) => setDialog({ kind: 'bill', id: item.id })}
      onBillPaid={(item, paid) => run(ops.billPaid(item, paid, today()))}
      onBillDelete={deleteBill}
    />
  )
  const incomes = (
    <IncomesBlock
      incomes={view.incomes}
      total={view.balance.incomes}
      carryHint={view.carryHint}
      onEdit={(item) => setDialog({ kind: 'income', id: item.id })}
      onDelete={deleteIncome}
      onUseCarry={(hint) => {
        run(
          ops.updateIncome(hint.income, {
            description: hint.income.description,
            amount: hint.available,
          }),
        )
        toast(`Sobra de ${monthName(hint.previous)} colocada`)
      }}
    />
  )

  return (
    <>
      <h2 className="visually-hidden">Meses</h2>
      <SharedEntry />
      <HeaderSlot>
        {finance.otherPerson && <ProfileSwitch other={finance.otherPerson} />}
        <MonthNav
          finance={finance}
          selected={selected}
          pathFor={monthPath}
          forecastUntil={until}
        />
      </HeaderSlot>
      {forecast && (
        <section className="forecast-note" aria-label="Previsão">
          <p>
            <b>Previsão.</b> {monthName(selected)} ainda não foi criado: aqui
            estão as parcelas, as assinaturas e o que se repete do último mês.
          </p>
          {selected === addMonths(last, 1) && (
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                setDialog({ kind: 'new', target: selected, previous: last })
              }
            >
              Criar {monthLabel(selected)}
            </button>
          )}
        </section>
      )}
      {newMonthDialog}
      {/* One column on phones; on a wide screen, the summary and Saídas on
          the left, what the other person owes and Entradas beside them. */}
      <div
        className={[
          'month-grid',
          wide && profile !== 'other' && 'page-cols',
          forecast && 'forecast-view',
        ]
          .filter(Boolean)
          .join(' ')}
        onClickCapture={forecast ? onlyLook : undefined}
      >
        {profile === 'other' ? (
          <OtherMonth
            finance={shown}
            month={selected}
            owed={view.balance.otherOwed}
            due={view.balance.otherDue}
            onOpen={openOutflow}
            onPaid={otherPaid}
            onUndo={undoPaid}
          />
        ) : (
          <>
            {wide ? (
              <>
                <div className="page-main">
                  {summary}
                  {outflows}
                </div>
                <div className="page-side">
                  {owed}
                  {incomes}
                  <MoneyPlaces finance={shown} month={selected} />
                </div>
              </>
            ) : (
              <>
                {summary}
                {owed}
                {outflows}
                {incomes}
              </>
            )}
          </>
        )}
      </div>

      {income && (
        <IncomeModal
          income={income}
          onClose={close}
          onDelete={() => deleteIncome(income)}
          onSave={(changes) => {
            run(ops.updateIncome(income, changes))
            close()
            toast('Salvo')
          }}
        />
      )}
      {bill && (
        <BillModal
          bill={bill}
          cards={finance.cards}
          categories={finance.categories}
          onClose={close}
          onDelete={() => deleteBill(bill)}
          onSave={(changes) => {
            run(ops.updateBill(bill, changes, today()))
            close()
            toast('Salvo')
          }}
        />
      )}
      {expense && (
        <ExpenseModal
          expense={expense}
          categories={finance.categories}
          otherPerson={finance.otherPerson}
          month={expenseMonth(finance, expense)}
          months={expenseMonths(finance, expense)}
          onClose={close}
          onDelete={() => {
            close()
            removeExpense(expense)
          }}
          onSave={(changes) => {
            run(saveExpense(finance, expense, changes))
            close()
            toast(
              changes.month
                ? `Salvo, na fatura de ${monthName(changes.month).toLowerCase()}`
                : 'Salvo',
            )
          }}
        />
      )}
    </>
  )
}
