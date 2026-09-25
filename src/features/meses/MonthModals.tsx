import { useState } from 'react'
import { monthBalance } from '../../domain/balance'
import { formatMoney } from '../../domain/money'
import { monthLabel, monthName, type Month } from '../../domain/months'
import type { Finance } from '../../data/finance'
import { ArmedButton, CheckField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'

export function MonthListModal({
  finance,
  selected,
  next,
  onPick,
  onCreate,
  onDelete,
  onClose,
}: {
  readonly finance: Finance
  readonly selected: Month
  readonly next: Month
  readonly onPick: (month: Month) => void
  readonly onCreate: () => void
  readonly onDelete: () => void
  readonly onClose: () => void
}) {
  const months = [...finance.months].reverse()
  return (
    <Modal
      title="Seus meses"
      onClose={onClose}
      actions={
        <>
          {months.length > 1 && (
            <ArmedButton onConfirm={onDelete}>
              {`Excluir ${monthLabel(selected)}`}
            </ArmedButton>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      <div className="month-list">
        {months.map(({ ref }) => (
          <button
            type="button"
            key={ref}
            aria-current={ref === selected ? 'true' : undefined}
            onClick={() => onPick(ref)}
          >
            {monthLabel(ref)}
            <span>{formatMoney(monthBalance(ref, finance).available)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn ghost wide" onClick={onCreate}>
        Criar {monthLabel(next)}
      </button>
    </Modal>
  )
}

export function NewMonthModal({
  finance,
  target,
  previous,
  onCreate,
  onClose,
}: {
  readonly finance: Finance
  readonly target: Month
  readonly previous: Month | null
  readonly onCreate: (options: { copy: boolean; carryover: boolean }) => void
  readonly onClose: () => void
}) {
  const [copy, setCopy] = useState(true)
  const [carryover, setCarryover] = useState(true)
  const name = previous ? monthName(previous) : ''
  return (
    <Modal
      title={`Criar ${monthLabel(target)}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              onCreate({
                copy: previous !== null && copy,
                carryover: previous !== null && carryover,
              })
            }
          >
            Criar mês
          </button>
        </>
      }
    >
      {previous ? (
        <div className="modal-form">
          <CheckField
            label={`Copiar entradas e saídas de ${name}`}
            hint="Contas vêm com o mesmo valor. Faturas de cartão vêm estimadas com as parcelas e assinaturas do mês."
            checked={copy}
            onChange={setCopy}
          />
          <CheckField
            label={`Levar a sobra de ${name}: ${formatMoney(monthBalance(previous, finance).available)}`}
            hint='Entra como "Sobrou do mês passado".'
            checked={carryover}
            onChange={setCarryover}
          />
        </div>
      ) : (
        <p className="muted">Vou criar o mês vazio pra você preencher.</p>
      )}
    </Modal>
  )
}
