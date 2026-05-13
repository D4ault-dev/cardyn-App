/**
 * Firebase initialization
 *
 * HOW TO SET UP FIREBASE (do this once before deploying):
 * ─────────────────────────────────────────────────────────
 * 1. Go to https://console.firebase.google.com
 * 2. Click "Add project" → name it "Tuka" → disable Google Analytics for now
 *    (we use our own analytics.ts wrapper below)
 * 3. Once project is created:
 *
 *    ── iOS ──
 *    a. Click the iOS icon → Bundle ID: com.tuka.giftcard
 *    b. Download GoogleService-Info.plist
 *    c. Place it at: NGAPP/app/GoogleService-Info.plist
 *    d. In app.json add under "ios": { "googleServicesFile": "./GoogleService-Info.plist" }
 *
 *    ── Android ──
 *    a. Click the Android icon → Package: com.tuka.giftcard
 *    b. Download google-services.json
 *    c. Place it at: NGAPP/app/google-services.json  (already referenced in app.json)
 *
 *    ── Web / JS SDK config ──
 *    a. In Firebase console → Project Settings → General → scroll to "Your apps"
 *    b. Click "</>" (web) → register app → copy the firebaseConfig object
 *    c. Paste the values into the FIREBASE_CONFIG object below
 *
 * 4. Enable Analytics:
 *    Firebase console → Analytics → Get started
 *
 * 5. Connect ad platforms (no code needed):
 *    - Facebook: Events Manager → Partner Integrations → Firebase
 *    - TikTok:   TikTok Ads Manager → Assets → Events → App Events → Firebase
 *    - Google:   Google Ads → Tools → Linked accounts → Firebase
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics'

// ── Paste your Firebase project config here ──────────────────────────────────
// Project: cardyn-f8b9f
// Get measurementId from: Firebase Console → Project Settings → Your apps → Web app
// If no web app exists yet: Add app → Web → register → copy config
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDJfaQvftn9uDo9P4b1knXYsMqPNDbN2M0',  // from google-services.json
  authDomain:        'cardyn-f8b9f.firebaseapp.com',
  projectId:         'cardyn-f8b9f',
  storageBucket:     'cardyn-f8b9f.firebasestorage.app',
  messagingSenderId: '100088840513',
  appId:             '1:100088840513:android:ca72e5f4446998f35461c0',  // Android app ID
  // measurementId: 'G-XXXXXXXXXX',  // ← Add this from Firebase Console → Web app config
}
// ─────────────────────────────────────────────────────────────────────────────

let app: FirebaseApp | null = null
let analytics: Analytics | null = null
let _initialized = false

export async function initFirebase(): Promise<void> {
  if (_initialized) return
  _initialized = true

  // Config is set — proceed with initialization
  if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === 'YOUR_PROJECT_ID') {
    console.warn('[Firebase] Project ID not configured — analytics disabled.')
    return
  }

  try {
    app = getApps().length === 0
      ? initializeApp(FIREBASE_CONFIG)
      : getApps()[0]

    const supported = await isSupported()
    if (supported) {
      analytics = getAnalytics(app)
    }
  } catch (e) {
    console.warn('[Firebase] Init failed:', e)
  }
}

export function getFirebaseAnalytics(): Analytics | null {
  return analytics
}

export { app }
