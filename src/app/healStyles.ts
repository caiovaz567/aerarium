const KEY = 'aerarium.estilo.recarregado'

/**
 * Right after a deploy, the browser sometimes keeps a broken copy of the
 * stylesheet (an old file that came back as the page itself), and the app
 * shows with no styles. When the colors are missing, fetch the stylesheets
 * fresh, drop the offline copy and reload, once per session.
 */
export async function healStyles(win: Window = window) {
  const styled = win
    .getComputedStyle(win.document.documentElement)
    .getPropertyValue('--bg')
    .trim()
  if (styled) return false
  try {
    if (win.sessionStorage.getItem(KEY)) return false
    win.sessionStorage.setItem(KEY, '1')
  } catch {
    return false
  }
  const links = [
    ...win.document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]'),
  ]
  await Promise.all(
    links.map((link) =>
      win.fetch(link.href, { cache: 'reload' }).catch(() => null),
    ),
  )
  const workers = (await win.navigator.serviceWorker?.getRegistrations()) ?? []
  await Promise.all(workers.map((worker) => worker.unregister()))
  if ('caches' in win)
    for (const name of await win.caches.keys()) await win.caches.delete(name)
  win.location.reload()
  return true
}
