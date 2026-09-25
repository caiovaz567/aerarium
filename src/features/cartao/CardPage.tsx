import { Link } from 'react-router'
import { EmptyState } from '../../ui/EmptyState'

export function CardPage() {
  return (
    <EmptyState
      title="Cartão não encontrado"
      action={
        <Link className="btn primary" to="/cartoes">
          Voltar pros cartões
        </Link>
      }
    >
      Ele pode ter sido excluído.
    </EmptyState>
  )
}
