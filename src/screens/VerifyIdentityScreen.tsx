import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { apiGetUserInfo } from '../api/auth'
import { useToast } from '../util/useToast'
import { ms } from '../util/responsive'

export default function VerifyIdentityScreen(props: StackScreenProps<RootStackParams, 'VerifyIdentity'>) {
  const insets = useSafeAreaInsets()
  const { next, type } = props.route.params
  const { user } = useAuth()

  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [contactMode, setContactMode] = useState<'phone' | 'email'>('phone')
  const [otp, setOtp]           = useState('')
  const [pinId, setPinId]       = useState('')
  const [sending, setSending]   = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiGetUserInfo().then(u => {
      setPhone(u.phonenumber || '')
      setEmail(u.email || '')
      // Default to email mode if user has no phone (social sign-in)
      if (!u.phonenumber && u.email) setContactMode('email')
    }).catch(() => {})
  }, [])

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

  function maskContact(s: string) {
    if (!s) return ''
    if (s.includes('@')) {
      const [local, domain] = s.split('@')
      return `${local.slice(0, 2)}***@${domain}`
    }
    return s.slice(0, 3) + ' ****' + s.slice(-4)
  }

  const contact = contactMode === 'phone' ? phone : email
  const hasContact = contactMode === 'phone' ? phone.length >= 8 : email.includes('@')

  async function handleSend() {
    if (!hasContact) {
      Alert.alert('No contact', `No ${contactMode} linked to your account.`)
      return
    }
    setSending(true)
    try {
      if (contactMode === 'email') {
        const res = await client.post('/tuka/otp/sendEmail', { email })
        setPinId(res.data?.data?.pinId || email)
      } else {
        const res = await client.post('/tuka/otp/send', { phone })
        setPinId(res.data?.data?.pinId || res.data?.pinId || '')
      }
      setCountdown(60)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.msg || e?.message || 'Failed to send code')
    } finally { setSending(false) }
  }

  async function handleContinue() {
    if (!pinId)  { Alert.alert('Error', 'Please send the verification code first'); return }
    if (!otp)    { Alert.alert('Error', 'Please enter the verification code'); return }
    setVerifying(true)
    try {
      await client.post('/tuka/otp/verify', { pinId, pin: otp })
      // Navigate to the next screen after successful verification
      if (next === 'ModifyPassword') {
        props.navigation.replace('ModifyPassword', { type: type || 'login' })
      } else if (next === 'DeleteAccount') {
        props.navigation.replace('AccountDeletion')
      }
    } catch (e: any) {
      Alert.alert('Invalid Code', e?.response?.data?.msg || 'Verification failed. Please try again.')
    } finally { setVerifying(false) }
  }

  const canContinue = !!pinId && otp.length >= 4 && !verifying

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Verify Identity</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.body}>

          {/* Phone/Email toggle — only show if user has both */}
          {phone && email && (
            <View style={s.toggleRow}>
              {(['phone', 'email'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[s.toggleBtn, contactMode === mode && s.toggleBtnOn]}
                  onPress={() => { setContactMode(mode); setOtp(''); setPinId('') }}
                  activeOpacity={0.8}>
                  <Text style={[s.toggleTxt, contactMode === mode && s.toggleTxtOn]}>
                    {mode === 'phone' ? 'Phone' : 'Email'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Card */}
          <View style={s.card}>
            {/* Contact row — read only */}
            <View style={s.row}>
              <Text style={s.phoneDisplay}>
                {hasContact ? maskContact(contact) : `No ${contactMode} linked`}
              </Text>
            </View>

            <View style={s.divider} />

            {/* OTP row */}
            <View style={s.row}>
              <TextInput
                style={s.otpInput}
                placeholder="Verification code"
                placeholderTextColor={colors.subtle}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || countdown > 0 || !hasContact}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[s.sendTxt, (countdown > 0 || !hasContact) && s.sendTxtDisabled]}>
                    {countdown > 0 ? `${countdown}s` : 'Send'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {/* Continue button */}
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity
            style={[s.continueBtn, !canContinue && s.continueBtnOff]}
            onPress={handleContinue}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            {verifying
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.continueBtnTxt, !canContinue && s.continueBtnTxtOff]}>Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    minHeight: 56,
  },
  divider: { height: 1, backgroundColor: colors.border },

  phoneDisplay: {
    flex: 1, fontSize: typography.size.base,
    fontWeight: typography.weight.medium, color: colors.dark,
  },
  otpInput: {
    flex: 1, fontSize: typography.size.base, color: colors.dark,
  },
  sendTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary,
  },
  sendTxtDisabled: { color: colors.muted },

  toggleRow: { flexDirection: 'row', gap: spacing[3], marginHorizontal: spacing[4], marginBottom: spacing[3] },
  toggleBtn: {
    paddingHorizontal: spacing[6], paddingVertical: spacing[2] + 2,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleTxt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.muted },
  toggleTxtOn: { color: '#fff' },

  bottomBar: {
    paddingHorizontal: spacing[5], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  continueBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  continueBtnOff: { backgroundColor: colors.disabled },
  continueBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primaryText },
  continueBtnTxtOff: { color: colors.disabledText },
})
