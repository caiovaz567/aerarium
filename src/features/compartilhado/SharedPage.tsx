import { PageColumns } from '../../ui/PageColumns'
import { HeaderSlot } from '../../app/headerSlot'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { currentMonth, parseMonth } from '../../app/paths'
import type { SharedView } from '../../data/shared'
import { useSharedWithMe } from '../../data/useShared'
import { BANKS, bankName } from '../../domain/banks'
import { CheckIcon } from '../../ui/icons'
import { formatMoney, type Cents } from '../../domain/money'
import { monthName, type Month } from '../../domain/months'
import { pixKeyKind, pixKeyText, pixKeyValue } from '../../domain/pix'
import { BankLogo } from '../../ui/BankLogo'
import { EmptyState } from '../../ui/EmptyState'
import { LoadError, Loading } from '../../ui/LoadStates'
import { useToast } from '../../ui/toastContext'
import { MonthBar } from '../meses/MonthBar'
import { OtherByType } from '../meses/OtherByType'
import { SpendingList } from '../meses/SpendingBlock'
import { TimelineView } from '../meses/TimelineView'
import { sharedDefaultMonth, sharedFinance, sharedMonth } from './sharedFinance'

type View = 'tipo' | 'data' | 'categoria'
const VIEWS: [View, string][] = [
  ['tipo', 'Por tipo'],
  ['data', 'Por data'],
  ['categoria', 'Por categoria'],
]
// Read only: tapping a purchase opens nothing.
const nothing = () => {}

/** "Pague tudo por Pix": the owner's key, its bank, and a copy button. */
function PixBlock({
  view,
  due,
}: {
  readonly view: SharedView
  readonly due: Cents
}) {
  const toast = useToast()
  const key = view.pixKey!
  const bank = BANKS.find((item) => item.key === view.pixBank)?.key ?? null
  const copy = () => {
    const value = pixKeyValue(key)
    void (navigator.clipboard?.writeText(value) ?? Promise.reject())
      .then(() => toast('Chave Pix copiada'))
      .catch(() => toast(`Chave Pix: ${value}`))
  }
  return (
    <section className="block pix-block" aria-labelledby="pix">
      <div className="block-head">
        <h2 id="pix">Pagar por Pix</h2>
      </div>
      <div className="pix-body">
        {bank && <BankLogo bank={bank} className="pix-logo" />}
        <p>
          {due > 0
            ? `Transfira ${formatMoney(due)} pro ${view.ownerName}`
            : `Pra pagar o ${view.ownerName}`}
          {bank && ` no ${bankName(bank)}`}.
          <span className="pix-key">
            {pixKeyKind(key)} {pixKeyText(key)}
          </span>
        </p>
        <button type="button" className="btn primary" onClick={copy}>
          Copiar chave
        </button>
      </div>
    </section>
  )
}

/** One owner's cards, as the other person sees them. */
function SharedMonths({
  view,
  base,
}: {
  readonly view: SharedView
  readonly base: string
}) {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<View>('tipo')
  const finance = sharedFinance(view)
  const refs = finance.months.map((item) => item.ref)
  const picked = parseMonth(params.get('mes') ?? undefined)
  const selected: Month | null =
    picked && refs.includes(picked)
      ? picked
      : sharedDefaultMonth(finance, currentMonth())
  if (!selected)
    return (
      <EmptyState title="Nada por aqui ainda">
        Quando {view.ownerName} marcar uma compra como sua, ela aparece aqui.
      </EmptyState>
    )
  const month = sharedMonth(view, finance, selected)
  const pathFor = (ref: Month) => `${base}?mes=${ref}`
  return (
    <>
      <HeaderSlot>
        <MonthBar
          selected={selected}
          months={refs}
          pathFor={pathFor}
          onOpenList={nothing}
          onCreateNext={nothing}
          canCreate={false}
        />
      </HeaderSlot>
      <PageColumns
        side={
          <>
            <section
              className="hero"
              aria-label={`O que você deve ao ${view.ownerName}`}
            >
              <div className="hero-label">
                {month.due > 0
                  ? `Falta pagar ao ${view.ownerName} em ${monthName(selected)}`
                  : `${monthName(selected)} com ${view.ownerName}`}
              </div>
              <p className="hero-num">{formatMoney(month.due)}</p>
              {month.owed > 0 && month.due === 0 ? (
                <p className="paid-status">
                  <CheckIcon />
                  Você pagou tudo de {monthName(selected).toLowerCase()} (
                  {formatMoney(month.owed)}).
                </p>
              ) : (
                <p className="bar-cap">
                  Nos cartões do {view.ownerName}: {formatMoney(month.owed)}
                  {month.paid > 0 &&
                    ` · você já pagou ${formatMoney(month.paid)}`}
                </p>
              )}
            </section>

            {view.pixKey && <PixBlock view={view} due={month.due} />}
          </>
        }
      >
        <section className="block" aria-labelledby="suas-compras">
          <div className="block-head">
            <h2 id="suas-compras">Suas compras</h2>
          </div>
          <div
            className="segmented views"
            role="group"
            aria-label="Ver suas compras"
          >
            {VIEWS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'tipo' && (
            <OtherByType
              finance={finance}
              month={selected}
              onOpen={nothing}
              empty="Nenhuma compra sua neste mês."
            />
          )}
          {tab === 'data' && (
            <TimelineView finance={finance} month={selected} onOpen={nothing} />
          )}
          {tab === 'categoria' && (
            <SpendingList finance={finance} month={selected} onOpen={nothing} />
          )}
        </section>
      </PageColumns>
    </>
  )
}

/**
 * "Cartões do Caio": what someone who shares their cards marked as yours,
 * read only, kept fresh.
 */
export function SharedPage() {
  const query = useSharedWithMe()
  if (query.isPending) return <Loading />
  if (!query.data) return <LoadError onRetry={() => query.refetch()} />
  const view = query.data[0]
  if (!view)
    return (
      <EmptyState title="Nada compartilhado com você">
        Quando alguém compartilhar os cartões com a sua conta, aparece aqui.
      </EmptyState>
    )
  return (
    <>
      <h2 className="page-title">Cartões do {view.ownerName}</h2>
      <SharedMonths view={view} base="/compartilhado" />
    </>
  )
}
