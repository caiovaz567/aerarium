import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWide } from '../app/headerSlotContext'

const GAP = 12

/**
 * Wide screens: blocks of different heights in columns with no holes. Block 1
 * goes to the first column, 2 to the second and so on, then it starts over,
 * so the top row reads in order. Phones: one column, as written.
 */
export function Masonry({
  children,
  minWidth = 440,
}: {
  readonly children: ReactNode
  readonly minWidth?: number
}) {
  const wide = useWide()
  const box = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(1)
  useEffect(() => {
    const node = box.current
    if (!wide || !node) return
    const measure = () =>
      setCount(
        Math.max(1, Math.floor((node.clientWidth + GAP) / (minWidth + GAP))),
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [wide, minWidth])

  const items = Children.toArray(children)
  if (!wide) return <div className="masonry">{items}</div>
  const columns: ReactNode[][] = Array.from({ length: count }, () => [])
  items.forEach((item, index) => columns[index % count]!.push(item))
  return (
    <div ref={box} className="masonry">
      {columns.map((column, index) => (
        <div className="masonry-col" key={index}>
          {column}
        </div>
      ))}
    </div>
  )
}
