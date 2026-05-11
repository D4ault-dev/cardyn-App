import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { useToast } from '../util/useToast'
import { ms } from '../util/responsive'

export default function BindPhoneScreen(props: StackScreenProps<RootStackParams, 'BindPhone'>) {
  const insets = useSafeAreaInsets()
  const [phone, setPhone]         = useState('')
  const [otpCode, setOtpCode]     = useState('')
  const [pinId, setPinId]         = useState('')
  const [sending, setSending]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { showSuccess, showError, Toast } = useToast()

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0 }
        return c - 1
      }), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  async function handleSend() {
    const trimmed = phone.trim()
    if (trimmed.length < 10) { showError('Please enter a valid phone number'); return }

    // Check if phone is already registered to another account
    try {
      const check = await client.get('/tuka/user/checkPhone', { params: { phone: trimmed } })
      if (check.data?.msg === 'exists') {
        showError('This phone number is already registered to another account. Please use a different number.')
        return
      }
    } catch { /* ignore check errors */ }

    setSending(true)
    try {
      const res = await client.post('/tuka/otp/send', { phone: trimmed })
      setPinId(res.data?.data?.pinId || res.data?.pinId || '')
      setCountdown(60)
    } catch (e: any) {
      showError(e.message || 'Failed to send code')
    } finally { setSending(false) }
  }

  async function handleConfirm() {
    if (!pinId) { showError('Please send the verification code first'); return }
    if (!otpCode) { showError('Please enter the verification code'); return }
    setSaving(true)
    try {
      // Verify OTP
      await client.post('/tuka/otp/verify', { pinId, pin: otpCode })
      // Save phone to both sys_user and tuka_user_profile
      await client.put('/system/user/profile', { phonenumber: phone.trim() })
      await client.put('/tuka/user/profile', { phone: phone.trim() })
      showSuccess('Phone number bound successfully')
      setTimeout(() => props.navigation.goBack(), 2000)
    } catch (e: any) {
      showError(e.message || 'Verification failed')
    } finally { setSaving(false) }
  }

  const canConfirm = otpCode.length >= 4 && !!pinId && !saving

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Bind Phone Number" onBack={() => props.navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4] }}>

          <Text style={s.notice}>
            Bind a phone number to your account for security verification and account recovery.
          </Text>

          <View style={s.card}>
            {/* Phone input */}
            <View style={[s.field, s.border]}>
              <Feather name="smartphone" size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
              <TextInput
                style={s.input}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.subtle}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={v => { setPhone(v); setPinId(''); setOtpCode('') }}
                autoCorrect={false}
              />
            </View>

            {/* OTP input + Send */}
            <View style={s.field}>
              <Feather name="shield" size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
              <TextInput
                style={s.input}
                placeholder="Verification code"
                placeholderTextColor={colors.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || countdown > 0 || phone.trim().length < 10}
                activeOpacity={0.7}>
                {sending
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={[s.sendTxt, (countdown > 0 || phone.trim().length < 10) && { color: colors.muted }]}>
                      {countdown > 0 ? `${countdown}s` : 'Send'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btn, !canConfirm && s.btnOff]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.btnTxt, !canConfirm && s.btnTxtOff]}>Bind Phone Number</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {Toast}
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  notice: {
    fontSize: typography.size.sm, color: '#F59E0B',
    lineHeight: 20, marginBottom: spacing[4],
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    overflow: 'hidden', ...shadow.sm, marginBottom: spacing[5],
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], minHeight: 58,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  input: {
    flex: 1, fontSize: typography.size.lg, color: colors.dark,
    paddingVertical: spacing[4], fontWeight: typography.weight.extrabold,
  },
  sendTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },

  btn: {
    backgroundColor: '#1A1A1A', borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  btnOff:    { backgroundColor: '#E0E0E0' },
  btnTxt:    { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: '#fff' },
  btnTxtOff: { color: '#AAAAAA' },
})
