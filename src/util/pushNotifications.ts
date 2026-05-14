/**
 * pushNotifications.ts
 *
 * The backend (PushService.java) sends via the Expo Push API (exp.host).
 * That means we always need an Expo Push Token — not a raw FCM/APNs token.
 *
 * Token lifecycle:
 *  - User enables notifications  → get Expo token → save to backend (push_token column)
 *  - User disables notifications → clear push_token on backend → backend stops sending
 *
 * Daily reminder logic lives entirely in the backend (PushService.sendDailyBonusReminder,
 * scheduled at 9:00 AM). The frontend only controls whether the token is stored.
 *
 * NOTE: Expo Push Tokens are NOT supported in Expo Go on SDK 53+.
 * They work in development builds and production builds.
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import client from '../api/client'

// ── Expo Go guard — push notifications not supported in Expo Go SDK 53+ ───────
// In SDK 53+, appOwnership is deprecated. Use executionEnvironment instead.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient'
  || (Constants as any).appOwnership === 'expo'

// Show alerts + play sound when app is in foreground (only in real builds)
if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  })
}

// ── Android notification channels ─────────────────────────────────────────────
async function ensureAndroidChannels() {
  if (IS_EXPO_GO || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name:             'Tuka Notifications',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#00C2B4',
    sound:            'default',
    enableVibrate:    true,
    showBadge:        true,
  })
  await Notifications.setNotificationChannelAsync('orders', {
    name:             'Order Updates',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100],
    lightColor:       '#00C2B4',
    sound:            'default',
  })
}

// ── Permission request ────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_EXPO_GO) return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  })
  return status === 'granted'
}

// ── Get Expo Push Token ───────────────────────────────────────────────────────
async function getExpoPushToken(): Promise<string | null> {
  if (IS_EXPO_GO) {
    console.log('[Push] Expo Go detected — push tokens require a dev/prod build')
    return null
  }
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('[Push] Skipping — not a physical device')
    return null
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId
    console.log('[Push] Getting Expo push token, projectId:', projectId)
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    console.log('[Push] Got token:', tokenData.data?.slice(0, 40) + '...')
    return tokenData.data
  } catch (e: any) {
    console.warn('[Push] Failed to get Expo push token:', e?.message || e)
    // Common causes:
    // - google-services.json project mismatch (APK built with different Firebase project)
    // - FCM not configured in Firebase console
    // - Device has no Google Play Services
    return null
  }
}

// ── Register push token with backend ─────────────────────────────────────────
/**
 * Request permission, get Expo push token, save to backend.
 * Call this when the user enables notifications.
 * Returns the token string, or null if unavailable.
 */
export async function registerPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermission()
  if (!granted) return null

  await ensureAndroidChannels()

  const token = await getExpoPushToken()
  if (!token) return null

  try {
    await client.put('/tuka/user/updateLogin', {
      pushToken: token,
      platform:  Platform.OS,
      device:    Device.modelName || '',
    })
    console.log('[Push] Token registered:', token.slice(0, 30) + '...')
  } catch (e) {
    console.warn('[Push] Failed to save token to backend:', e)
  }

  return token
}

// ── Clear push token from backend (opt-out) ───────────────────────────────────
/**
 * Remove the push token from the backend so the user stops receiving notifications.
 * The backend's sendDailyBonusReminder only sends to users with a non-empty push_token.
 */
export async function clearPushToken(): Promise<void> {
  try {
    await client.put('/tuka/user/updateLogin', {
      pushToken: '',   // empty string → backend sets push_token = NULL
      platform:  Platform.OS,
      device:    Device.modelName || '',
    })
    console.log('[Push] Token cleared from backend')
  } catch (e) {
    console.warn('[Push] Failed to clear token:', e)
  }
}

// ── Notification tap listener ─────────────────────────────────────────────────
/**
 * Set up listeners for notification taps.
 * Supported data payloads from backend:
 *   { screen: 'OrderDetail', params: { orderId: '123' } }
 *   { screen: 'DailyBonus' }
 *   { screen: 'Alerts' }
 */
export function setupNotificationListeners(navigation: any) {
  // Push notifications not supported in Expo Go — return a no-op cleanup
  if (IS_EXPO_GO) return () => {}

  const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as any
    if (!data?.screen || !navigation) return
    try {
      navigation.navigate(data.screen, data.params || {})
    } catch { /* screen might not exist in current stack */ }
  })

  const receiveSub = Notifications.addNotificationReceivedListener(_n => {
    // In-foreground notification received — handler above shows the alert
    // Could trigger badge refresh here if needed
  })

  return () => {
    tapSub.remove()
    receiveSub.remove()
  }
}

// ── Clear badge ───────────────────────────────────────────────────────────────
export async function clearBadge() {
  if (IS_EXPO_GO) return
  await Notifications.setBadgeCountAsync(0)
}
