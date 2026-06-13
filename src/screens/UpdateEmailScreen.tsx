import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { useToast } from '../util/useToast'
import { ms } from '../util/responsive'
import { BottomBackButton } from '../components/BottomBackButton'

// ── Screen ────────────────────────────────────────────────────────────────────
export default function UpdateEmailScreen(props: StackScreenProps<RootStackParams, 'UpdateEmail'>) {
  const insets = useSafeAreaInsets()
  const [email, setEmail]       = useState('')
  const [otp, setOtp]           = useState('')
  const [pinId, setPinId]       = useState('')
  const [sending, setSending]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { showSuccess, showError, Toast } = useToast()

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(timerRef.current!); return 0 }
          return c - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  async function handleSend() {
    if (!isValidEmail(email)) { showError('Please enter a valid email address'); return }
    setSending(true)
    try {
      const res = await client.post('/tuka/otp/sendEmail', { email: email.trim().toLowerCase() })
      const id = res.data?.data?.pinId || res.data?.pinId || email
      setPinId(id)
      setCountdown(60)
      const testOtp = res.data?.data?.testOtp || res.data?.testOtp
      if (testOtp) showSuccess(`Dev OTP: ${testOtp}`)
    } catch (e: any) {
      showError(e?.response?.data?.msg || e?.message || 'Failed to send code')
    } finally { setSending(false) }
  }

  async function handleConfirm() {
    if (!isValidEmail(email)) { showError('Please enter a valid email'); return }
    if (!pinId)  { showError('Please send the verification code first'); return }
    if (!otp)    { showError('Please enter the verification code'); return }

    setSaving(true)
    try {
      await client.post('/tuka/otp/verify', { pinId, pin: otp })
      await client.put('/system/user/profile', { email: email.trim().toLowerCase() })
      await client.put('/tuka/user/profile',   { email: email.trim().toLowerCase() })
      showSuccess('Email updated')
      setTimeout(() => props.navigation.goBack(), 2200)
    } catch (e: any) {
      showError(e?.response?.data?.msg || e?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  const canConfirm = isValidEmail(email) && otp.length >= 4 && !saving

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add New Email</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>

          {/* Orange notice */}
          <Text style={s.notice}>Enter your linked Email to verify identity</Text>

          {/* Email + OTP card */}
          <View style={s.card}>
            {/* Email input */}
            <View style={[s.fieldRow, s.border]}>
              <TextInput
                style={s.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.subtle}
                value={email}
                onChangeText={v => { setEmail(v); setPinId(''); setOtp('') }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* OTP input + Send */}
            <View style={s.fieldRow}>
              <TextInput
                style={s.input}
                placeholder="Verification code"
                placeholderTextColor={colors.subtle}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || countdown > 0 || !isValidEmail(email)}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[
                    s.sendTxt,
                    (countdown > 0 || !isValidEmail(email)) && s.sendTxtOff,
                  ]}>
                    {countdown > 0 ? `${countdown}s` : 'Send'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {/* Confirm button */}
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity
            style={[s.confirmBtn, !canConfirm && s.confirmBtnOff]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.confirmBtnTxt, !canConfirm && s.confirmBtnTxtOff]}>Confirm</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {Toast}
      <BottomBackButton onPress={() => props.navigation.goBack()} />
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },

  body: { flex: 1, paddingTop: spacing[4] },

  notice: {
    fontSize: typography.size.sm, color: '#F59E0B',
    lineHeight: 20, marginHorizontal: spacing[5], marginBottom: spacing[4],
  },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], minHeight: 58,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  input: {
    flex: 1, fontSize: typography.size.lg,
    color: colors.dark, paddingVertical: spacing[4],
    fontWeight: typography.weight.extrabold,
  },
  sendTxt: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary,
  },
  sendTxtOff: { color: colors.muted },

  bottomBar: {
    paddingHorizontal: spacing[5], paddingTop: spacing[3],
  },
  confirmBtn: {
    backgroundColor: '#1A1A1A', borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  confirmBtnOff: { backgroundColor: '#E0E0E0' },
  confirmBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  confirmBtnTxtOff: { color: '#AAAAAA' },
})
