import React, { useContext, useEffect, useState } from 'react'
import { Nothing, Maybe, Just } from '../util/Maybe'
import storage from '../util/storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import {
  apiLogin, apiGetUserInfo, apiLogout,
  restoreSession, ApiUser,
} from '../api/auth'
import client from '../api/client'
import { SocialUser } from '../api/socialAuth'
import { registerPushToken } from '../util/pushNotifications'
import { Analytics } from '../util/analytics'

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
  resetPassword: (phone: string, newPassword: string) => Promise<void>
  loginWithSocial: (socialUser: SocialUser, country?: string) => Promise<void>
  refreshUser: () => Promise<void>   // re-fetch user from backend and update context
}

export const AuthContext = React.createContext<AuthContextType>(null as any)
export const useAuth = () => useContext(AuthContext)

const NAME_KEY = '@tuka_user_name'

async function saveUserName(name: string) {
  await storage.setItem(NAME_KEY, name)
}
async function loadUserName(): Promise<string | null> {
  return storage.getItem(NAME_KEY)
}
async function clearUserName() {
  await storage.removeItem(NAME_KEY)
}

function apiUserToUser(u: ApiUser, overrideName?: string | null): User {
  // Use override name, then nickName if different from userName (phone), then userName
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

  // Restore session on app start — load saved name too
  useEffect(() => {
    restoreSession().then(async token => {
      if (token) {
        try {
          const [u, savedName] = await Promise.all([apiGetUserInfo(), loadUserName()])
          setUser(Just(apiUserToUser(u, savedName)))
        } catch {
          setUser(Nothing())
        }
      }
    }).finally(() => setIsLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    await apiLogin(username, password)
    const [u, savedName] = await Promise.all([apiGetUserInfo(), loadUserName()])
    // Update last_login_ip + device info — also captures streak points awarded
    try {
      const platformStr = Platform.OS
      const deviceName  = Constants.deviceName || ''
      const res = await client.put('/tuka/user/updateLogin', {
        platform: platformStr,
        device: deviceName,
      })
      const pts = res?.data?.data?.pointsAwarded
      if (pts > 0) {
        await storage.setItem('@tuka_login_points_awarded', String(pts))
      }
    } catch { /* non-critical */ }
    const mappedUser = apiUserToUser(u, savedName)
    setUser(Just(mappedUser))
    // Analytics — identify user and log login
    Analytics.login({
      method:  'phone',
      country: mappedUser.country ?? 'Unknown',
      userId:  mappedUser.uid,
    }).catch(() => {})
    // Register push token in background
    registerPushToken().catch(() => {})
  }

  const signup = async ({ name, username, phone, country, password, referralCode }: SignupPayload) => {
    const normalizedPhone = phone.trim()
    const normalizedUsername = username.trim()

    // Collect device info
    const platformStr = Platform.OS  // 'ios' | 'android'
    const deviceName  = Constants.deviceName || Constants.expoConfig?.name || ''
    const modelName   = (Constants as any).platform?.ios?.model
                     || (Constants as any).platform?.android?.model
                     || deviceName

    await client.post('/register', {
      username: normalizedUsername,
      password,
      code: '',
      uuid: '',
      realName: name,
      phone: normalizedPhone,
      country,
      platform: platformStr,
      device:   modelName,
      referralCode: referralCode || '',
    })

    await apiLogin(normalizedUsername, password)
    const u = await apiGetUserInfo()
    await saveUserName(name)

    // Update nickName on sys_user (already done in backend, this is extra safety)
    try {
      await client.put('/system/user/profile', { nickName: name, phonenumber: normalizedPhone || normalizedUsername })
    } catch { /* non-critical */ }

    const mappedUser = apiUserToUser(u, name)
    setUser(Just(mappedUser))
    // Analytics — new user registered
    Analytics.signup({
      method:  phone ? 'phone' : 'email',
      country: country,
      userId:  mappedUser.uid,
    }).catch(() => {})
  }

  const logout = async () => {
    await apiLogout()
    await clearUserName()
    setUser(Nothing())
    Analytics.logout()
  }

  // Re-fetch user info from backend and update context + local cache
  const refreshUser = async () => {
    try {
      const u = await apiGetUserInfo()
      // Prefer nickName from backend (source of truth) over local cache
      const name = (u.nickName && u.nickName !== u.userName ? u.nickName : null) || u.userName
      await storage.setItem(NAME_KEY, name)
      setUser(Just(apiUserToUser(u, name)))
    } catch { /* keep existing user */ }
  }

  const resetPassword = async (phone: string, newPassword: string) => {
    await client.post('/tuka/user/resetPassword', { phone, password: newPassword })
  }

  const loginWithSocial = async (socialUser: SocialUser, country = 'Nigeria') => {
    const platformStr = Platform.OS
    const deviceName  = Constants.deviceName || Constants.expoConfig?.name || ''

    // First check if this social account already exists in our DB by provider ID
    let username: string
    let password: string

    try {
      const lookup = await client.get('/tuka/user/findBySocial', {
        params: { provider: socialUser.provider, socialId: socialUser.providerId }
      })
      const existing = lookup.data?.data
      if (existing?.username) {
        // Found existing account — use its username
        username = existing.username
      } else {
        // New account — generate deterministic username from provider ID
        const prefix = socialUser.provider === 'google' ? 'g' : 'a'
        username = `${prefix}_${socialUser.providerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`
      }
    } catch {
      // Fallback to generated username
      const prefix = socialUser.provider === 'google' ? 'g' : 'a'
      username = `${prefix}_${socialUser.providerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`
    }

    // Deterministic password from provider ID
    const SALT = 'TukaFufu2026#Social'
    const rawPw = socialUser.providerId + SALT
    let hash = 0
    for (let i = 0; i < rawPw.length; i++) {
      hash = ((hash << 5) - hash) + rawPw.charCodeAt(i)
      hash |= 0
    }
    password = `Tk${Math.abs(hash).toString(36).padStart(10, '0')}!`

    try {
      // Try login first (returning user)
      await apiLogin(username, password)
    } catch {
      // New user — register with full social profile including social IDs
      await client.post('/register', {
        username,
        password,
        code:           '',
        uuid:           '',
        realName:       socialUser.name,
        phone:          '',
        email:          socialUser.email,
        country,
        platform:       platformStr,
        device:         deviceName,
        socialProvider: socialUser.provider,
        socialId:       socialUser.providerId,
      })
      await apiLogin(username, password)

      // Store email in sys_user
      try {
        await client.put('/system/user/profile', {
          nickName:    socialUser.name,
          email:       socialUser.email,
          phonenumber: '',
        })
      } catch { /* non-critical */ }
    }

    const u = await apiGetUserInfo()
    await saveUserName(socialUser.name)

    // Log the login + save social IDs to profile
    try {
      await client.put('/tuka/user/updateLogin', {
        platform: platformStr,
        device:   deviceName,
      })
      // Ensure social IDs are saved (idempotent)
      await client.post('/tuka/user/register', {
        userId: u.userId,
        socialProvider: socialUser.provider,
        socialId: socialUser.providerId,
        realName: socialUser.name,
        email: socialUser.email,
        country,
      })
    } catch { /* non-critical */ }

    const mappedUser = apiUserToUser(u, socialUser.name)
    setUser(Just(mappedUser))
    // Analytics — social login (could be new signup or returning user)
    Analytics.login({
      method:  socialUser.provider === 'google' ? 'google' : 'apple',
      country: mappedUser.country ?? country,
      userId:  mappedUser.uid,
    }).catch(() => {})
    registerPushToken().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, resetPassword, loginWithSocial, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
