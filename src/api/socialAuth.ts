/**
 * Social Auth — Expo Go compatible
 * Google: uses your own domain (api.cardyn.net) as redirect URI — no Expo proxy.
 * Token exchange is server-side so the client secret never leaves the backend.
 */
import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { BASE_URL } from './client'

export type SocialUser = {
  name: string
  email: string
  provider: 'google' | 'apple'
  providerId: string
}

// ── Credential cache (refreshed on each app start) ───────────────────────────
let _creds: Record<string, string> | null = null

async function getCredentials(): Promise<Record<string, string>> {
  if (_creds) return _creds
  try {
    const res = await fetch(`${BASE_URL}/tuka/credentials/public?category=social`)
    const json = await res.json()
    if (json.code === 200 && json.data) {
      _creds = json.data as Record<string, string>
      return _creds
    }
  } catch (e) {
    console.warn('[SocialAuth] Could not fetch credentials from backend:', e)
  }
  return {}
}

function getClientId(creds: Record<string, string>): string {
  // Use web client ID for all platforms — server-side exchange handles the secret
  return creds['google_client_id_web'] || creds['google_client_id_ios'] || ''
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN IN
// Flow:
//  1. Open Google OAuth in browser with redirect_uri = https://api.cardyn.net/tuka/auth/googleCallback
//  2. Backend receives the code, redirects to cardyn://auth?code=...
//  3. App catches the deep link, sends code to backend /tuka/auth/googleToken
//  4. Backend exchanges code for tokens server-side, returns user info
//  5. App calls /tuka/auth/social to get JWT
// ─────────────────────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<SocialUser> {
  const creds      = await getCredentials()
  const clientId   = getClientId(creds)
  const redirectUri = 'https://api.cardyn.net/tuka/auth/googleCallback'
  const appScheme  = 'cardyn://auth'  // deep link the backend redirects back to

  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('Google Sign In is not configured yet. Please contact support.')
  }

  const state = Math.random().toString(36).slice(2)

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid profile email',
    state,
    access_type:   'online',
    // prompt=select_account forces account picker even if already signed in
    prompt:        'select_account',
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  // Open browser — listen for redirect back to cardyn:// deep link
  const result = await WebBrowser.openAuthSessionAsync(authUrl, appScheme)

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled')
  }

  // Extract authorization code from deep link: cardyn://auth?code=...
  const url   = result.url
  const query = url.includes('?') ? url.split('?')[1] : ''
  const parts = Object.fromEntries(new URLSearchParams(query))

  // Check for error from Google (e.g. access_denied when app not published)
  if (parts['error']) {
    const errCode = parts['error']
    if (errCode === 'access_denied') {
      throw new Error(
        'Google sign-in is temporarily unavailable. Please use phone/email to sign in, or try again later.'
      )
    }
    throw new Error(`Google sign-in error: ${errCode}`)
  }

  const code  = parts['code']

  if (!code) throw new Error('No authorization code returned from Google')

  // Exchange code server-side — backend uses web client secret, never exposed to app
  const tokenRes = await fetch(`${BASE_URL}/tuka/auth/googleToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const json = await tokenRes.json()
  if (json.code !== 200 || !json.data) {
    throw new Error(json.msg || 'Token exchange failed')
  }

  return {
    name:       json.data.name       || 'Google User',
    email:      json.data.email      || '',
    provider:   'google',
    providerId: json.data.providerId,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLE SIGN IN
// Only works in a dev/production build — gracefully hidden in Expo Go
// ─────────────────────────────────────────────────────────────────────────────
export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  try {
    const mod = await import('expo-apple-authentication')
    return mod.isAvailableAsync()
  } catch {
    return false
  }
}

export async function signInWithApple(): Promise<SocialUser> {
  const mod = await import('expo-apple-authentication')
  const credential = await mod.signInAsync({
    requestedScopes: [
      mod.AppleAuthenticationScope.FULL_NAME,
      mod.AppleAuthenticationScope.EMAIL,
    ],
  })
  const firstName = credential.fullName?.givenName  || ''
  const lastName  = credential.fullName?.familyName || ''
  const name      = [firstName, lastName].filter(Boolean).join(' ') || 'Apple User'
  const email     = credential.email || `${credential.user}@privaterelay.appleid.com`
  return {
    name,
    email,
    provider:   'apple',
    providerId: credential.user,
  }
}

// Expose for prefetch on app start
export function prefetchCredentials() {
  getCredentials().catch(() => {})
}
