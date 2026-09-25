import { dateInSaoPaulo, monthOf, type Month } from '../domain/months'

export const currentMonth = (now = new Date()): Month =>
  monthOf(dateInSaoPaulo(now))

export const monthPath = (value: Month) => `/meses/${value}`
