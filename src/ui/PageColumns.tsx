import type { ReactNode } from 'react'

/**
 * Every page's two columns on a wide screen: the main list and a side column
 * (on the right, or on the left with `sideLeft`). On phones it is one column,
 * the side's blocks first, in the order they are written.
 */
export function PageColumns({
  side,
  children,
  sideLeft = false,
}: {
  readonly side: ReactNode
  readonly children: ReactNode
  readonly sideLeft?: boolean
}) {
  return (
    <div className={sideLeft ? 'page-cols side-left' : 'page-cols'}>
      <div className="page-side">{side}</div>
      <div className="page-main">{children}</div>
    </div>
  )
}
