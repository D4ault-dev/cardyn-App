import type { Country } from '../api/country'

/**
 * Calculate the settlement rate for a given card rate and country.
 *
 * Nigeria (rateMode = 'multiply'):  settlement = amount × cardRate × todayRate
 * Ghana   (rateMode = 'divide'):    settlement = amount × cardRate / todayRate
 *
 * @param cardRate   - The rate from rateConfigs rows (e.g. 4.5 for iTunes Code)
 * @param country    - The country object with todayRate and rateMode
 * @returns          - The effective rate per $1 of card value in local currency
 */
export function calcEffectiveRate(cardRate: number, country: Country | null | undefined): number {
  if (!country || !cardRate) return cardRate || 0
  const todayRate = country.todayRate ?? 1
  if (country.rateMode === 'divide') {
    // Ghana: cardRate / todayRate  (e.g. 4.5 / 15.8 = 0.285 GHS per $1)
    return todayRate > 0 ? cardRate / todayRate : cardRate
  }
  // Nigeria (default): cardRate × todayRate  (e.g. 4.5 × 1580 = 7110 NGN per $1)
  return cardRate * todayRate
}

/**
 * Calculate settlement amount.
 * @param amount     - Card face value in USD (user input)
 * @param cardRate   - Rate from rateConfigs (e.g. 4.5)
 * @param country    - Country with todayRate and rateMode
 * @param quantity   - Number of cards (default 1)
 */
export function calcSettlement(
  amount: number,
  cardRate: number,
  country: Country | null | undefined,
  quantity = 1
): number {
  if (!amount || !cardRate) return 0
  return amount * calcEffectiveRate(cardRate, country) * quantity
}

/**
 * Get the display rate for the homepage card list.
 * Uses card.displayRate (外显汇率) — NOT multiplied by todayRate.
 * This is the rate the admin sets explicitly for public display.
 *
 * @param displayRate  - card.displayRate from the card category
 * @param country      - country (used for currency symbol only)
 */
export function getDisplayRate(displayRate: number): number {
  return displayRate || 0
}
