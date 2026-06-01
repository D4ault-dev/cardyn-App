import React, { useContext, useEffect, useState } from 'react'
import { Nothing, Maybe, Just } from '../util/Maybe'
import storage from '../util/storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import {
  apiLogin, apiGetUserInfo, apiLogout,
  restoreSession, ApiUser,
} from '../api/auth'
import client, { onSessionExpired, setAuthToken } from '../api/client'
import { SocialUser } from '../api/socialAuth'
import { registerPushToken } from '../util/pushNotifications'
import { Analytics } from '../util/analytics'
import { trackAdEvent } from '../util/adManager'
import { attributeSignup } from '../util/referral'
import { fetchCardCategories } from '../api/cards'
import { fetchCurrencies } from '../api/currency'
import { cacheClear } from '../util/cache'
import { fetchCountries } from '../api/country'

export type SignupPayload = {
  name: string
  username: string
  phone: string
  country: string
  password: string
  email?: string
  referralCode?: string
}

export type AuthContextType = {
  user: Maybe<User>
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (phone: string, newPassword: string, pinId?: string, otp?: string) => Promise<void>
  loginWithSocial: (socialUser: SocialUser, country?: string) => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = React.createContext<AuthContextType>(null as any)
export const useAuth = () => useContext(AuthContext)

const NAME_KEY = '@tuka_user_name'

async function saveUserName(name: string) { await storage.setItem(NAME_KEY, name) }
async function loadUserName(): Promise<string | null> { return storage.getItem(NAME_KEY) }
async function clearUserName() { await storage.removeItem(NAME_KEY) }

/** Fire-and-forget: warm up in-memory caches right after login so screens load instantly */
function prefetchStaticData(country?: string) {
  fetchCountries(true).catch(() => {})
  fetchCardCategories(true, country || '').catch(() => {})
  fetchCurrencies(true).catch(() => {})
}

function apiUserToUser(u: ApiUser, overrideName?: string | null): User {
  const name = overrideName ||
    (u.nickName && u.nickName !== u.userName ? u.nickName : null) ||
    u.userName
  return {
    uid: String(u.userId),
    name,
    email: u.email || '',
    country: u.country || undefined,
    walletBalance: 0,
    level: 1,
    xp: 0,
    referralCode: u.userName.slice(0, 8).toUpperCase(),
    bankAccounts: [],
    notificationTokens: [],
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Maybe<User>>(Nothing())
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app start
  useEffect(() => {
    restoreSession().then(async token => {
      if (token) {
        try {
          const [u, savedName] = await Promise.all([apiGetUserInfo(), loadUserName()])
          const mappedUser = apiUserToUser(u, savedName)
          setUser(Just(mappedUser))
          // Warm up caches in background — screens load instantly
          prefetchStaticData(mappedUser.country)
        } catch {
          setUser(Nothing())
        }
      }
    }).finally(() => setIsLoading(false))
  }, [])

  // Listen for session expiry from API interceptor — auto-logout
  useEffect(() => {
    const unsub = onSessionExpired(() => {
      clearUserName().catch(() => {})
      setUser(Nothing())
    })
    return unsub
  }, [])

  const login = async (username: string, password: string) => {
    await apiLogin(username, password)
    const [u, savedName] = await Promise.all([apiGetUserInfo(), loadUserName()])
    const mappedUser = apiUserToUser(u, savedName)
    setUser(Just(mappedUser))
    // Warm up caches in background — HomeScreen loads instantly
    prefetchStaticData(mappedUser.country)
    // Fire-and-forget non-critical tasks — do NOT await these, they must not block login
    Promise.resolve().then(async () => {
      try {
        const body: Record<string, string> = { platform: Platform.OS, device: Constants.deviceName || '' }
        const res = await client.put('/tuka/user/updateLogin', body)
        const pts = res?.data?.data?.pointsAwarded
        if (pts > 0) await storage.setItem('@tuka_login_points_awarded', String(pts))
      } catch { /* non-critical — never block login */ }
    })
    Analytics.login({ method: 'phone', country: mappedUser.country ?? 'Unknown', userId: mappedUser.uid }).catch(() => {})
    trackAdEvent('Login', { method: 'phone' })
  }

  const signup = async ({ name, username, phone, country, password, referralCode }: SignupPayload) => {
    const normalizedPhone    = phone.trim()
    const normalizedUsername = username.trim()
    const platformStr = Platform.OS
    const deviceName  = Constants.deviceName || Constants.expoConfig?.name || ''
    const modelName   = (Constants as any).platform?.ios?.model
                     || (Constants as any).platform?.android?.model
                     || deviceName

    // Step 1: Register — backend creates sys_user + tuka_user_profile + wallet
    await client.post('/register', {
      username: normalizedUsername, password, code: '', uuid: '',
      realName: name, phone: normalizedPhone, country,
      platform: platformStr, device: modelName,
      referralCode: referralCode || '',
    })

    // Step 2: Login + get user info in parallel
    await apiLogin(normalizedUsername, password)
    const [u] = await Promise.all([
      apiGetUserInfo(),
      saveUserName(name),
    ])

    // Step 3: Update profile nickname — fire and forget, don't block navigation
    client.put('/system/user/profile', {
      nickName: name,
      phonenumber: normalizedPhone || normalizedUsername,
    }).catch(() => { /* non-critical */ })

    const mappedUser = apiUserToUser(u, name)
    setUser(Just(mappedUser))
    Analytics.signup({ method: phone ? 'phone' : 'email', country, userId: mappedUser.uid }).catch(() => {})
    trackAdEvent('Registration', { method: phone ? 'phone' : 'email', country })
    // Push token registration moved to HomeScreen — better timing for iOS APNs
    // attributeSignup is fire-and-forget
    attributeSignup(mappedUser.uid).catch(() => {})
  }

  const logout = async () => {
    await apiLogout()
    await clearUserName()
    cacheClear()  // clear all cached API data on logout
    setUser(Nothing())
    Analytics.logout()
  }

  const refreshUser = async () => {
    try {
      const u = await apiGetUserInfo()
      const name = (u.nickName && u.nickName !== u.userName ? u.nickName : null) || u.userName
      await storage.setItem(NAME_KEY, name)
      setUser(Just(apiUserToUser(u, name)))
    } catch { /* keep existing user */ }
  }

  const resetPassword = async (phone: string, newPassword: string, pinId?: string, otp?: string) => {
    await client.post('/tuka/user/resetPassword', {
      phone,
      password: newPassword,
      otp:   otp   || '',
      pinId: pinId || '',
    })
  }

  // ── Social login — server-side token exchange (no client-side password generation) ──
  const loginWithSocial = async (socialUser: SocialUser, country = 'Nigeria') => {
    const platformStr = Platform.OS
    const deviceName  = Constants.deviceName || Constants.expoConfig?.name || ''

    // Step 1: Ask backend to authenticate/register via social provider
    // Backend handles account creation and returns a JWT directly
    let token: string
    try {
      const res = await client.post('/tuka/auth/social', {
        provider:   socialUser.provider,
        providerId: socialUser.providerId,
        name:       socialUser.name,
        email:      socialUser.email || '',
        country,
        platform:   platformStr,
        device:     deviceName,
      })
      token = res.data?.data?.token || res.data?.token
      if (!token) throw new Error('No token returned from social auth')
    } catch (socialErr: any) {
      // Fallback: if /tuka/auth/social endpoint doesn't exist yet,
      // use the legacy lookup + register flow but with a server-generated password
      const lookup = await client.get('/tuka/user/findBySocial', {
        params: { provider: socialUser.provider, socialId: socialUser.providerId }
      }).catch(() => ({ data: { data: null } }))

      const existing = lookup.data?.data
      let username: string

      if (existing?.username) {
        username = existing.username
      } else {
        const prefix = socialUser.provider === 'google' ? 'g' : 'a'
        username = `${prefix}_${socialUser.providerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`
      }

      // Request a server-generated one-time password for this social account
      // This avoids any client-side password derivation
      const pwRes = await client.post('/tuka/auth/socialPassword', {
        provider:   socialUser.provider,
        providerId: socialUser.providerId,
      }).catch(() => null)

      const serverPassword = pwRes?.data?.data?.password
      if (!serverPassword) {
        throw new Error('Social authentication failed. Please try again.')
      }

      if (!existing?.username) {
        await client.post('/register', {
          username, password: serverPassword, code: '', uuid: '',
          realName: socialUser.name, phone: '', email: socialUser.email,
          country, platform: platformStr, device: deviceName,
          socialProvider: socialUser.provider, socialId: socialUser.providerId,
        })
      }

      await apiLogin(username, serverPassword)
      const u = await apiGetUserInfo()
      await saveUserName(socialUser.name)
      const pushToken = await registerPushToken().catch(() => null)
      try {
        const body: Record<string, string> = { platform: platformStr, device: deviceName }
        if (pushToken) body.pushToken = pushToken
        await client.put('/tuka/user/updateLogin', body)
        await client.post('/tuka/user/register', {
          userId: u.userId, socialProvider: socialUser.provider,
          socialId: socialUser.providerId, realName: socialUser.name,
          email: socialUser.email, country,
        })
      } catch { /* non-critical */ }
      const mappedUser = apiUserToUser(u, socialUser.name)
      setUser(Just(mappedUser))
      Analytics.login({ method: socialUser.provider === 'google' ? 'google' : 'apple', country: mappedUser.country ?? country, userId: mappedUser.uid }).catch(() => {})
      return
    }

    // Step 2: Token received from server — set it and load user
    setAuthToken(token)
    await storage.setItem('@tuka_auth_token', token)
    const u = await apiGetUserInfo()
    // Use the name from the backend profile — Apple only sends name on first sign-in,
    // subsequent sign-ins return 'Apple User'. The backend stores the real name from first login.
    const profileName = (u.nickName && u.nickName !== u.userName ? u.nickName : null)
      || u.realName
      || (socialUser.name !== 'Apple User' && socialUser.name !== 'Google User' ? socialUser.name : null)
      || u.userName
    await saveUserName(profileName)
    try {
      const body: Record<string, string> = { platform: platformStr, device: deviceName }
      await client.put('/tuka/user/updateLogin', body)
    } catch { /* non-critical */ }
    const mappedUser = apiUserToUser(u, profileName)
    setUser(Just(mappedUser))
    // Push token registration moved to HomeScreen — better timing for iOS APNs
    Analytics.login({ method: socialUser.provider === 'google' ? 'google' : 'apple', country: mappedUser.country ?? country, userId: mappedUser.uid }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, resetPassword, loginWithSocial, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

