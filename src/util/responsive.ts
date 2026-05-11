/**
 * responsive.ts — Cross-platform sizing utilities
 *
 * IMPORTANT: This file uses Dimensions.get() at module load.
 * Do NOT import this from theme files (colors, spacing, typography, shadow).
 * Only import from screen files and components.
 *
 * Design base: iPhone 14 (390 × 844 logical points)
 */

import { Dimensions, Platform } from 'react-native'
import {
  widthPercentageToDP as _wp,
  heightPercentageToDP as _hp,
} from 'react-native-responsive-screen'

const { width: W, height: H } = Dimensions.get('window')

const BASE_W = 390
const BASE_H = 844

// ── Core functions ────────────────────────────────────────────────────────────

/** Width percentage: wp('90%') = 90% of screen width */
export const wp = _wp

/** Height percentage: hp('7%') = 7% of screen height */
export const hp = _hp

/** Scale relative to screen width */
export function sw(size: number): number {
  return Math.round((W / BASE_W) * size)
}

/** Scale relative to screen height */
export function sh(size: number): number {
  return Math.round((H / BASE_H) * size)
}

/**
 * Moderate scale — for font sizes and touch targets.
 * factor 0.4 = subtle scaling, never looks wrong.
 */
export function ms(size: number, factor = 0.4): number {
  return Math.round(size + (sw(size) - size) * factor)
}

/**
 * RF — Responsive Font size.
 * Tiered scaling: small text (9–12px) gets a stronger boost so it never
 * disappears on large Android screens. Normal text gets a medium boost.
 * iOS behaviour is unchanged — scaling is proportional on both platforms.
 *
 * Usage: fontSize: RF(12)
 */
export function RF(size: number): number {
  // Very small text (9–12px) — extra boost so it stays readable on Android
  if (size >= 9 && size <= 12) {
    return Math.round(size + (sw(size) - size) * 0.8)
  }
  // All other text — medium boost
  return Math.round(size + (sw(size) - size) * 0.6)
}

// ── Device detection ──────────────────────────────────────────────────────────

export const isSmallPhone    = W < 360
export const isStandardPhone = W >= 360 && W <= 414
export const isLargePhone    = W > 414 && W < 768
export const isTablet        = W >= 768
export const SCREEN_W        = W
export const SCREEN_H        = H

// ── Keyboard ──────────────────────────────────────────────────────────────────

// Ahantaman bank app pattern (production-tested):
// iOS: 'padding' — shifts content up by keyboard height
// Android: 'padding' — same as iOS; 'height' causes the container to shrink
// which creates a gap/transparent area at the top of the white card on auth screens
export const keyboardBehavior: 'padding' | 'height' | 'position' | undefined =
  'padding'

// ── Named size constants (computed once at load) ──────────────────────────────

export const TOUCH_HEIGHT        = ms(52)
export const TOUCH_HEIGHT_SM     = ms(40)
export const TOUCH_HEIGHT_LG     = ms(56)
export const ICON_SIZE           = ms(22)
export const ICON_SIZE_SM        = ms(18)
export const ICON_SIZE_LG        = ms(28)
export const ICON_SIZE_XS        = ms(12)
export const AVATAR_SM           = ms(36)
export const AVATAR_MD           = ms(44)
export const AVATAR_LG           = ms(52)
export const AVATAR_XL           = ms(72)
// Tab bar: smaller base on Android (60) vs iOS (70), capped so it never
// grows too tall on large Android screens
export const TAB_BAR_HEIGHT      = Platform.OS === 'android'
  ? Math.min(ms(60), 64)   // Android: 60dp base, max 64
  : Math.min(ms(70), 72)   // iOS: 70pt base, max 72
export const TAB_BAR_SIDE_MARGIN = sw(20)
export const TAB_BAR_BORDER_RADIUS = ms(40)
export const FAB_SIZE            = ms(56)
export const CARD_RADIUS         = ms(20)
export const CARD_RADIUS_LG      = ms(28)
export const INPUT_HEIGHT        = ms(52)
export const HEADER_HEIGHT       = ms(56)

// ── Tab bar clearance ─────────────────────────────────────────────────────────

export function tabBarClearance(bottomInset: number): number {
  const tabBottom = Platform.OS === 'android' ? Math.max(bottomInset, 8) : 24
  return TAB_BAR_HEIGHT + tabBottom + 20
}

export function rsp(size: number): number {
  return sw(size)
}
