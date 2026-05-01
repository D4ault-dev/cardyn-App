import axios from 'axios'

// Change this to your Mac's IP when testing on a real device
// localhost won't work on a physical phone — use your local IP
export const BASE_URL = 'http://192.168.29.105:8080'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request if available
let authToken = ''
export function setAuthToken(token: string) {
  authToken = token
  client.defaults.headers.common['Authorization'] = `Bearer ${token}`
}
export function clearAuthToken() {
  authToken = ''
  delete client.defaults.headers.common['Authorization']
}

// Translate any remaining Chinese backend messages to English
function translateMsg(msg: string): string {
  if (!msg) return 'Request failed'
  const map: Record<string, string> = {
    '用户不存在/密码错误':           'Phone number or password is incorrect',
    '用户不存在':                    'Account not found',
    '密码错误':                      'Incorrect password',
    '注册账号已存在':                 'This phone number is already registered',
    '保存用户':                      'This phone number is already registered',
    '注册失败':                      'Registration failed. Please try again',
    '当前系统没有开启注册功能':        'Registration is currently disabled',
    '用户名不能为空':                 'Phone number is required',
    '密码长度必须在':                 'Password must be between 5 and 20 characters',
    '账户长度必须在':                 'Phone number must be between 2 and 20 characters',
    '用户已封禁':                    'Account suspended. Please contact support',
    '角色已封禁':                    'Account suspended. Please contact support',
    '密码输入错误':                   'Incorrect password',
    '帐户锁定':                      'Account temporarily locked. Please try again later',
    '请重新登录':                    'Session expired. Please log in again',
    '验证码错误':                    'Invalid verification code',
    '验证码已失效':                  'Verification code has expired',
    '未知错误':                      'An error occurred. Please try again',
    '认证失败':                      'Please log in to claim this coupon',
  }
  for (const [cn, en] of Object.entries(map)) {
    if (msg.includes(cn)) return en
  }
  return msg
}

// Response interceptor — unwrap RuoYi's AjaxResult
client.interceptors.response.use(
  res => {
    const data = res.data
    // RuoYi returns { code: 200, msg: 'ok', data/token: ... }
    if (data.code !== undefined && data.code !== 200) {
      // 401 = token expired — clear stored token so next app open shows login
      if (data.code === 401) {
        clearAuthToken()
        import('@react-native-async-storage/async-storage').then(m =>
          m.default.removeItem('@tuka_auth_token').catch(() => {})
        )
      }
      return Promise.reject(new Error(translateMsg(data.msg) || 'Request failed'))
    }
    return res
  },
  err => {
    const status = err.response?.status
    const msg = err.response?.data?.msg || err.message || 'Network error'
    // 401 HTTP status — clear token
    if (status === 401) {
      clearAuthToken()
      import('@react-native-async-storage/async-storage').then(m =>
        m.default.removeItem('@tuka_auth_token').catch(() => {})
      )
    }
    return Promise.reject(new Error(translateMsg(msg)))
  }
)

export default client
