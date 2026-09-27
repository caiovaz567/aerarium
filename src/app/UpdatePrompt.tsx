import { useRegisterSW } from 'virtual:pwa-register/react'

/** How often an open app asks the server for a new version. */
const CHECK_MS = 60 * 60 * 1000

/**
 * Discreet notice when a new version was deployed. It stays until
 * tapped, so a pending undo toast is never replaced by it.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      window.setInterval(check, CHECK_MS)
      // The installed iPhone app is resumed, not reopened: check on return.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
  if (!needRefresh) return null
  return <UpdateBanner onUpdate={() => void updateServiceWorker(true)} />
}

export function UpdateBanner({ onUpdate }: { readonly onUpdate: () => void }) {
  return (
    <div className="toast update-toast" role="status">
      <span>Nova versão disponível.</span>
      <button type="button" onClick={onUpdate}>
        Atualizar
      </button>
    </div>
  )
}
