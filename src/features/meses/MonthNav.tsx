import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Finance } from '../../data/finance'
import { monthSnapshot, ops } from '../../data/financeOps'
import { useFinanceOp } from '../../data/useFinance'
import { addMonths, monthLabel, type Month } from '../../domain/months'
import { useToast } from '../../ui/toastContext'
import { MonthBar } from './MonthBar'
import { MonthListModal, NewMonthModal } from './MonthModals'
import { buildNewMonth } from './monthView'

/**
 * Month bar shared by Meses and Cartões,
 * with the month list, "create next month" and "delete month". Meses also
 * goes on past the last month, as forecasts, up to `forecastUntil`.
 */
export function MonthNav({
  finance,
  selected,
  pathFor,
  forecastUntil = null,
}: {
  readonly finance: Finance
  readonly selected: Month
  readonly pathFor: (month: Month) => string
  readonly forecastUntil?: Month | null
}) {
  const navigate = useNavigate()
  const run = useFinanceOp()
  const toast = useToast()
  const [dialog, setDialog] = useState<'list' | 'new' | null>(null)
  const close = () => setDialog(null)
  const refs = finance.months.map((item) => item.ref)
  const last = refs[refs.length - 1]!
  const next = addMonths(last, 1)
  const ahead: Month[] = []
  if (forecastUntil)
    for (let ref = next; ref <= forecastUntil; ref = addMonths(ref, 1))
      ahead.push(ref)
  const forecast = selected > last

  const create = (options: { copy: boolean; carryover: boolean }) => {
    run(ops.createMonth(buildNewMonth(finance, next, last, options)))
    close()
    navigate(pathFor(next))
    toast(`${monthLabel(next)} criado`)
  }
  const remove = () => {
    const snapshot = monthSnapshot(finance, selected)
    const index = refs.indexOf(selected)
    const neighbor = refs[index - 1] ?? refs[index + 1]!
    run(ops.removeMonth(snapshot))
    close()
    navigate(pathFor(neighbor), { replace: true })
    toast(`${monthLabel(selected)} excluído`, {
      label: 'Desfazer',
      onClick: () => {
        run(ops.createMonth(snapshot))
        navigate(pathFor(selected))
      },
    })
  }

  return (
    <>
      <MonthBar
        selected={selected}
        months={[...refs, ...ahead]}
        pathFor={pathFor}
        onOpenList={() => setDialog('list')}
        onCreateNext={() => setDialog('new')}
        canCreate={!forecast}
      />
      {dialog === 'list' && (
        <MonthListModal
          finance={finance}
          selected={selected}
          next={next}
          canDelete={!forecast}
          onClose={close}
          onPick={(ref) => {
            close()
            navigate(pathFor(ref))
          }}
          onCreate={() => setDialog('new')}
          onDelete={remove}
        />
      )}
      {dialog === 'new' && (
        <NewMonthModal
          finance={finance}
          target={next}
          previous={last}
          onClose={close}
          onCreate={create}
        />
      )}
    </>
  )
}
