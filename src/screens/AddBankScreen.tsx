import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native'
import * as ExpoClipboard from 'expo-clipboard'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius } from '../theme'
import { addBankAccount, resolveAccountName, NigerianBank } from '../api/wallet'
import { apiGetUserInfo } from '../api/auth'
import client from '../api/client'
import { ms } from '../util/responsive'

function maskContact(s: string): string {
  if (!s) return ''
  if (s.includes('@')) {
    const [local, domain] = s.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  }
  // Phone: show first 3 + last 4
  return s.slice(0, 3) + '****' + s.slice(-4)
}

export default function AddBankScreen(props: StackScreenProps<RootStackParams, 'AddBank'>) {
  const insets = useSafeAreaInsets()
  const preselected: NigerianBank | null = (props.route?.params as any)?.bank
    ? JSON.parse((props.route.params as any).bank)
    : null

  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(preselected)
  const [accNumber, setAccNumber]       = useState('')
  const [accName, setAccName]           = useState('')
  const [resolving, setResolving]       = useState(false)

  // Contact
  const [contactMode, setContactMode]   = useState<'phone' | 'email'>('phone')
  const [userPhone, setUserPhone]       = useState('')
  const [userEmail, setUserEmail]       = useState('')
  // Social users with no contact
  const [contactInput, setContactInput] = useState('')

  // OTP
  const [otpCode, setOtpCode]           = useState('')
  const [pinId, setPinId]               = useState('')  // returned from send
  const [sendingOtp, setSendingOtp]     = useState(false)
  const [countdown, setCountdown]       = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Submit
  const [saving, setSaving]             = useState(false)
  const [errorMsg, setErrorMsg]         = useState('')
  const [success, setSuccess]           = useState(false)

  // Load user contact info
  useEffect(() => {
    apiGetUserInfo().then(u => {
      setUserPhone(u.phonenumber || '')
      setUserEmail(u.email || '')
    }).catch(() => {})
  }, [])

  // Update bank when returning from SelectBankScreen
  useEffect(() => {
    if (preselected) setSelectedBank(preselected)
  }, [(props.route?.params as any)?.bank])

  // Auto-resolve account name
  useEffect(() => {
    if (accNumber.length === 10 && selectedBank?.code) {
      setResolving(true)
      setAccName('')
      resolveAccountName(accNumber, selectedBank.code).then(name => {
        if (name) setAccName(name)
        setResolving(false)
      })
    } else if (accNumber.length < 10) {
      setAccName('')
    }
  }, [accNumber, selectedBank])

  // Countdown
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current!); return 0 } return c - 1 }), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  const hasPhone   = userPhone.length >= 8
  const hasEmail   = userEmail.includes('@')
  const needsInput = contactMode === 'phone' ? !hasPhone : !hasEmail
  const contact    = needsInput
    ? contactInput.trim()
    : contactMode === 'phone' ? userPhone : userEmail
  const maskedContact = needsInput ? '' : maskContact(contact)

  async function handlePaste() {
    try {
      const text = await ExpoClipboard.getStringAsync()
      const digits = text.replace(/\D/g, '').slice(0, 10)
      if (digits) setAccNumber(digits)
    } catch { /* ignore */ }
  }

  async function sendOtp() {
    setErrorMsg('')
    if (!contact) { setErrorMsg(`Please enter your ${contactMode}`); return }
    const phone = contactMode === 'phone' ? contact : ''
    if (!phone) { setErrorMsg('OTP is only supported via phone. Please switch to Phone.'); return }
    // If social user is entering a new phone, check it's not already registered
    if (needsInput) {
      try {
        const check = await client.get('/tuka/user/checkPhone', { params: { phone } })
        if (check.data?.msg === 'exists') {
          setErrorMsg('This phone number is already registered. Please log in with that account instead.')
          return
        }
      } catch { /* ignore check errors */ }
    }
    setSendingOtp(true)
    try {
      const res = await client.post('/tuka/otp/send', { phone })
      const id = res.data?.data?.pinId || res.data?.pinId || ''
      setPinId(id)
      setCountdown(60)
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to send code')
    } finally { setSendingOtp(false) }
  }

  async function handleSubmit() {
    setErrorMsg('')
    if (!selectedBank)           { setErrorMsg('Please select a bank'); return }
    if (accNumber.length !== 10) { setErrorMsg('Account number must be 10 digits'); return }
    if (!accName)                { setErrorMsg('Account name could not be resolved'); return }
    if (!pinId)                  { setErrorMsg('Please send the verification code first'); return }
    if (!otpCode)                { setErrorMsg('Please enter the verification code'); return }

    setSaving(true)
    try {
      await client.post('/tuka/otp/verify', { pinId, pin: otpCode })

      // If social user provided new contact, save it
      if (needsInput && contact) {
        try {
          await client.put('/system/user/profile', {
            phonenumber: contactMode === 'phone' ? contact : '',
            email:       contactMode === 'email' ? contact : '',
          })
        } catch { /* non-critical */ }
      }

      await addBankAccount({
        bankName: selectedBank.name,
        accountNumber: accNumber,
        accountName: accName,
      })

      setSuccess(true)
    } catch (e: any) {
      setErrorMsg(e.message || 'Verification failed. Please try again.')
    } finally { setSaving(false) }
  }

  const canSubmit = !!selectedBank && accNumber.length === 10 && !!accName && !!otpCode && !saving && !resolving

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader title="Add Bank Card" onBack={() => props.navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Select bank */}
          <TouchableOpacity style={s.field} onPress={() => props.navigation.navigate('SelectBank' as any)} activeOpacity={0.8}>
            <Feather name="credit-card" size={18} color={colors.muted} style={s.fieldIcon} />
            <Text style={selectedBank ? s.fieldVal : s.fieldPlaceholder}>
              {selectedBank ? selectedBank.name : 'Select Your Bank'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.muted} />
          </TouchableOpacity>

          {/* Account number + Paste */}
          <View style={s.field}>
            <Feather name="user" size={18} color={colors.muted} style={s.fieldIcon} />
            <TextInput
              style={s.fieldInput}
              placeholder="Account Number"
              placeholderTextColor={colors.subtle}
              keyboardType="numeric"
              maxLength={10}
              value={accNumber}
              onChangeText={v => { setAccNumber(v); setErrorMsg('') }}
            />
            {accNumber.length === 0 ? (
              <TouchableOpacity onPress={handlePaste} style={s.pasteBtn} activeOpacity={0.7}>
                <Text style={s.pasteTxt}>Paste</Text>
              </TouchableOpacity>
            ) : accNumber.length < 10 ? (
              <Text style={s.digitCount}>{accNumber.length}/10</Text>
            ) : null}
          </View>

          {/* Holder name — auto-filled */}
          <View style={[s.field, s.fieldReadonly]}>
            <Feather name="user" size={18} color={colors.muted} style={s.fieldIcon} />
            {resolving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.fieldPlaceholder}>Fetching name...</Text>
              </View>
            ) : (
              <Text style={[accName ? s.fieldVal : s.fieldPlaceholder, accName && { color: colors.primary }]}>
                {accName || 'Holder Name'}
              </Text>
            )}
          </View>

          {/* Phone / Email toggle */}
          <View style={s.toggleRow}>
            {(['phone', 'email'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.toggleBtn, contactMode === mode && s.toggleBtnOn]}
                onPress={() => setContactMode(mode)}
                activeOpacity={0.8}>
                <Text style={[s.toggleTxt, contactMode === mode && s.toggleTxtOn]}>
                  {mode === 'phone' ? 'Phone' : 'Email'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Masked contact display OR input for social users */}
          {needsInput ? (
            <View style={s.field}>
              <Feather name={contactMode === 'phone' ? 'phone' : 'mail'} size={18} color={colors.muted} style={s.fieldIcon} />
              <TextInput
                style={s.fieldInput}
                placeholder={contactMode === 'phone' ? 'Enter your phone number' : 'Enter your email'}
                placeholderTextColor={colors.subtle}
                keyboardType={contactMode === 'phone' ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                value={contactInput}
                onChangeText={setContactInput}
              />
            </View>
          ) : (
            <View style={[s.field, s.fieldReadonly]}>
              <Feather name={contactMode === 'phone' ? 'smartphone' : 'mail'} size={18} color={colors.muted} style={s.fieldIcon} />
              <Text style={s.maskedTxt}>{maskedContact}</Text>
            </View>
          )}

          {/* Verification code + Send */}
          <View style={s.field}>
            <Feather name="shield" size={18} color={colors.muted} style={s.fieldIcon} />
            <TextInput
              style={s.fieldInput}
              placeholder="Verification code"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={v => { setOtpCode(v); setErrorMsg('') }}
            />
            <TouchableOpacity
              onPress={sendOtp}
              disabled={sendingOtp || countdown > 0}
              activeOpacity={0.7}>
              {sendingOtp ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[s.sendTxt, countdown > 0 && { color: colors.muted }]}>
                  {countdown > 0 ? `${countdown}s` : 'Send'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Inline error */}
          {errorMsg ? (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color={colors.error} />
              <Text style={s.errorTxt}>{errorMsg}</Text>
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Submit button */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitBtnOff]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnTxt}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Success modal */}
      <Modal visible={success} transparent animationType="fade">
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIcon}>
              <Feather name="check" size={32} color="#fff" />
            </View>
            <Text style={s.successTitle}>Bank Card Added!</Text>
            <Text style={s.successSub}>
              {accName} · {selectedBank?.name}{'\n'}{accNumber}
            </Text>
            <TouchableOpacity
              style={s.successBtn}
              onPress={() => props.navigation.navigate('Withdraw' as any)}
              activeOpacity={0.85}>
              <Text style={s.successBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F2F5' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },

  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },

  // Fields
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], height: 58,
    marginBottom: spacing[3],
  },
  fieldReadonly: { backgroundColor: '#EBEBEB' },
  fieldIcon: { marginRight: spacing[3], flexShrink: 0 },
  fieldInput: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  fieldVal: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  fieldPlaceholder: { flex: 1, fontSize: typography.size.lg, color: colors.subtle },
  maskedTxt: { flex: 1, fontSize: typography.size.lg, color: colors.muted, fontWeight: typography.weight.extrabold },

  // Paste
  pasteBtn: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  pasteTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },
  digitCount: { fontSize: typography.size.xs, color: colors.muted },

  // Phone/Email toggle
  toggleRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  toggleBtn: {
    paddingHorizontal: spacing[6], paddingVertical: spacing[2] + 2,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleTxt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.muted },
  toggleTxtOn: { color: '#fff' },

  // Send OTP
  sendTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary },

  // Bottom
  bottomBar: {
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    backgroundColor: '#F0F2F5',
  },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[5], alignItems: 'center',
    minHeight: ms(56),
  },
  submitBtnOff: { backgroundColor: colors.disabled },
  submitBtnTxt: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.bold, color: '#fff' },

  // Inline error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.errorLight, borderRadius: radius.lg,
    padding: spacing[3], marginTop: spacing[2],
  },
  errorTxt: { flex: 1, fontSize: typography.size.sm, color: colors.error, lineHeight: 18 },

  // Success modal
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: spacing[8],
  },
  successCard: {
    backgroundColor: colors.surface, borderRadius: radius['2xl'],
    padding: spacing[8], alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  successTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  successSub: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: spacing[6] },
  successBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing[4], paddingHorizontal: spacing[10],
  },
  successBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})
