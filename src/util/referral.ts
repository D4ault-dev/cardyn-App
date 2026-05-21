/**
 * referral.ts — Referral code capture and attribution
 *
 * Flow:
 *  1. App opens from https://cardyn.net/ref/ABC123 or cardyn://ref/ABC123
 *  2. saveReferralCode('ABC123') stores it in AsyncStorage
 *  3. On first launch, attributeInstall() calls backend with the code
 *  4. On signup, attributeSignup() links the new user to the referrer
 *  5. On first trade, backend auto-triggers the reward (no app action needed)
 */

import storage from './storage'
import client from '../api/client'
import { Platform } from 'react-native'
import * as Application from 'expo-application'

const REF_CODE_KEY      = '@cardyn_pending_ref_code'
const ATTRIBUTED_KEY    = '@cardyn_install_attributed'

// ── Save referral code from deep link ────────────────────────────────────────

export async function saveReferralCode(code: string): Promise<void> {
  if (!code || code.trim().length < 3) return
  const clean = code.trim().toUpperCase()
  // Only save if not already attributed — first referrer wins
  const alreadyAttributed = await storage.getItem(ATTRIBUTED_KEY)
  if (alreadyAttributed === 'true') return
  await storage.setItem(REF_CODE_KEY, clean)
}

export async function getPendingReferralCode(): Promise<string | null> {
  return storage.getItem(REF_CODE_KEY)
}

export async function clearReferralCode(): Promise<void> {
  await storage.removeItem(REF_CODE_KEY)
}

// ── Get a stable device ID for fraud detection ────────────────────────────────

async function getDeviceId(): Promise<string> {
  try {
    // expo-application provides a stable ID per install
    const id = Platform.OS === 'android'
      ? await Application.getAndroidId()
      : await Application.getIosIdForVendorAsync()
    return id || `${Platform.OS}_${Date.now()}`
  } catch {
    return `${Platform.OS}_${Date.now()}`
  }
}

// ── Attribution: call backend on first install ────────────────────────────────

/**
 * Call this once on first app launch (after fetching initial URL).
 * Sends the referral code + device ID to backend for install attribution.
 * Safe to call multiple times — backend deduplicates by device ID.
 */
export async function attributeInstall(): Promise<void> {
  const refCode = await getPendingReferralCode()
  if (!refCode) return

  // Don't re-attribute if already done
  const alreadyAttributed = await storage.getItem(ATTRIBUTED_KEY)
  if (alreadyAttributed === 'true') return

  try {
    const deviceId = await getDeviceId()
    await client.post('/tuka/referral/attribute', {
      refCode,
      deviceId,
      platform: Platform.OS,
    })
    // Mark as attributed — don't send again
    await storage.setItem(ATTRIBUTED_KEY, 'true')
  } catch {
    // Silently fail — will retry on next launch since ATTRIBUTED_KEY not set
  }
}

/**
 * Call this after a new user successfully registers.
 * Links the new user account to the referrer.
 * userId: the newly created user's ID (from /getInfo after signup)
 */
export async function attributeSignup(userId: string | number): Promise<void> {
  const refCode = await getPendingReferralCode()
  if (!refCode) return

  try {
    await client.post('/tuka/referral/signup', {
      refCode,
      userId: String(userId),
    })
    // Clear the pending code after successful signup attribution
    await clearReferralCode()
  } catch {
    // Silently fail — referral is a bonus, not critical to signup
  }
}
