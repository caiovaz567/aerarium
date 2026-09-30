import { PageColumns } from '../../ui/PageColumns'
import { editOps } from '../../data/editOps'
import type { SubscriptionRow } from '../../data/finance'
import { today, useFinance, useFinanceOp } from '../../data/useFinance'
import { cents, formatMoney, sumMoney } from '../../domain/money'
import { dateBR } from '../../domain/months'
import { AddButton, TrashButton } from '../../ui/controls'
import { LoadError, Loading } from '../../ui/LoadStates'
import { useToast } from '../../ui/toastContext'
import { useEditor } from '../editar/editorContext'

/** Aba Assinaturas. */
export function SubscriptionsPage() {
  const query = useFinance()
  const editor = useEditor()
  const run = useFinanceOp()
  const toast = useToast()
  if (query.isPending) return <Loading />
  if (!query.data) return <LoadError onRetry={() => query.refetch()} />
  const finance = query.data
  const list = finance.subscriptions
    .filter((item) => item.active)
    .sort((a, b) => a.chargeDay - b.chargeDay || a.name.localeCompare(b.name))
  const total = sumMoney(list.map((item) => item.amount))
  const day = Number(today().slice(8))
  const next = list.find((item) => item.chargeDay >= day) ?? list[0]
  // Not started yet: when it does, so it is not taken for a current charge.
  const starts = (item: SubscriptionRow) =>
    item.startedOn && item.startedOn > today()
      ? `começa em ${dateBR(item.startedOn)}`
      : null
  const cardName = (item: SubscriptionRow) =>
    finance.cards.find((card) => card.id === item.cardId)?.name

  const remove = (item: SubscriptionRow) => {
    run(editOps.removeSubscription(item))
    toast(`${item.name} excluída`, {
      label: 'Desfazer',
      onClick: () => run(editOps.addSubscription(item)),
    })
  }

  return (
    <>
      <h2 className="visually-hidden">Assinaturas</h2>
      <PageColumns
        side={
          <>
            <section className="summary" aria-label="Total das assinaturas">
              <small>Total por mês</small>
              <p className="big">{formatMoney(total)}</p>
              <p>{formatMoney(cents(total * 12))} por ano</p>
            </section>
            {next && (
              <p className="next-charge">
                Próxima cobrança: <b>{next.name}</b>, dia {next.chargeDay} ·{' '}
                {formatMoney(next.amount)}
              </p>
            )}
          </>
        }
      >
        <section className="block" aria-labelledby="lista-assinaturas">
          <div className="block-head">
            <h2 id="lista-assinaturas">Assinaturas</h2>
            <span className="meta">
              {list.length} {list.length === 1 ? 'ativa' : 'ativas'}
            </span>
          </div>
          {list.length ? (
            <ul className="rows">
              {list.map((item) => (
                <li className="row" key={item.id}>
                  <button
                    type="button"
                    className="row-main"
                    onClick={() => editor.subscription(item.id)}
                  >
                    <span className="day">
                      <small>dia</small>
                      <b>{item.chargeDay}</b>
                    </span>
                    <span className="desc">
                      {item.name}
                      {(cardName(item) || item.note || starts(item)) && (
                        <span className="sub">
                          {[starts(item), cardName(item), item.note]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="val">{formatMoney(item.amount)}</span>
                  </button>
                  <TrashButton label={item.name} onClick={() => remove(item)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-hint">Nenhuma assinatura ainda.</p>
          )}
          <AddButton onClick={() => editor.subscription(null)}>
            Adicionar assinatura
          </AddButton>
        </section>
      </PageColumns>
    </>
  )
}
