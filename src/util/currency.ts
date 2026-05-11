/**
 * currency.ts — Currency utilities for Tuka
 *
 * Rate logic (matches backend):
 *   Nigeria (multiply): settlement = amount × cardRate × todayRate
 *   Ghana   (divide):   settlement = amount × cardRate ÷ todayRate
 *
 * todayRate is set by admin in the Country config panel.
 * It represents how many local currency units equal 1 USD.
 *   e.g. Nigeria: todayRate = 1580  → ₦1580 per $1
 *        Ghana:   todayRate = 15.8  → GH₵15.8 per $1
 */

export type CountryLike = {
  todayRate: number
  rateMode: 'multiply' | 'divide'
  currencySymbol: string
  currencyName: string
  flag?: string
  name: string
}

/**
 * Convert a USD card amount to local currency using the country's todayRate.
 *
 * @param usdAmount  - The card face value in USD
 * @param cardRate   - The admin-set base rate (e.g. 4.5 per $1)
 * @param country    - The target country object
 * @returns          - Settlement amount in local currency
 *
 * @example
 *   // Nigeria: $100 card, cardRate=4.5, todayRate=1580
 *   toLocalCurrency(100, 4.5, nigeria) → 711,000 ₦
 *
 *   // Ghana: $100 card, cardRate=4.5, todayRate=15.8
 *   toLocalCurrency(100, 4.5, ghana) → 28.48 GH₵
 */
export function toLocalCurrency(
  usdAmount: number,
  cardRate: number,
  country: CountryLike,
): number {
  const { todayRate, rateMode } = country
  if (!todayRate || todayRate === 0) return usdAmount * cardRate
  if (rateMode === 'divide') {
    return usdAmount * cardRate / todayRate
  }
  return usdAmount * cardRate * todayRate
}

/**
 * Convert an amount from one country's currency to another,
 * going through USD as the bridge.
 *
 * Both countries must have todayRate set in admin.
 *
 * @param amount      - Amount in fromCountry's currency
 * @param fromCountry - Source country
 * @param toCountry   - Target country
 * @returns           - Equivalent amount in toCountry's currency
 *
 * @example
 *   // Convert ₦50,000 to GH₵
 *   convertCurrency(50000, nigeria, ghana)
 */
export function convertCurrency(
  amount: number,
  fromCountry: CountryLike,
  toCountry: CountryLike,
): number {
  // Step 1: convert fromCountry amount → USD
  const usd = toUSD(amount, fromCountry)
  // Step 2: convert USD → toCountry amount
  return fromUSD(usd, toCountry)
}

/**
 * Convert local currency amount to USD equivalent.
 */
export function toUSD(localAmount: number, country: CountryLike): number {
  const { todayRate, rateMode } = country
  if (!todayRate || todayRate === 0) return localAmount
  if (rateMode === 'divide') {
    // local = usd × rate ÷ todayRate  →  usd = local × todayRate ÷ rate
    // For simple conversion (no cardRate), treat cardRate=1
    return localAmount * todayRate
  }
  // local = usd × rate × todayRate  →  usd = local ÷ todayRate
  return localAmount / todayRate
}

/**
 * Convert USD amount to local currency equivalent.
 */
export function fromUSD(usdAmount: number, country: CountryLike): number {
  const { todayRate, rateMode } = country
  if (!todayRate || todayRate === 0) return usdAmount
  if (rateMode === 'divide') {
    return usdAmount / todayRate
  }
  return usdAmount * todayRate
}

/**
 * Format a number as local currency string.
 *
 * @example
 *   fmtCurrency(1234567.5, '₦') → '₦1,234,567.50'
 */
export function fmtCurrency(amount: number, symbol = '₦', decimals = 2): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  return `${symbol}${val.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Get the display label for a currency code.
 * Falls back to the code itself if not found.
 */
export function currLabel(code: string): string {
  const map: Record<string, string> = {
    USD: 'US Dollar',
    GBP: 'British Pound',
    EUR: 'Euro',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    AMEX: 'Amex',
    VISA: 'Visa',
    MASTERCARD: 'Mastercard',
  }
  return map[code] || code
}

/**
 * Get the currency symbol for a code.
 */
export function currSym(code: string): string {
  const map: Record<string, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    CAD: 'CA$',
    AUD: 'A$',
  }
  return map[code] || code
}
