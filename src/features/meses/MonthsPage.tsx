import { useProfile } from '../../app/profileContext'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
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
import { EmptyState } from '../../ui/EmptyState'
import { LoadError, Loading } from '../../ui/LoadStates'
import { useToast } from '../../ui/toastContext'
import { useEditor } from '../editar/editorContext'
import { BillModal, ExpenseModal, IncomeModal } from './EditModals'
import { InvoiceModal } from './InvoiceModal'
import { IncomesBlock } from './MonthBlocks'
import { OtherMonth } from './OtherMonth'
import { OwedBlock } from './OwedBlock'
import { ProfileSwitch } from './ProfileSwitch'
import { OutflowViews } from './OutflowViews'
import { NewMonthModal } from './MonthModals'
import { MonthNav } from './MonthNav'
import { MonthSummary } from './MonthSummary'
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
  | { readonly kind: 'invoice'; readonly id: string }
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
  const { profile } = useProfile(query.data?.otherPerson)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)
  // Like v1: a new month starts from the top.
  // Braces matter: newer browsers return a promise from scrollTo.
  useEffect(() => {
    window.scrollTo(0, 0)
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

  if (!selected || !refs.includes(selected))
    return (
      <Navigate
        to={monthPath(defaultMonth(finance, currentMonth()) ?? last)}
        replace
      />
    )

  const view = monthView(finance, selected)

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
  const invoice =
    dialog?.kind === 'invoice'
      ? view.cards.find((item) => item.invoice.id === dialog.id)
      : undefined
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
    else if (item.source === 'other' || item.source === 'shared')
      setDialog({ kind: 'invoice', id: item.id })
    else if (item.source === 'installment') editor.plan(item.id)
    else editor.subscription(item.id)
  }

  return (
    <>
      <h2 className="visually-hidden">Meses</h2>
      {finance.otherPerson && <ProfileSwitch other={finance.otherPerson} />}
      <MonthNav finance={finance} selected={selected} pathFor={monthPath} />
      {profile === 'other' ? (
        <OtherMonth finance={finance} month={selected} onOpen={openOutflow} />
      ) : (
        <>
          <MonthSummary month={selected} balance={view.balance} />
          {finance.otherPerson && (
            <OwedBlock
              finance={finance}
              month={selected}
              owed={view.balance.otherOwed}
              due={view.balance.otherDue}
              onPaid={(income) => {
                run(ops.restoreIncome(income))
                toast(`${income.description}: entrou nas Entradas`, {
                  label: 'Desfazer',
                  onClick: () => run(ops.removeIncome(income)),
                })
              }}
            />
          )}
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
          <OutflowViews
            finance={finance}
            month={selected}
            onOpen={openOutflow}
            view={view}
            categories={finance.categories}
            onInvoice={(item) =>
              setDialog({ kind: 'invoice', id: item.invoice.id })
            }
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
        </>
      )}

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
      {invoice && (
        <InvoiceModal
          invoice={invoice.invoice}
          card={invoice.card}
          finance={finance}
          onClose={close}
          onOpenPlan={(id) => {
            close()
            editor.plan(id)
          }}
          onOpenSubscription={(id) => {
            close()
            editor.subscription(id)
          }}
          onRemoveExpense={removeExpense}
          onOpenExpense={(row) => setDialog({ kind: 'expense', id: row.id })}
          onSave={({ paid, ...changes }) => {
            run(ops.updateInvoice(invoice.invoice, changes))
            if (paid !== invoice.invoice.paid)
              run(ops.invoicePaid(invoice.invoice, paid, today()))
            close()
            toast('Salvo')
          }}
        />
      )}
    </>
  )
}
