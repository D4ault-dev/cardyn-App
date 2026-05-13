/**
 * Haptics utility — thin wrapper around expo-haptics.
 * All calls are fire-and-forget; errors are silently swallowed
 * so haptics never crash the app on devices that don't support it.
 */
import * as Haptics from 'expo-haptics'

/** Light tap — tab switches, row selects, toggles */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

/** Medium tap — primary CTAs (Get Started, Login, Submit, Withdraw) */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

/** Heavy tap — destructive actions (Delete, Confirm removal) */
export function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
}

/** Success notification — order submitted, payment done, PIN set */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

/** Error notification — form validation fail, login error */
export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}

/** Warning notification — low balance, rate change alert */
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
}
