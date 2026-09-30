import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../app/authContext'
import { downloadMyData } from '../../data/account'
import { authErrorFromUrl, linkGoogle, signOut } from '../../data/auth'
import { useFinance } from '../../data/useFinance'
import { CategoryBadge } from '../../ui/CategoryBadge'
import {
  ChevronRightIcon,
  DownloadIcon,
  GoogleIcon,
  LockIcon,
  LogoutIcon,
  ShieldIcon,
  TrashIcon,
} from '../../ui/icons'
import { useToast } from '../../ui/toastContext'
import { BankSection, OtherPersonSection } from '../banco/BankSection'
import { useBankEnabled } from '../banco/useBank'
import { CategoriesModal } from './CategoriesModal'
import { DeleteAccountModal } from './DeleteAccountModal'

type Tone = 'accent' | 'pos' | 'neg' | 'muted' | 'google'

/** One line of a settings card: colored icon, title, short explanation. */
function Row({
  icon,
  tone,
  title,
  detail,
  end,
}: {
  readonly icon: ReactNode
  readonly tone: Tone
  readonly title: ReactNode
  readonly detail?: ReactNode
  readonly end?: ReactNode
}) {
  return (
    <>
      <span className={`settings-icon ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="settings-text">
        <b>{title}</b>
        {detail && <small>{detail}</small>}
      </span>
      {end}
    </>
  )
}

const Chevron = () => (
  <span className="settings-chevron" aria-hidden="true">
    <ChevronRightIcon />
  </span>
)

/**
 * Ajustes (the owner's layout, 30/09/2026): the account on top, then tabs:
 * Geral (categories, your data), Bancos and Pai (Open Finance owner only) and
 * Conta (ways in, this device, deleting apart in red). One icon color per
 * card, so it does not look like a carnival.
 */
export function SettingsPage() {
  const auth = useAuth()
  const toast = useToast()
  // Coming back from Google with a refusal (for example, already linked elsewhere).
  const [error, setError] = useState(
    () => authErrorFromUrl(window.location.href) ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingCategories, setEditingCategories] = useState(false)
  const finance = useFinance().data
  const user = auth.status === 'signed-in' ? auth.session.user : null
  const identities = user?.identities ?? []
  const google = identities.find((item) => item.provider === 'google')
  const googleEmail = google?.identity_data?.email
    ? String(google.identity_data.email)
    : null
  const hasPassword = identities.some((item) => item.provider === 'email')
  const categories = finance?.categories ?? []
  // Tabs (the owner's layout): Geral, Bancos and Pai (Open Finance owner
  // only), Conta. The tab is in the address, so it can be opened directly.
  const bankEnabled = useBankEnabled()
  const [params] = useSearchParams()
  const tabs: [string, string][] = [
    ['geral', 'Geral'],
    ...(bankEnabled
      ? ([
          ['bancos', 'Bancos'],
          ['pai', finance?.otherPerson ?? 'Outra pessoa'],
        ] as [string, string][])
      : []),
    ['conta', 'Conta'],
  ]
  const asked = params.get('aba')
  const tab = tabs.some(([key]) => key === asked) ? asked! : 'geral'

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadMyData(user!)
      toast('Seus dados foram baixados')
    } catch {
      setError('Não consegui baixar seus dados. Confere a internet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings">
      <h2 className="settings-title">Ajustes</h2>

      <div className="settings-account">
        <span className="settings-avatar" aria-hidden="true">
          {(user?.email ?? '?').charAt(0).toUpperCase()}
        </span>
        <span className="settings-text">
          <small>Conectado como</small>
          <b>{user?.email}</b>
        </span>
      </div>

      <nav className="settings-tabs" aria-label="Partes dos ajustes">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            to={key === 'geral' ? '/config' : `/config?aba=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            replace
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Wide screen: the tab's groups side by side. */}
      <div className="settings-body">
        {tab === 'geral' && (
          <>
            <section aria-labelledby="ajustes-categorias">
              <h3 id="ajustes-categorias" className="settings-label">
                Categorias
              </h3>
              <ul className="settings-card">
                <li>
                  <button
                    type="button"
                    className="settings-row action"
                    aria-label="Editar categorias"
                    disabled={!finance}
                    onClick={() => setEditingCategories(true)}
                  >
                    <span className="settings-stack" aria-hidden="true">
                      {categories.slice(0, 5).map((item) => (
                        <CategoryBadge
                          key={item.id}
                          category={item}
                          shape="round"
                        />
                      ))}
                    </span>
                    <span className="settings-text">
                      <b>Editar categorias</b>
                      <small>
                        {!finance
                          ? 'Carregando…'
                          : categories.length === 1
                            ? '1 categoria'
                            : `${categories.length} categorias`}
                      </small>
                    </span>
                    <Chevron />
                  </button>
                </li>
              </ul>
            </section>

            <section aria-labelledby="ajustes-dados">
              <h3 id="ajustes-dados" className="settings-label">
                Seus dados
              </h3>
              <ul className="settings-card">
                <li>
                  <button
                    type="button"
                    className="settings-row action"
                    aria-label="Baixar meus dados"
                    disabled={busy}
                    onClick={download}
                  >
                    <Row
                      icon={<DownloadIcon />}
                      tone="muted"
                      title="Baixar meus dados"
                      detail="Uma cópia de tudo, num arquivo JSON"
                      end={<Chevron />}
                    />
                  </button>
                </li>
                <li>
                  <Link
                    className="settings-row action"
                    to="/privacidade"
                    aria-label="Política de privacidade"
                  >
                    <Row
                      icon={<ShieldIcon />}
                      tone="muted"
                      title="Política de privacidade"
                      detail="O que o app guarda e onde"
                      end={<Chevron />}
                    />
                  </Link>
                </li>
              </ul>
            </section>
          </>
        )}
        {tab === 'bancos' && finance && <BankSection finance={finance} />}
        {tab === 'pai' && finance && <OtherPersonSection finance={finance} />}
        {tab === 'conta' && (
          <>
            <section aria-labelledby="ajustes-entrar">
              <h3 id="ajustes-entrar" className="settings-label">
                Formas de entrar
              </h3>
              <ul className="settings-card">
                {hasPassword && (
                  <li className="settings-row">
                    <Row
                      icon={<LockIcon />}
                      tone="muted"
                      title="E-mail e senha"
                      detail="Ativo"
                    />
                  </li>
                )}
                <li className="settings-row">
                  <Row
                    icon={<GoogleIcon />}
                    tone="google"
                    title="Google"
                    detail={
                      googleEmail ?? (google ? 'Conectado' : 'Não conectado')
                    }
                    end={
                      !google && (
                        <button
                          type="button"
                          className="btn small"
                          aria-label="Conectar conta Google"
                          disabled={busy}
                          onClick={() => run(linkGoogle)}
                        >
                          Conectar
                        </button>
                      )
                    }
                  />
                </li>
              </ul>
            </section>

            <section aria-labelledby="ajustes-sair">
              <h3 id="ajustes-sair" className="settings-label">
                Neste aparelho
              </h3>
              <ul className="settings-card">
                <li>
                  <button
                    type="button"
                    className="settings-row action"
                    aria-label="Sair"
                    disabled={busy}
                    onClick={() => run(signOut)}
                  >
                    <Row
                      icon={<LogoutIcon />}
                      tone="muted"
                      title="Sair"
                      detail="Sai só deste aparelho"
                    />
                  </button>
                </li>
              </ul>
            </section>

            <section aria-labelledby="ajustes-perigo">
              <h3 id="ajustes-perigo" className="settings-label">
                Cuidado
              </h3>
              <ul className="settings-card danger">
                <li>
                  <button
                    type="button"
                    className="settings-row action"
                    aria-label="Apagar minha conta e meus dados"
                    disabled={busy}
                    onClick={() => setDeleting(true)}
                  >
                    <Row
                      icon={<TrashIcon />}
                      tone="neg"
                      title="Apagar minha conta e meus dados"
                      detail="Apaga tudo, sem volta"
                      end={<Chevron />}
                    />
                  </button>
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
      <p className="form-error" role="alert">
        {error}
      </p>

      {editingCategories && finance && (
        <CategoriesModal
          finance={finance}
          onClose={() => setEditingCategories(false)}
        />
      )}
      {deleting && <DeleteAccountModal onClose={() => setDeleting(false)} />}
    </div>
  )
}
