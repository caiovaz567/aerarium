import type { ReactNode } from 'react'

export function EmptyState({
  title,
  children,
  action,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly action?: ReactNode
}) {
  return (
    <section className="state">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  )
}
