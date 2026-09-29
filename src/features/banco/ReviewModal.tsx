import { useState } from 'react'
import { bankOps } from '../../data/bank'
import type { Finance } from '../../data/finance'
import { today, useFinanceOp } from '../../data/useFinance'
import { formatMoney } from '../../domain/money'
import { dayLabel, timeLabel } from '../../domain/timeline'
import { CardArt } from '../../ui/CardArt'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import { pendingReview, reviewDays, type ReviewItem } from './review'

/**
 * Fase 13.3, "Chegou do banco" (only for the owner, with someone else using
 * the cards): new purchases by day, each marked as the owner's or the other
 * person's, starting from the app's guess.
 */
export function ReviewModal({
  finance,
  onClose,
}: {
  readonly finance: Finance
  readonly onClose: () => void
}) {
  const run = useFinanceOp()
  const toast = useToast()
  const other = finance.otherPerson ?? ''
  const [items] = useState(() => pendingReview(finance))
  const [choices, setChoices] = useState(
    () => new Map(items.map((item) => [item.id, item.forOther])),
  )
  const expenses = items.filter((item) => item.kind === 'expense')
  const plans = items.filter((item) => item.kind === 'plan')
  const now = today()

  const save = () => {
    run(
      bankOps.review(
        items.map((item) => ({
          kind: item.kind,
          id: item.id,
          forOther: choices.get(item.id)!,
        })),
      ),
    )
    onClose()
    toast('Conferido')
  }

  const row = (item: ReviewItem) => {
    const forOther = choices.get(item.id)!
    const set = (value: boolean) =>
      setChoices((current) => new Map(current).set(item.id, value))
    return (
      <li className="review-row" key={item.id}>
        <div className="review-main">
          {item.card && <CardArt card={item.card} size="xs" />}
          <span className="review-text">
            <b>{item.description}</b>
            <small>
              {[
                item.card?.name,
                item.at && timeLabel(item.at),
                item.installments && `${item.installments}x`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          </span>
          <b className="review-value">{formatMoney(item.amount)}</b>
        </div>
        <div
          className="segmented who small"
          role="group"
          aria-label={`De quem é ${item.description}`}
        >
          <button
            type="button"
            aria-pressed={!forOther}
            onClick={() => set(false)}
          >
            Meu
          </button>
          <button
            type="button"
            aria-pressed={forOther}
            onClick={() => set(true)}
          >
            {other}
          </button>
        </div>
      </li>
    )
  }

  return (
    <Modal
      title="Chegou do banco"
      onClose={onClose}
      actions={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Depois
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Pronto
          </button>
        </>
      }
    >
      <p className="muted review-intro">
        {items.length === 1 ? '1 compra nova' : `${items.length} compras novas`}
        . Marca o que é seu e o que é do {other}. Dá pra mudar depois, tocando
        na compra.
      </p>
      {reviewDays(expenses).map((group) => (
        <section className="review-day" key={group.day}>
          <h4>{dayLabel(group.day, now)}</h4>
          <ul>{group.items.map(row)}</ul>
        </section>
      ))}
      {plans.length > 0 && (
        <section className="review-day">
          <h4>Parcelamentos novos</h4>
          <ul>{plans.map(row)}</ul>
        </section>
      )}
    </Modal>
  )
}
