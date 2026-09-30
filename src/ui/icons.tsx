import type { SVGProps } from 'react'

// Same strokes as v1. Decorative: buttons carry the aria-label.
function Stroke({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const CalendarIcon = () => (
  <Stroke>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Stroke>
)
export const CardIcon = () => (
  <Stroke>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10.5h18M7 15h4" />
  </Stroke>
)
export const RepeatIcon = () => (
  <Stroke>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
  </Stroke>
)
export const PlusIcon = () => (
  <Stroke strokeWidth={2.6}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
)
export const ChevronLeftIcon = () => (
  <Stroke strokeWidth={2.4}>
    <path d="M15 6l-6 6 6 6" />
  </Stroke>
)
export const ChevronRightIcon = () => (
  <Stroke strokeWidth={2.4}>
    <path d="M9 6l6 6-6 6" />
  </Stroke>
)
export const GearIcon = () => (
  <Stroke>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Stroke>
)
export const CloseIcon = () => (
  <Stroke strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
)

/** Official multicolor "G" required by Google's sign-in button guidelines. */
export const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.7 6c4.5-4.1 7.1-10.2 7.1-17.4z"
    />
    <path
      fill="#FBBC05"
      d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z"
    />
  </svg>
)
export const CheckIcon = () => (
  <Stroke strokeWidth={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
)
export const TrashIcon = () => (
  <Stroke>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Stroke>
)
export const ChevronDownIcon = () => (
  <Stroke strokeWidth={2.4}>
    <path d="M6 9l6 6 6-6" />
  </Stroke>
)
export const DownloadIcon = () => (
  <Stroke>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
  </Stroke>
)
export const EyeIcon = () => (
  <Stroke>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
)
export const EyeOffIcon = () => (
  <Stroke>
    <path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Stroke>
)
export const LockIcon = () => (
  <Stroke>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Stroke>
)
export const ShieldIcon = () => (
  <Stroke>
    <path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Stroke>
)
export const LogoutIcon = () => (
  <Stroke>
    <path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7M10.5 12H20m0 0-3.5-3.5M20 12l-3.5 3.5" />
  </Stroke>
)
export const WalletIcon = () => (
  <Stroke>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <path d="M16 13.5h.01" />
  </Stroke>
)
export const BankIcon = () => (
  <Stroke>
    <path d="M3 9.5 12 4l9 5.5M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3 20h18" />
  </Stroke>
)
export const RefreshIcon = () => (
  <Stroke>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
  </Stroke>
)
export const MailIcon = () => (
  <Stroke>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4 7.5 8 6 8-6" />
  </Stroke>
)
export const PeopleIcon = () => (
  <Stroke>
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Stroke>
)
