import client from '../../api/client'

export async function sendOtp(phone: string): Promise<{ pinId: string; testOtp?: string } | null> {
  try {
    const res = await client.post('/tuka/otp/send', { phone })
    const data = res.data?.data || {}
    return { pinId: data.pinId || '', testOtp: data.testOtp }
  } catch {
    return null
  }
}

export async function verifyOtp(pinId: string, pin: string): Promise<boolean> {
  if (!pinId) return false
  try {
    await client.post('/tuka/otp/verify', { pinId, pin })
    return true
  } catch {
    return false
  }
}
