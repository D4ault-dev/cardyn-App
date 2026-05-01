/**
 * pushNotifications.ts
 *
 * Handles push token registration for both:
 *  - Development (Expo Go): uses Expo Push Token → routes through Expo's servers
 *  - Production (EAS build): uses FCM token directly → no Expo middleman
 *
 * Token type is detected automatically — backend receives both so it can
 * send via the right channel depending on which token it has.
 *
 * ── iOS Production Setup (one-time) ─────────────────────────────────────────
 * You need an APNs key uploaded to Firebase so FCM can deliver to iOS:
 *  1. Apple Developer → Certificates, IDs & Profiles → Keys → "+" 
 *  2. Enable "Apple Push Notifications service (APNs)" → Download the .p8 file
 *  3. Firebase Console → Project Settings → Cloud Messaging → iOS app
 *     → Upload APNs Auth Key (.p8) + Key ID + Team ID
 *
 * ── Android Production Setup ────────────────────────────────────────────────
 * Android FCM works automatically once google-services.json is in place.
 * No extra steps needed.
 *
 * ── Backend ─────────────────────────────────────────────────────────────────
 * The backend receives { pushToken, tokenType, platform, device }
 * tokenType = 'expo' | 'fcm'
 * Use the token type to decide which API to call when sending notifications.
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import client from '../api/client'

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

// ── Token type detection ──────────────────────────────────────────────────────

function isExpoGo(): boolean {
  // Expo Go sets appOwnership to 'expo'
  return Constants.appOwnership === 'expo'
}

// ── Android notification channel ─────────────────────────────────────────────

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name:             'Tuka Notifications',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#1677FF',
    sound:            'default',
    enableVibrate:    true,
    showBadge:        true,
  })
  // High-priority channel for order updates
  await Notifications.setNotificationChannelAsync('orders', {
    name:             'Order Updates',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100],
    lightColor:       '#00C853',
    sound:            'default',
  })
}

// ── Permission request ────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: false,   // true = silent delivery without prompt (optional)
    },
  })
  return status === 'granted'
}

// ── Main registration function ────────────────────────────────────────────────

/**
 * Register for push notifications.
 * - In Expo Go: gets an Expo Push Token (for development/testing)
 * - In production build: gets an FCM token (for real delivery)
 * Saves the token + type to the backend.
 */
export async function registerPushToken(): Promise<string | null> {
  // Physical device required — simulators/emulators don't support push
  if (!Device.isDevice) {
    console.log('[Push] Skipping — not a physical device')
    return null
  }

  const granted = await requestPermission()
  if (!granted) {
    console.log('[Push] Permission denied')
    return null
  }

  await ensureAndroidChannel()

  try {
    let token: string
    let tokenType: 'expo' | 'fcm'

    if (isExpoGo()) {
      // ── Development: Expo Push Token ──────────────────────────────────────
      // Push notifications removed from Expo Go in SDK 53+ — skip silently
      console.log('[Push] Expo Go detected — push tokens not supported in SDK 53+. Use a dev build.')
      return null
    } else {
      // ── Production: FCM Device Token ──────────────────────────────────────
      // Direct FCM token — no Expo middleman, works on real iOS/Android builds
      const tokenData = await Notifications.getDevicePushTokenAsync()
      token     = tokenData.data as string
      tokenType = 'fcm'
      console.log('[Push] FCM token (prod):', token.slice(0, 20) + '...')
    }

    // Save to backend — backend stores both token + type
    await client.put('/tuka/user/updateLogin', {
      pushToken: token,
      tokenType,
      platform:  Platform.OS,          // 'ios' | 'android'
      device:    Device.modelName || '',
    })

    return token
  } catch (e) {
    console.warn('[Push] Failed to get token:', e)
    return null
  }
}

// ── Notification tap handler ──────────────────────────────────────────────────

/**
 * Set up listeners for notification interactions.
 * Call this once after the user is logged in (in App.tsx RootNavigator).
 *
 * Supported data payloads from backend:
 *   { screen: 'OrderDetail', params: { orderId: '123' } }
 *   { screen: 'Alerts' }
 *   { screen: 'Wallet' }
 */
export function setupNotificationListeners(navigation: any) {
  // User tapped a notification while app was open or in background
  const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any
    if (!data?.screen || !navigation) return
    try {
      navigation.navigate(data.screen, data.params || {})
    } catch { /* screen might not exist in current stack */ }
  })

  // Notification received while app is in foreground (already handled by setNotificationHandler above)
  // This listener is for any extra in-app logic (e.g. refresh badge count)
  const receiveSub = Notifications.addNotificationReceivedListener(_notification => {
    // Could trigger a badge refresh or in-app toast here if needed
  })

  return () => {
    tapSub.remove()
    receiveSub.remove()
  }
}

/**
 * Clear the app badge count (call after user reads notifications).
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0)
}
