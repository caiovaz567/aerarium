import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Bar that sticks right below the header (7.4 item 6). While stuck it gets a
 * light shadow and the header drops its own, so there is only one.
 */
export function StickyBar({
  children,
  className = '',
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const update = () => {
      const header = document.querySelector('.app-header')
      const limit = (header?.getBoundingClientRect().bottom ?? 0) + 1
      const top = bar.current?.getBoundingClientRect().top ?? Infinity
      setStuck(window.scrollY > 4 && top <= limit)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('has-stuck', stuck)
    return () => document.body.classList.remove('has-stuck')
  }, [stuck])

  return (
    <div ref={bar} className={`stick${stuck ? ' stuck' : ''} ${className}`}>
      {children}
    </div>
  )
}
