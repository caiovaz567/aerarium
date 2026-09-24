import { Brand } from '../ui/Brand'

export function App() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Brand />
        </div>
      </header>
      <main id="conteudo" className="app-content" tabIndex={-1}>
        <section className="welcome" aria-labelledby="welcome-title">
          <h2 id="welcome-title">
            Suas finanças, <br />
            mês a mês.
          </h2>
          <p>Um lugar para acompanhar o que entra, o que sai e o que sobra.</p>
        </section>
      </main>
    </>
  )
}
