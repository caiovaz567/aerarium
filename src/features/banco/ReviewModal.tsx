import { useState } from 'react'
import { bankOps } from '../../data/bank'
import type { Finance } from '../../data/finance'
import { today, useFinanceOp } from '../../data/useFinance'
import { formatMoney } from '../../domain/money'
import { dayMonth } from '../../domain/months'
import { dayLabel, timeLabel } from '../../domain/timeline'
import { CardArt } from '../../ui/CardArt'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import {
  joinedPurchase,
  pendingReview,
  reviewDays,
  type ReviewItem,
} from './review'

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
  // Looks like one launched by hand: the owner says if it is the same.
  const [answers, setAnswers] = useState(
    () => new Map<string, 'same' | 'other'>(),
  )
  const answer = (id: string, value: 'same' | 'other' | null) =>
    setAnswers((current) => {
      const next = new Map(current)
      if (value) next.set(id, value)
      else next.delete(id)
      return next
    })
  const expenses = items.filter((item) => item.kind === 'expense')
  const plans = items.filter((item) => item.kind === 'plan')
  const now = today()

  const save = () => {
    const at = new Date().toISOString()
    const same = items.filter((item) => answers.get(item.id) === 'same')
    // Unanswered "É a mesma?" stays to check next time.
    const checked = items.filter(
      (item) => !item.similar || answers.get(item.id) === 'other',
    )
    if (checked.length)
      run(
        bankOps.review(
          checked.map((item) => ({
            kind: item.kind,
            id: item.id,
            forOther: choices.get(item.id)!,
          })),
        ),
      )
    if (same.length)
      run(
        bankOps.joinSame(
          same.map((item) => ({
            bankId: item.id,
            joined: joinedPurchase(
              item.similar!,
              finance.expenses.find((row) => row.id === item.id)!,
              at,
            ),
          })),
        ),
      )
    onClose()
    toast(
      same.length
        ? `Conferido. ${same.length === 1 ? '1 compra juntada' : `${same.length} compras juntadas`} com a que você lançou`
        : 'Conferido',
    )
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
        {item.similar && !answers.has(item.id) && (
          <div
            className="review-same"
            role="group"
            aria-label={`${item.description} é a mesma compra?`}
          >
            <p>
              Parece com <b>{item.similar.description}</b> (
              {formatMoney(item.similar.amount)}, dia{' '}
              {dayMonth(item.similar.spentOn)}) que você lançou. É a mesma
              compra?
            </p>
            <div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => answer(item.id, 'other')}
              >
                É outra
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => answer(item.id, 'same')}
              >
                É a mesma
              </button>
            </div>
          </div>
        )}
        {answers.get(item.id) === 'same' ? (
          <p className="review-joined">
            Vai juntar com a que você lançou ({item.similar!.description}).{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => answer(item.id, null)}
            >
              Desfazer
            </button>
          </p>
        ) : (
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
        )}
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
