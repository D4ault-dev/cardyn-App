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
    android: creds['google_client_id_android'] || '',
    default: creds['google_client_id_ios']     || '',
  })!
}

function getRedirectUri(creds: Record<string, string>): string {
  // Google auto-registers reverse-DNS redirect URIs for native iOS/Android clients
  // Format: com.googleusercontent.apps.{CLIENT_ID_PREFIX}:/oauth2redirect
  return Platform.select({
    ios:     creds['google_redirect_uri']         || '',
    android: creds['google_redirect_uri_android'] || '',
    default: creds['google_redirect_uri']         || '',
  })!
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE SIGN IN
// Uses iOS/Android client IDs with Google's native app redirect (no Web client needed)
// The redirect URI is auto-registered by Google — no manual setup in Console required
// ─────────────────────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<SocialUser> {
  const creds       = await getCredentials()
  const clientId    = getClientId(creds)
  const redirectUri = getRedirectUri(creds)

  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('Google Sign In is not configured yet. Please contact support.')
  }

  const state  = Math.random().toString(36).slice(2)
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'token',
    scope:         'openid profile email',
    state,
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  const result  = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled')
  }

  // Extract access_token from redirect URL fragment or query string
  const url   = result.url
  const hash  = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || ''
  const parts = Object.fromEntries(new URLSearchParams(hash))
  const token = parts['access_token']

  if (!token) throw new Error('No access token returned from Google')
  return fetchGoogleUser(token)
}

async function fetchGoogleUser(accessToken: string): Promise<SocialUser> {
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
