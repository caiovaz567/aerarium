import { useQueryClient } from '@tanstack/react-query'
import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../app/authContext'
import { cardSnapshot, editOps } from '../../data/editOps'
import type { Card, Finance } from '../../data/finance'
import { photoPath, removeCardPhoto, uploadCardPhoto } from '../../data/photos'
import { today, useFinanceOp } from '../../data/useFinance'
import { autoColor, CARD_PALETTE } from '../../domain/cardColor'
import { CardArt } from '../../ui/CardArt'
import { ArmedButton, TextField } from '../../ui/controls'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'

/** New or edit card (seção 8.7): preview, photo, name, color and closing day. */
export function CardModal({
  finance,
  card,
  onClose,
}: {
  readonly finance: Finance
  readonly card: Card | null
  readonly onClose: () => void
}) {
  const auth = useAuth()
  const userId = auth.status === 'signed-in' ? auth.session.user.id : ''
  const run = useFinanceOp()
  const toast = useToast()
  const client = useQueryClient()
  const closingId = useId()
  // A new card already has its id, so a photo can be uploaded before saving.
  const [id] = useState(() => card?.id ?? crypto.randomUUID())
  const [name, setName] = useState(card?.name ?? '')
  const [color, setColor] = useState<string | null>(card?.color ?? null)
  const [closing, setClosing] = useState(String(card?.closingDay ?? ''))
  const [photo, setPhoto] = useState<string | null>(card?.photoPath ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bank = autoColor(name)
  const swatches = [
    bank,
    ...CARD_PALETTE.filter((item) => item.toLowerCase() !== bank.toLowerCase()),
  ]
  const selected = color ?? bank

  // An existing card saves photo changes right away, like v1.
  const keepPhoto = (path: string | null) => {
    setPhoto(path)
    if (card) run(editOps.updateCard({ ...card, photoPath: path }))
  }
  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    const path = photoPath(userId, id)
    try {
      await uploadCardPhoto(path, file)
      await client.invalidateQueries({ queryKey: ['card-photo', path] })
      keepPhoto(path)
      toast('Foto salva')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const dropPhoto = async () => {
    if (!photo) return
    setBusy(true)
    try {
      await removeCardPhoto(photo)
      keepPhoto(null)
      toast('Foto removida')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  // A photo uploaded for a card that was never saved is thrown away.
  const cancel = () => {
    if (!card && photo) void removeCardPhoto(photo).catch(() => {})
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Escreve o nome do cartão.')
    if (trimmed.length > 60) return setError('O nome pode ter até 60 letras.')
    if (busy) return setError('Espera a foto terminar de enviar.')
    const day = closing ? Number(closing) : null
    if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31))
      return setError('O dia de fechamento precisa ser de 1 a 31.')
    const next: Card = {
      id,
      name: trimmed,
      color,
      photoPath: photo,
      closingDay: day,
      sortOrder:
        card?.sortOrder ??
        Math.max(0, ...finance.cards.map((item) => item.sortOrder)) + 1,
    }
    run(card ? editOps.updateCard(next) : editOps.addCard(next))
    onClose()
    toast(card ? 'Salvo' : `${next.name} criado`)
  }

  const remove = () => {
    const snapshot = cardSnapshot(finance, card!)
    run(editOps.removeCard(snapshot))
    onClose()
    toast(`${card!.name} excluído`, {
      label: 'Desfazer',
      onClick: () => run(editOps.restoreCard(snapshot, today())),
    })
  }

  return (
    <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={cancel}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="card-edit">
          <CardArt
            card={{ name: name || 'Seu cartão', color, photoPath: photo }}
            size="lg"
          />
          <div className="card-edit-buttons">
            <label className={`btn ghost file-button${busy ? ' busy' : ''}`}>
              {busy ? 'Enviando…' : photo ? 'Trocar foto' : 'Colocar foto'}
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                disabled={busy}
                onChange={pick}
              />
            </label>
            {photo && !busy && (
              <button type="button" className="btn ghost" onClick={dropPhoto}>
                Tirar foto
              </button>
            )}
          </div>
          <small className="muted center">
            Use uma foto sem o número do cartão aparecendo.
          </small>
        </div>
        <TextField
          label="Nome do cartão"
          value={name}
          onChange={setName}
          placeholder="Ex.: NuBank"
        />
        <fieldset className="field">
          <legend>
            Cor{photo ? ' (aparece quando estiver sem foto)' : ''}
          </legend>
          <div className="swatches">
            {swatches.map((item, index) => (
              <label
                className="swatch"
                key={item}
                title={index === 0 ? 'Cor do banco' : item}
              >
                <input
                  type="radio"
                  name="cor"
                  checked={selected.toLowerCase() === item.toLowerCase()}
                  onChange={() => setColor(index === 0 ? null : item)}
                  aria-label={index === 0 ? 'Cor do banco' : `Cor ${item}`}
                />
                <i style={{ background: item }} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={closingId}>Dia de fechamento (opcional)</label>
          <input
            id={closingId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 5"
            value={closing}
            onChange={(event) =>
              setClosing(event.target.value.replace(/\D/g, '').slice(0, 2))
            }
          />
          <small>
            Gastos lançados depois desse dia já vão pra fatura do mês seguinte.
          </small>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          {card && <ArmedButton onConfirm={remove}>Excluir</ArmedButton>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={cancel}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
