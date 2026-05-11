/**
 * Cardyn — Spacing & Radius
 * Plain numbers — no runtime dependencies, safe to import anywhere.
 * Use sw() from responsive.ts inside StyleSheet.create for scaling.
 */

export const spacing = {
  0:   0,
  1:   4,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  10:  40,
  12:  48,
  16:  64,
} as const

export const radius = {
  sm:    6,
  md:    10,
  lg:    14,
  xl:    18,
  '2xl': 24,
  '3xl': 32,
  full:  999,
} as const

export { shadow } from './shadow'
