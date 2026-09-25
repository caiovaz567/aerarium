import { useMemo, useState, type ReactNode } from 'react'
import { useFinance } from '../../data/useFinance'
import { CardModal } from './CardModal'
import { EditorContext, type Editor } from './editorContext'
import { PlanModal } from './PlanModal'
import { SubscriptionModal } from './SubscriptionModal'

type Open =
  | { readonly kind: 'card'; readonly id: string | null }
  | {
      readonly kind: 'plan'
      readonly id: string | null
      readonly cardId: string | null
    }
  | { readonly kind: 'subscription'; readonly id: string | null }

/** Holds which edit dialog is open, so any screen can open one. */
export function EditorProvider({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const finance = useFinance().data
  const editor = useMemo<Editor>(
    () => ({
      card: (id) => setOpen({ kind: 'card', id }),
      plan: (id, preset) =>
        setOpen({ kind: 'plan', id, cardId: preset?.cardId ?? null }),
      subscription: (id) => setOpen({ kind: 'subscription', id }),
    }),
    [],
  )
  const close = () => setOpen(null)

  let dialog: ReactNode = null
  if (open && finance) {
    // The key remounts the form when another item is opened.
    const key = `${open.kind}-${open.id ?? 'novo'}`
    if (open.kind === 'card') {
      const card = finance.cards.find((item) => item.id === open.id) ?? null
      if (card || !open.id)
        dialog = (
          <CardModal key={key} finance={finance} card={card} onClose={close} />
        )
    } else if (open.kind === 'plan') {
      const plan = finance.plans.find((item) => item.id === open.id) ?? null
      if (plan || !open.id)
        dialog = (
          <PlanModal
            key={key}
            finance={finance}
            plan={plan}
            presetCardId={open.cardId}
            onClose={close}
          />
        )
    } else {
      const subscription =
        finance.subscriptions.find((item) => item.id === open.id) ?? null
      if (subscription || !open.id)
        dialog = (
          <SubscriptionModal
            key={key}
            finance={finance}
            subscription={subscription}
            onClose={close}
          />
        )
    }
  }

  return (
    <EditorContext value={editor}>
      {children}
      {dialog}
    </EditorContext>
  )
}
