import { Component, type ReactNode } from 'react'
import { Brand } from '../ui/Brand'

/** A screen crash shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="login">
        <div className="login-card" role="alert">
          <Brand />
          <h2 className="login-title">Algo deu errado</h2>
          <p className="muted">
            Recarrega o app pra continuar. O que já foi salvo continua lá.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      </main>
    )
  }
}
