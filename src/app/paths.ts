import { dateInSaoPaulo, month, monthOf, type Month } from '../domain/months'

export const currentMonth = (now = new Date()): Month =>
  monthOf(dateInSaoPaulo(now))

export const monthPath = (value: Month) => `/meses/${value}`

export function parseMonth(value: string | null | undefined): Month | null {
  try {
    return value ? month(value) : null
  } catch {
    return null
  }
}
