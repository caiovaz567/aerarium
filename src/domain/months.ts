import {
  addMonths as shiftDate,
  format,
  getDaysInMonth,
  isValid,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

declare const monthBrand: unique symbol
declare const dateBrand: unique symbol
export type Month = string & { readonly [monthBrand]: true }
export type ISODate = string & { readonly [dateBrand]: true }

export function month(value: string): Month {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new RangeError('Mês inválido. Use AAAA-MM.')
  return value as Month
}

export function isoDate(value: string): ISODate {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) || !isValid(parseISO(value))) {
    throw new RangeError('Data inválida. Use AAAA-MM-DD.')
  }
  return value as ISODate
}

export function monthOf(value: ISODate): Month {
  return month(isoDate(value).slice(0, 7))
}

export function monthStart(value: Month): ISODate {
  return isoDate(`${month(value)}-01`)
}

export function addMonths(value: Month, count: number): Month {
  if (!Number.isSafeInteger(count))
    throw new RangeError('Quantidade de meses inválida.')
  return month(format(shiftDate(parseISO(monthStart(value)), count), 'yyyy-MM'))
}

export function monthsBetween(first: Month, last: Month): number {
  const index = (value: Month) =>
    Number(month(value).slice(0, 4)) * 12 + Number(value.slice(5)) - 1
  return index(last) - index(first)
}

export function monthRange(first: Month, last: Month): Month[] {
  const length = monthsBetween(first, last) + 1
  if (length < 1)
    throw new RangeError('O fim do período deve vir depois do início.')
  return Array.from({ length }, (_, index) => addMonths(first, index))
}

export function daysInMonth(value: Month): number {
  return getDaysInMonth(parseISO(monthStart(value)))
}

export function monthName(value: Month): string {
  const name = format(parseISO(monthStart(value)), 'MMMM', { locale: ptBR })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function monthLabel(value: Month): string {
  return `${monthName(value)} ${value.slice(0, 4)}`
}

export function monthShort(value: Month): string {
  return (
    monthName(value).slice(0, 3).toLowerCase() +
    (value.endsWith('-01') ? `/${value.slice(2, 4)}` : '')
  )
}

/** The clock is supplied by the caller, keeping the domain deterministic. */
export function dateInSaoPaulo(instant: Date): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return isoDate(`${part('year')}-${part('month')}-${part('day')}`)
}
