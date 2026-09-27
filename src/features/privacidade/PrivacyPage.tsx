import { useEffect } from 'react'
import { Link } from 'react-router'
import { Brand } from '../../ui/Brand'

/** Short privacy policy, open to anyone (no login). */
export function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <main className="privacy">
      <div className="privacy-card">
        <Brand />
        <h2>Privacidade</h2>
        <p>
          O Aerarium guarda só o necessário pra funcionar. Aqui está o que, onde
          e como apagar.
        </p>

        <h3>O que o app guarda</h3>
        <ul>
          <li>
            Seu e-mail. Se você entrar com o Google, também o nome e a foto que
            o Google envia.
          </li>
          <li>
            O que você lança: meses, entradas, contas, cartões, faturas, gastos,
            parcelamentos e assinaturas.
          </li>
        </ul>

        <h3>O que o app não guarda</h3>
        <ul>
          <li>
            Número de cartão, senha de banco ou dado de pagamento. O app nunca
            pede isso.
          </li>
          <li>
            Nada de anúncio nem rastreamento: sem cookies de propaganda e sem
            ferramentas de análise.
          </li>
        </ul>

        <h3>Onde fica</h3>
        <p>
          Os dados ficam no Supabase, num servidor em São Paulo, e o app é
          hospedado na Vercel. Cada pessoa só enxerga os próprios dados: o banco
          bloqueia o resto. No seu aparelho ficam só o login e uma cópia das
          telas pra abrir rápido. Seus números não ficam salvos nele.
        </p>

        <h3>Quem vê</h3>
        <p>
          Só você. Ninguém vende nem compartilha seus dados. Supabase e Vercel
          só processam o necessário pro app funcionar.
        </p>

        <h3>Como levar ou apagar</h3>
        <p>
          Em Ajustes, "Baixar meus dados" baixa um arquivo com tudo. "Apagar
          minha conta e meus dados" apaga tudo na hora, sem volta. Cópias de
          segurança do servidor podem levar alguns dias pra sumir.
        </p>

        <p className="muted">Atualizada em 25 de setembro de 2026.</p>
        <Link className="btn ghost" to="/">
          Voltar pro app
        </Link>
      </div>
    </main>
  )
}
