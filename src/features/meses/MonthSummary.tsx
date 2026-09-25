import { formatMoney, type Cents } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'
import { committedPercent } from './monthView'

/** Blue summary. Fixed layout: nothing here changes height between months (7.4 item 2). */
export function MonthSummary({
  month,
  balance,
}: {
  readonly month: Month
  readonly balance: {
    readonly incomes: Cents
    readonly outflows: Cents
    readonly available: Cents
    readonly unpaid: Cents
    readonly committedRatio: number | null
  }
}) {
  const percent = committedPercent(balance.committedRatio)
  const width =
    percent === null ? (balance.outflows > 0 ? 100 : 0) : Math.min(100, percent)
  const over = percent === null ? balance.outflows > 0 : percent > 100
  return (
    <section className="hero" aria-label="Resumo do mês">
      <div className="hero-label">
        Disponível em {monthName(month)}
        {balance.available < 0 && <span className="pill">No vermelho</span>}
      </div>
      <p className="hero-num">{formatMoney(balance.available)}</p>
      <div className={`bar${over ? ' over' : ''}`} aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className="bar-cap">
        {percent === null
          ? 'Nada entrou neste mês ainda'
          : `${percent}% do que entrou já está comprometido`}
      </p>
      <dl className="hero-split">
        <div>
          <dt>Entradas</dt>
          <dd>{formatMoney(balance.incomes)}</dd>
        </div>
        <div>
          <dt>Saídas</dt>
          <dd>{formatMoney(balance.outflows)}</dd>
        </div>
        <div>
          <dt>Falta pagar</dt>
          <dd>{formatMoney(balance.unpaid)}</dd>
        </div>
      </dl>
    </section>
  )
}
