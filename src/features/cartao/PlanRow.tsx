import { formatMoney } from '../../domain/money'
import { dayMonth } from '../../domain/months'
import { CheckButton, TrashButton } from '../../ui/controls'
import type { PlanLine } from './cardView'

/** "Notebook · 3/10 · faltam 7 · R$ 840,00 no total", with the pay circle. */
export function PlanRow({
  line,
  onToggle,
  onOpen,
  onDelete,
}: {
  readonly line: PlanLine
  readonly onToggle: () => void
  /** Opens the plan editor. */
  readonly onOpen: () => void
  readonly onDelete?: () => void
}) {
  const info = [
    `${line.number}/${line.totalInstallments}`,
    line.paidOn ? `paga em ${dayMonth(line.paidOn)}` : null,
    line.remaining ? `faltam ${line.remaining}` : 'quitado',
    !line.paid && line.remaining
      ? `${formatMoney(line.outstanding)} no total`
      : null,
    line.plan.note,
  ].filter((part): part is string => Boolean(part))
  return (
    <li className={`row${line.paid ? ' paid' : ''}`}>
      <CheckButton
        checked={line.paid}
        label={line.plan.description}
        onChange={onToggle}
      />
      <button type="button" className="row-main" onClick={onOpen}>
        <span className="desc">
          {line.plan.description}
          <span className="sub">
            {info.map((part, index) => (
              <span key={part}>
                {index > 0 && ' · '}
                <span className="part">{part}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="val">{formatMoney(line.amount)}</span>
      </button>
      {onDelete ? (
        <TrashButton label={line.plan.description} onClick={onDelete} />
      ) : (
        <span className="trash-space" />
      )}
    </li>
  )
}
