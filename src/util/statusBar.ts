/**
 * Status bar height utility — based on F8 app (Facebook) production pattern.
 *
 * F8 approach: manual padding based on Platform.OS and Platform.Version
 * instead of relying on SafeAreaView (which is unreliable on Android).
 *
 * Reference: f8app-main/js/common/F8Header.js
 */

import { Platform, StatusBar } from 'react-native'
import Constants from 'expo-constants'

/**
 * Returns the correct status bar height for manual top padding.
 *
 * - iOS: uses expo-constants statusBarHeight which correctly handles
 *   notched iPhones (44px) vs older iPhones (20px)
 * - Android API < 21: 0 (pre-Lollipop has no translucent status bar)
 * - Android API >= 21: use StatusBar.currentHeight or fallback to 25
 */
export function getStatusBarHeight(): number {
  if (Platform.OS === 'ios') {
    // expo-constants gives the correct value for all iOS devices:
    // - iPhone X+ (notch): 44px
    // - iPhone SE / older: 20px
    return Constants.statusBarHeight ?? 20
  }

  // Android: pre-Lollipop has no translucent status bar
  if (Platform.Version && (Platform.Version as number) < 21) {
    return 0
  }

  // Use the system-reported height, fallback to 25 if unavailable
  return StatusBar.currentHeight ?? 25
}

/**
 * Standard header height including status bar padding.
 * F8 pattern: iOS = 45 + status, Android = 60 + status
 */
export const HEADER_HEIGHT =
  Platform.OS === 'ios'
    ? 45 + getStatusBarHeight()
    : 60 + getStatusBarHeight()

/**
 * Convenience constant — call once at module level for performance.
 */
export const STATUS_BAR_HEIGHT = getStatusBarHeight()
