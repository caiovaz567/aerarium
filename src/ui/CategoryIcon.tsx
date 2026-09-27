import type { ReactNode } from 'react'
import type { CategoryIconName } from '../domain/categories'

// Line drawings for categories, same stroke style as icons.tsx. The list of
// names is in src/domain/categories.ts (CATEGORY_ICONS).
const DRAWINGS: Record<CategoryIconName, ReactNode> = {
  food: (
    <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7h3" />
  ),
  cart: (
    <>
      <path d="M3 4h2l2.3 11h10.4L20 7.5H6" />
      <circle cx="9" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
    </>
  ),
  coffee: (
    <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12.5 3.5v2.5" />
  ),
  car: (
    <>
      <path d="M4 16v-3l2-5h12l2 5v3H4z" />
      <circle cx="8" cy="17.5" r="1.5" />
      <circle cx="16" cy="17.5" r="1.5" />
    </>
  ),
  bus: (
    <path d="M6 4h12a1 1 0 0 1 1 1v12H5V5a1 1 0 0 1 1-1zM5 11h14M8 17v2.5M16 17v2.5M8.5 14h.01M15.5 14h.01" />
  ),
  fuel: (
    <path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9M14 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3" />
  ),
  plane: <path d="M21 3 3 10.5l7 2.5 2.5 7zM10 13l5-5" />,
  home: <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  phone: (
    <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2" />
  ),
  heart: (
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  ),
  pill: (
    <path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l6.5-6.5a4.95 4.95 0 0 1 7 7zM7 10.5l6.5 6.5" />
  ),
  dumbbell: <path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11" />,
  star: (
    <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" />
  ),
  game: (
    <path d="M7 8.5h10a4 4 0 0 1 4 4v1a2.5 2.5 0 0 1-4.5 1.5L15 13.5H9L7.5 15A2.5 2.5 0 0 1 3 13.5v-1a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M15.5 11h.01M17 12.5h.01" />
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  tv: <path d="M3.5 7h17v11h-17zM9 21h6M8 3l4 4 4-4" />,
  bag: <path d="M5 8h14l-1.2 12H6.2zM9 8a3 3 0 0 1 6 0" />,
  shirt: (
    <path d="M8.5 4 4 7l2 3.5 2-1V20h8V9.5l2 1L20 7l-4.5-3a3.5 3.5 0 0 1-7 0z" />
  ),
  gift: (
    <path d="M4.5 11h15v9h-15zM3.5 7.5h17V11h-17zM12 7.5V20M12 7.5C11 4.5 7.5 4 7.5 6s4.5 1.5 4.5 1.5 4.5.5 4.5-1.5-3.5-1.5-4.5 1.5" />
  ),
  book: (
    <path d="M3.5 5.5H9a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5h-6zM20.5 5.5H15a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5h6z" />
  ),
  pet: (
    <>
      <circle cx="6" cy="10.5" r="1.6" />
      <circle cx="9.5" cy="6.5" r="1.6" />
      <circle cx="14.5" cy="6.5" r="1.6" />
      <circle cx="18" cy="10.5" r="1.6" />
      <path d="M12 12c-3 0-5 3-5 5a2.5 2.5 0 0 0 3 2.3 7 7 0 0 1 4 0A2.5 2.5 0 0 0 17 17c0-2-2-5-5-5z" />
    </>
  ),
  repeat: (
    <path d="M17 3l3 3-3 3M4 12V9.5A3.5 3.5 0 0 1 7.5 6H20M7 21l-3-3 3-3M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H4" />
  ),
  invest: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  bank: (
    <path d="M3 9.5 12 4l9 5.5M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3 20h18" />
  ),
  tools: (
    <path d="M14.5 5.5a4 4 0 0 0-5.3 5.3L4 16l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.5-.5-2.4z" />
  ),
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3.2} />,
  tag: <path d="M3.5 12.5v-8h8l9 9-8 8zM8 8.5h.01" />,
}

/** A receipt: things without a category. */
const NONE = <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />

export function CategoryIcon({
  icon,
}: {
  /** A CATEGORY_ICONS name; null draws the "no category" receipt. */
  readonly icon: string | null
}) {
  const drawing =
    icon === null ? NONE : (DRAWINGS[icon as CategoryIconName] ?? DRAWINGS.tag)
  return (
    <svg
      className="cat-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  )
}
