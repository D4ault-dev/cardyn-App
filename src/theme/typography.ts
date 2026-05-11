/**
 * Cardyn — Typography Scale
 * Plain numbers — no runtime dependencies, safe to import anywhere.
 * Use ms() from responsive.ts inside StyleSheet.create for scaling.
 */

import { Platform } from 'react-native'

export const typography = {
  size: {
    xs:    11,
    sm:    12,
    base:  14,
    md:    15,
    lg:    16,
    xl:    18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },
  weight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1.5,
  },
} as const

/**
 * Android doesn't render intermediate font weights (500, 600) — they fall back
 * to 400. This helper bumps weights up one step on Android so text looks
 * consistently bold across both platforms.
 *
 * Usage:  fontWeight: fw('medium')   →  '500' on iOS, '700' on Android
 *         fontWeight: fw('semibold') →  '600' on iOS, '700' on Android
 *         fontWeight: fw('bold')     →  '700' on both
 *         fontWeight: fw('extrabold')→  '800' on both
 */
const androidBump: Record<keyof typeof typography.weight, keyof typeof typography.weight> = {
  regular:   'medium',
  medium:    'bold',
  semibold:  'bold',
  bold:      'extrabold',
  extrabold: 'extrabold',
}

export function fw(weight: keyof typeof typography.weight): string {
  const key = Platform.OS === 'android' ? androidBump[weight] : weight
  return typography.weight[key]
}

/**
 * Pre-scaled font sizes — use these in StyleSheet.create() instead of
 * typography.size.* directly. They apply ms() moderate scaling so text
 * looks consistent across all screen densities on both iOS and Android.
 *
 * Import from theme: import { typography, fontSize } from '../theme'
 *
 * Usage:
 *   fontSize: fontSize.lg        // instead of: fontSize: typography.size.lg
 *   fontSize: fontSize['2xl']    // instead of: fontSize: typography.size['2xl']
 */
import { ms } from '../util/responsive'

export const fontSize = {
  xs:    ms(typography.size.xs),
  sm:    ms(typography.size.sm),
  base:  ms(typography.size.base),
  md:    ms(typography.size.md),
  lg:    ms(typography.size.lg),
  xl:    ms(typography.size.xl),
  '2xl': ms(typography.size['2xl']),
  '3xl': ms(typography.size['3xl']),
  '4xl': ms(typography.size['4xl']),
  '5xl': ms(typography.size['5xl']),
} as const
