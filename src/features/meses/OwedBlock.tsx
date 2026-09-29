import type { Finance, IncomeRow } from '../../data/finance'
import { formatMoney, type Cents } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'

/**
 * Fase 13.3: the owner pays the whole invoice and the other person sends
 * their part back. Always shown while someone else is set, so nothing below
 * jumps between months. "Pai pagou" adds what is due as an income.
 */
export function OwedBlock({
  finance,
  month,
  owed,
  due,
  onPaid,
}: {
  readonly finance: Finance
  readonly month: Month
  readonly owed: Cents
  readonly due: Cents
  readonly onPaid: (income: IncomeRow) => void
}) {
  const name = finance.otherPerson!
  const monthId = finance.months.find((item) => item.ref === month)!.id
  const paid = owed - due
  return (
    <section
      className="block owed-block"
      aria-label={`O que o ${name} te deve`}
    >
      <span className="owed-text">
        <small>
          {name} te deve em {monthName(month)}
        </small>
        <b>{formatMoney(due)}</b>
        <small>
          {owed === 0
            ? 'Nada dele nos cartões este mês.'
            : paid > 0
              ? `Já devolveu ${formatMoney(paid as Cents)} de ${formatMoney(owed)}.`
              : `Parte dele nas faturas: ${formatMoney(owed)}.`}
        </small>
      </span>
      {due > 0 && (
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            onPaid({
              id: crypto.randomUUID(),
              monthId,
              month,
              description: `${name} pagou`,
              amount: due,
              kind: 'from_other',
              sortOrder:
                Math.max(
                  0,
                  ...finance.incomes
                    .filter((item) => item.month === month)
                    .map((item) => item.sortOrder),
                ) + 1,
            })
          }
        >
          {name} pagou
        </button>
      )}
    </section>
  )
}
