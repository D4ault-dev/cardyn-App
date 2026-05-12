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
// Uses authorization code flow (response_type=code) — implicit flow is blocked
// by Google since 2019. We exchange the code for tokens via the token endpoint.
// ─────────────────────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<SocialUser> {
  const creds       = await getCredentials()
  const clientId    = getClientId(creds)
  const redirectUri = getRedirectUri(creds)

  if (!clientId || clientId.startsWith('YOUR_')) {
    throw new Error('Google Sign In is not configured yet. Please contact support.')
  }

  // Use PKCE code flow — works with both iOS and Android
  const codeVerifier  = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state         = Math.random().toString(36).slice(2)

  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 'openid profile email',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
    access_type:           'online',
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

  // Exchange code for tokens
  const webClientId     = creds['google_client_id_web']     || clientId
  const webClientSecret = creds['google_client_secret']     || ''

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     webClientId,
      client_secret: webClientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const tokens = await tokenRes.json()
  const accessToken = tokens.access_token

  if (!accessToken) throw new Error('No access token from Google token exchange')
  return fetchGoogleUser(accessToken)
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  for (let i = 0; i < 128; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  // SHA-256 hash of the verifier, base64url encoded
  // Use expo-crypto if available, otherwise fall back to plain verifier (S256 → plain)
  try {
    const Crypto = await import('expo-crypto')
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    )
    // Convert base64 to base64url
    return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    // Fallback: use plain code challenge (less secure but works)
    return verifier
  }
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
