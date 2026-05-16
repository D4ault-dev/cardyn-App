/**
 * Social Auth — Expo Go compatible
 * Client IDs are fetched from the backend DB (not hardcoded).
 * Admin can update them anytime from the Credentials page.
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
  return Platform.select({
    ios:     creds['google_client_id_ios']     || '',
    android: creds['google_client_id_web']     || creds['google_client_id_android'] || '',
    default: creds['google_client_id_web']     || creds['google_client_id_ios']     || '',
  })!
}

function getRedirectUri(creds: Record<string, string>): string {
  return Platform.select({
    ios:     creds['google_redirect_uri']         || '',
    android: creds['google_redirect_uri_android'] || 'https://auth.expo.io/@tuka21/cardflex',
    default: creds['google_redirect_uri']         || '',
  })!
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN IN
// iOS: uses iOS client ID + custom scheme redirect (no secret needed)
// Android: uses web client ID + server-side token exchange
// ─────────────────────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<SocialUser> {
  const creds       = await getCredentials()
  const redirectUri = getRedirectUri(creds)

  // iOS uses the iOS client (no secret needed for native apps)
  // Android uses the web client (secret kept server-side)
  const clientId = Platform.OS === 'ios'
    ? (creds['google_client_id_ios'] || '')
    : (creds['google_client_id_web'] || creds['google_client_id_android'] || '')

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
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  const result  = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled')
  }

  // Extract authorization code from redirect URL
  const url   = result.url
  const query = url.includes('?') ? url.split('?')[1] : url.split('#')[1] || ''
  const parts = Object.fromEntries(new URLSearchParams(query))
  const code  = parts['code']

  if (!code) throw new Error('No authorization code returned from Google')

  if (Platform.OS === 'ios') {
    // iOS: exchange directly — iOS OAuth clients don't require a client secret
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:    clientId,
        redirect_uri: redirectUri,
        grant_type:   'authorization_code',
      }).toString(),
    })
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Token exchange failed: ${err}`)
    }
    const tokens = await tokenRes.json()
    const accessToken = tokens.access_token
    if (!accessToken) throw new Error('No access token from Google')
    return fetchGoogleUserInfo(accessToken)
  } else {
    // Android/web: exchange server-side to keep client_secret off device
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
}

async function fetchGoogleUserInfo(accessToken: string): Promise<SocialUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Google user info')
  const data = await res.json()
  return {
    name:       data.name  || data.email?.split('@')[0] || 'Google User',
    email:      data.email || '',
    provider:   'google',
    providerId: data.sub,
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
