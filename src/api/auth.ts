import storage from '../util/storage'
import client, { setAuthToken, clearAuthToken } from './client'

const TOKEN_KEY = '@tuka_auth_token'

export type ApiUser = {
  userId: number
  userName: string
  nickName: string
  email: string
  phonenumber: string
  avatar: string
  country?: string   // stored at registration — e.g. 'Nigeria', 'Ghana'
}

// ── Persist token ──
async function saveToken(token: string) {
  await storage.setItem(TOKEN_KEY, token)
}
async function loadToken(): Promise<string | null> {
  return storage.getItem(TOKEN_KEY)
}
async function deleteToken() {
  await storage.removeItem(TOKEN_KEY)
}

// ── Login ──
export async function apiLogin(username: string, password: string): Promise<string> {
  const res = await client.post('/login', { username, password, code: '', uuid: '' })
  const token: string = res.data.token
  await saveToken(token)
  setAuthToken(token)
  return token
}

// ── Get user info ──
export async function apiGetUserInfo(): Promise<ApiUser> {
  const res = await client.get('/getInfo')
  return res.data.user as ApiUser
}

// ── Register ──
export async function apiRegister(username: string, password: string): Promise<void> {
  await client.post('/register', { username, password, code: '', uuid: '' })
}

// ── Logout ──
export async function apiLogout(): Promise<void> {
  try { await client.delete('/logout') } catch {}
  await deleteToken()
  clearAuthToken()
}

// ── Restore session from AsyncStorage on app start ──
export async function restoreSession(): Promise<string | null> {
  const token = await loadToken()
  if (token) {
    setAuthToken(token)
    // Validate token is still alive by calling getInfo
    try {
      await client.get('/getInfo')
      return token
    } catch (err: any) {
      // Only clear token on explicit 401 (expired/invalid)
      // Network errors (no internet, server down) should NOT log the user out
      const status = err?.response?.status
      const code   = err?.response?.data?.code
      if (status === 401 || code === 401) {
        await deleteToken()
        clearAuthToken()
        return null
      }
      // Network error — keep token, user stays logged in
      return token
    }
  }
  return null
}
