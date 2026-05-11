import axios from 'axios'
import { Platform } from 'react-native'

// ── Base URL ──────────────────────────────────────────────────────────────────
// Reads from EXPO_PUBLIC_API_URL env variable.
// Set in .env for dev, .env.production for App Store builds.
// Falls back to Android emulator address if env var is missing.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL

export const BASE_URL = ENV_URL
  ? ENV_URL
  : Platform.OS === 'android'
    ? 'http://10.0.2.2:8080'   // Android emulator fallback
    : 'http://localhost:8080'   // iOS simulator fallback

// ── Session expiry event ──────────────────────────────────────────────────────
// Allows AuthContext to listen for 401s and navigate to login
type SessionExpiredListener = () => void
const sessionExpiredListeners: SessionExpiredListener[] = []

export function onSessionExpired(fn: SessionExpiredListener) {
  sessionExpiredListeners.push(fn)
  return () => {
    const idx = sessionExpiredListeners.indexOf(fn)
    if (idx >= 0) sessionExpiredListeners.splice(idx, 1)
  }
}

function emitSessionExpired() {
  sessionExpiredListeners.forEach(fn => fn())
}

// ── Axios instance ────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,  // 20s for production (was 15s)
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token management ─────────────────────────────────────────────────────
export function setAuthToken(token: string) {
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export function clearAuthToken() {
  delete client.defaults.headers.common['Authorization']
}

// ── Chinese → English error translation ──────────────────────────────────────
function translateMsg(msg: string): string {
  if (!msg) return 'Request failed'
  const map: Record<string, string> = {
    '用户不存在/密码错误':           'Incorrect phone number or password.',
    '用户不存在':                    'Incorrect phone number or password.',
    '密码错误':                      'Incorrect phone number or password.',
    '注册账号已存在':                 'This phone number is already registered.',
    '保存用户':                      'This phone number is already registered.',
    '注册失败':                      'Registration failed. Please try again.',
    '当前系统没有开启注册功能':        'Registration is currently disabled.',
    '用户名不能为空':                 'Phone number is required.',
    '密码长度必须在':                 'Password must be 8–20 characters.',
    '账户长度必须在':                 'Phone number must be between 2 and 20 characters.',
    '用户已封禁':                    'Your account has been disabled. Please contact support.',
    '角色已封禁':                    'Your account has been disabled. Please contact support.',
    '密码输入错误':                   'Incorrect phone number or password.',
    '帐户锁定':                      'Too many failed attempts. Please try again later.',
    '请重新登录':                    'Session expired. Please log in again.',
    '验证码错误':                    'Invalid verification code.',
    '验证码已失效':                  'Verification code has expired.',
    '未知错误':                      'Something went wrong. Please try again.',
    '认证失败':                      'Please log in to continue.',
    'Incorrect phone number or password': 'Incorrect phone number or password.',
    'user.password.not.match':       'Incorrect phone number or password.',
  }
  for (const [cn, en] of Object.entries(map)) {
    if (msg.includes(cn)) return en
  }
  return msg
}

// ── Response interceptor ──────────────────────────────────────────────────────
client.interceptors.response.use(
  res => {
    const data = res.data
    // RuoYi wraps responses: { code: 200, msg: 'ok', data/token: ... }
    if (data && data.code !== undefined && data.code !== 200) {
      const isLoginEndpoint = res.config?.url?.includes('/login')

      // code 401 in JSON body = token expired (not a wrong-password on login)
      if (data.code === 401 && !isLoginEndpoint) {
        clearAuthToken()
        import('@react-native-async-storage/async-storage').then(m =>
          m.default.removeItem('@tuka_auth_token').catch(() => {})
        )
        emitSessionExpired()
      }

      const translated = translateMsg(data.msg)
      const err: any = new Error(translated || 'Request failed')
      err.bizCode = data.code
      return Promise.reject(err)
    }
    return res
  },
  err => {
    const status = err.response?.status
    const msg = err.response?.data?.msg || err.message || 'Network error'

    // HTTP 401 = real Spring Security auth failure — clear token + redirect
    if (status === 401) {
      clearAuthToken()
      import('@react-native-async-storage/async-storage').then(m =>
        m.default.removeItem('@tuka_auth_token').catch(() => {})
      )
      emitSessionExpired()
    }

    const translated = translateMsg(msg)
    const outErr: any = new Error(translated)
    outErr.httpStatus = status
    outErr.bizCode = err.response?.data?.code
    return Promise.reject(outErr)
  }
)

export default client
