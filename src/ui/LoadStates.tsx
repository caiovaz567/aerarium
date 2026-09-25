import { EmptyState } from './EmptyState'

export function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skel" />
      <div className="skel" />
    </div>
  )
}

export function LoadError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <EmptyState
      title="Não consegui carregar seus dados"
      action={
        <button type="button" className="btn primary" onClick={onRetry}>
          Tentar de novo
        </button>
      }
    >
      Confere a internet e tenta de novo.
    </EmptyState>
  )
}
