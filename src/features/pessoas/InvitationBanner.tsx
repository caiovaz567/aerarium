import { useQueryClient } from '@tanstack/react-query'
import {
  answerInvitation,
  invitationsKey,
  useInvitations,
} from '../../data/people'
import { useUserId } from '../../data/useFinance'
import { sharedKey } from '../../data/useShared'
import { ArmedButton } from '../../ui/controls'
import { useToast } from '../../ui/toastContext'

/** The next invitation waiting for an answer, answered right here. */
export function InvitationBanner() {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const invitation = useInvitations().data?.find((item) => !item.accepted)
  if (!invitation) return null

  const answer = (accept: boolean, done: string) => {
    void answerInvitation(invitation.personId, accept)
      .then(() => {
        void client.invalidateQueries({ queryKey: invitationsKey(userId) })
        void client.invalidateQueries({ queryKey: sharedKey(userId) })
        toast(done)
      })
      .catch(() =>
        toast('Não consegui salvar. Confere a internet e tenta de novo.'),
      )
  }

  return (
    <section className="invite-banner" aria-label="Convite">
      <p>
        <b>{invitation.fromName} quer te adicionar.</b> Aceitando, pode marcar
        compras como suas, e você vê só essas compras.
      </p>
      <div className="invite-actions">
        <ArmedButton
          className="link-button"
          onConfirm={() => answer(false, 'Convite recusado')}
        >
          Recusar
        </ArmedButton>
        <button
          type="button"
          className="btn primary small"
          onClick={() =>
            answer(true, `Você aceitou o convite de ${invitation.fromName}`)
          }
        >
          Aceitar
        </button>
      </div>
    </section>
  )
}
