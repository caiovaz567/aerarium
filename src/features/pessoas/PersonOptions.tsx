import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { financeKey, type Finance } from '../../data/finance'
import { peopleKey, removePerson, usePeople } from '../../data/people'
import { useUserId } from '../../data/useFinance'
import { ArmedButton } from '../../ui/controls'
import { useToast } from '../../ui/toastContext'
import { OtherPersonRows } from './OtherPersonRows'

function RemovePerson({
  person,
}: {
  readonly person: { readonly id: string; readonly name: string }
}) {
  const userId = useUserId()
  const client = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const username = usePeople().data?.find(
    (item) => item.id === person.id,
  )?.username
  return (
    <li className="settings-row share-row">
      <span className="settings-text">
        <b>{username ? `@${username}` : person.name}</b>
        <small>{username ? 'Vê só as compras marcadas.' : 'Só você vê.'}</small>
        <span className="share-actions">
          <ArmedButton
            className="link-button"
            onConfirm={() =>
              void removePerson(person.id)
                .then((removed) => {
                  if (!removed)
                    return toast(
                      'Essa pessoa tem compras marcadas. Troca o "De quem" delas antes.',
                    )
                  void client.invalidateQueries({
                    queryKey: peopleKey(userId),
                  })
                  void client.invalidateQueries({
                    queryKey: financeKey(userId),
                  })
                  toast(`${person.name} saiu da sua lista`)
                  void navigate('/pessoas')
                })
                .catch(() =>
                  toast(
                    'Não consegui salvar. Confere a internet e tenta de novo.',
                  ),
                )
            }
          >
            Remover da lista
          </ArmedButton>
        </span>
      </span>
    </li>
  )
}

/** Under a person's month: what can be changed about them. */
export function PersonOptions({
  finance,
  person,
}: {
  readonly finance: Finance
  /** Someone in the list; without it, the other person. */
  readonly person?: { readonly id: string; readonly name: string }
}) {
  return (
    <section className="person-options" aria-label="Opções da pessoa">
      <ul className="settings-card">
        {person ? (
          <RemovePerson person={person} />
        ) : (
          <OtherPersonRows finance={finance} />
        )}
      </ul>
    </section>
  )
}
