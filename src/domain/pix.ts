/**
 * A Pix key as people read it: a CPF (11 digits) as 191.270.787-01, a CNPJ
 * (14 digits) as 12.345.678/0001-90; anything else (e-mail, phone, random
 * key) as typed.
 */
export function pixKeyText(key: string): string {
  const clean = key.trim()
  const digits = clean.replace(/\D/g, '')
  const onlyNumber = /^[\d.\-/\s]+$/.test(clean)
  if (onlyNumber && digits.length === 11)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (onlyNumber && digits.length === 14)
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    )
  return clean
}

/** What to copy: a CPF or CNPJ with digits only, anything else as typed. */
export function pixKeyValue(key: string): string {
  const clean = key.trim()
  return /^[\d.\-/\s]+$/.test(clean) ? clean.replace(/\D/g, '') : clean
}

/** "CPF", "CNPJ" or "Chave". */
export function pixKeyKind(key: string): string {
  const value = pixKeyValue(key)
  if (/^\d{11}$/.test(value)) return 'CPF'
  if (/^\d{14}$/.test(value)) return 'CNPJ'
  return 'Chave'
}
