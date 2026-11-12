// Tabs and switches (".segmented", ".theme-toggle") get one highlight that
// slides to the chosen button instead of jumping. Nothing changes without
// JavaScript or with reduced motion: the chosen button keeps its own look until
// the highlight is placed.
const GROUPS = '.segmented, .theme-toggle'

function place(group: HTMLElement) {
  const chosen = group.querySelector<HTMLElement>(
    ':scope > button[aria-pressed="true"]',
  )
  if (!chosen || !chosen.offsetWidth) {
    group.classList.remove('has-pill', 'pill-moves')
    return
  }
  const style = group.style
  style.setProperty('--pill-x', `${chosen.offsetLeft}px`)
  style.setProperty('--pill-y', `${chosen.offsetTop}px`)
  style.setProperty('--pill-w', `${chosen.offsetWidth}px`)
  style.setProperty('--pill-h', `${chosen.offsetHeight}px`)
  if (group.classList.contains('has-pill')) {
    group.classList.add('pill-moves')
    return
  }
  // The first placement does not slide in from the corner.
  group.classList.add('has-pill')
}

/** Keeps every highlight under `root` in place; returns the way to stop. */
export function watchSlidingPills(root: HTMLElement) {
  let frame = 0
  const update = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      root.querySelectorAll<HTMLElement>(GROUPS).forEach(place)
    })
  }
  const observer = new MutationObserver(update)
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-pressed'],
  })
  window.addEventListener('resize', update)
  void document.fonts?.ready.then(update)
  update()
  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    window.removeEventListener('resize', update)
  }
}
