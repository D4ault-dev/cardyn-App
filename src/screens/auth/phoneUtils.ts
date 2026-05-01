import { Country } from '../../api/country'

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function prefixWithPlus(prefix: string) {
  const d = digitsOnly(prefix)
  return d ? `+${d}` : ''
}

// Expected local digit count by phone prefix
const PREFIX_DIGITS: Record<string, number> = {
  '234': 11, '233': 10, '254': 10, '256': 10, '255': 10,
  '250': 10, '27': 10,  '237': 9,  '44': 11,  '1': 10,
  '91': 10,  '86': 11,  '33': 10,  '49': 11,  '55': 11,
  '52': 10,  '61': 10,  '81': 11,  '82': 11,  '65': 8,
  '60': 10,  '63': 11,  '66': 10,  '62': 12,  '92': 11,
  '880': 11, '20': 11,  '212': 10, '213': 10, '216': 8,
  '251': 10, '260': 10, '263': 10, '264': 10, '267': 8,
}

export function getExpectedDigits(country: Country): number | null {
  return PREFIX_DIGITS[digitsOnly(country.phonePrefix)] ?? null
}

export function sanitizePhone(value: string, country: Country): string {
  const max = getExpectedDigits(country) ?? 14
  return digitsOnly(value).slice(0, max)
}

export function isValidPhone(value: string, country: Country): boolean {
  const sanitized = sanitizePhone(value, country)
  const expected = getExpectedDigits(country)
  if (expected) return sanitized.length === expected
  return sanitized.length >= 6 && sanitized.length <= 14
}

export function getFullPhone(localPhone: string, country: Country): string {
  const local = sanitizePhone(localPhone, country)
  const prefix = digitsOnly(country.phonePrefix)
  const stripped = local.startsWith('0') ? local.slice(1) : local
  return `${prefix}${stripped}`
}

export function isValidEmail(value: string): boolean {
  const t = value.trim()
  return t.includes('@') && t.includes('.')
}

export function maskPhone(p: string): string {
  return p.length < 4 ? p : '***' + p.slice(-4)
}
