// ISO currency code → symbol
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',    GBP: '£',    EUR: '€',
  AUD: 'A$',   CAD: 'C$',   NZD: 'NZ$',
  PHP: '₱',    SGD: 'S$',   MYR: 'RM',
  RUB: '₽',    INR: '₹',    JPY: '¥',
  CNY: '¥',    KRW: '₩',    HKD: 'HK$',
  CHF: 'Fr',   SEK: 'kr',   NOK: 'kr',
  DKK: 'kr',   ZAR: 'R',    BRL: 'R$',
  MXN: 'MX$',  TRY: '₺',    THB: '฿',
  IDR: 'Rp',   VND: '₫',    PLN: 'zł',
  AED: 'AED',  SAR: 'SAR',  TWD: 'NT$',
  // EUR countries — all use €
  DE: '€', FR: '€', IT: '€', ES: '€', NL: '€',
  BE: '€', AT: '€', PT: '€', IE: '€', FI: '€',
  GR: '€', LU: '€',
}

export function currSym(code: string): string {
  const upper = code?.toUpperCase()
  // Direct lookup
  if (CURRENCY_SYMBOLS[upper]) return CURRENCY_SYMBOLS[upper]
  // Short country name → currency code lookup
  const codeMap: Record<string, string> = {
    US: 'USD', UK: 'GBP', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
    PH: 'PHP', SG: 'SGD', MY: 'MYR', RU: 'RUB', IN: 'INR',
    JP: 'JPY', CN: 'CNY', KR: 'KRW', HK: 'HKD', CH: 'CHF',
    SE: 'SEK', NO: 'NOK', DK: 'DKK', ZA: 'ZAR', BR: 'BRL',
    MX: 'MXN', TR: 'TRY', TH: 'THB', ID: 'IDR', VN: 'VND',
    PL: 'PLN', AE: 'AED', SA: 'SAR', TW: 'TWD',
  }
  const iso = codeMap[upper]
  return iso ? (CURRENCY_SYMBOLS[iso] || code) : code || '$'
}

// Country code / currency code → short display label
export const CURRENCY_LABELS: Record<string, string> = {
  // Currency codes → country short name
  USD: 'US',   GBP: 'UK',   EUR: 'EU',
  AUD: 'AU',   CAD: 'CA',   NZD: 'NZ',
  PHP: 'PH',   SGD: 'SG',   MYR: 'MY',
  RUB: 'RU',   INR: 'IN',   JPY: 'JP',
  CNY: 'CN',   KRW: 'KR',   HKD: 'HK',
  CHF: 'CH',   SEK: 'SE',   NOK: 'NO',
  DKK: 'DK',   ZAR: 'ZA',   BRL: 'BR',
  MXN: 'MX',   TRY: 'TR',   THB: 'TH',
  IDR: 'ID',   VND: 'VN',   PLN: 'PL',
  AED: 'AE',   SAR: 'SA',   TWD: 'TW',
  // EUR country codes — already short, pass through
  DE: 'DE', FR: 'FR', IT: 'IT', ES: 'ES', NL: 'NL',
  BE: 'BE', AT: 'AT', PT: 'PT', IE: 'IE', FI: 'FI',
  GR: 'GR', LU: 'LU',
  // Country short names (from tuka_currency.name) — pass through
  US: 'US', UK: 'UK', AU: 'AU', CA: 'CA', NZ: 'NZ',
  PH: 'PH', SG: 'SG', MY: 'MY', RU: 'RU', IN: 'IN',
  JP: 'JP', CN: 'CN', KR: 'KR', HK: 'HK', CH: 'CH',
  SE: 'SE', NO: 'NO', DK: 'DK', ZA: 'ZA', BR: 'BR',
  MX: 'MX', TR: 'TR', TH: 'TH', ID: 'ID', VN: 'VN',
  PL: 'PL', AE: 'AE', SA: 'SA', TW: 'TW',
}

export function currLabel(code: string): string {
  return CURRENCY_LABELS[code?.toUpperCase()] || code
}
