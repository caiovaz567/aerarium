import type { Finance, IncomeRow } from '../../data/finance'
import { paidIncome } from './paidBack'
import { formatMoney, type Cents } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'

/**
 * Fase 13.3: the owner pays the whole invoice and the other person sends
 * their part back. Always shown while someone else is set, so nothing below
 * jumps between months. "Pai pagou" adds what is due as an income; once all
 * is back, the block says so, with a way to undo it.
 */
export function OwedBlock({
  finance,
  month,
  owed,
  due,
  onPaid,
  onUndo,
}: {
  readonly finance: Finance
  readonly month: Month
  readonly owed: Cents
  readonly due: Cents
  readonly onPaid: (income: IncomeRow) => void
  readonly onUndo: () => void
}) {
  const name = finance.otherPerson!
  const paid = owed - due
  const settled = owed > 0 && due === 0
  return (
    <section
      className={`block owed-block${settled ? ' settled' : ''}`}
      aria-label={`O que o ${name} te deve`}
    >
      <span className="owed-text">
        <small>
          {settled
            ? `${name} pagou ${monthName(month)}`
            : `${name} te deve em ${monthName(month)}`}
        </small>
        <b>{formatMoney(settled ? owed : due)}</b>
        <small>
          {owed === 0
            ? 'Nada dele nos cartões este mês.'
            : settled
              ? 'Devolveu tudo.'
              : paid > 0
                ? `Já devolveu ${formatMoney(paid as Cents)} de ${formatMoney(owed)}.`
                : `Parte dele nas faturas: ${formatMoney(owed)}.`}
        </small>
      </span>
      {due > 0 && (
        <button
          type="button"
          className="btn primary"
          onClick={() => onPaid(paidIncome(finance, month, due))}
        >
          {name} pagou
        </button>
      )}
      {paid > 0 && (
        <button type="button" className="btn ghost" onClick={onUndo}>
          Desfazer
        </button>
      )}
    </section>
  )
}
