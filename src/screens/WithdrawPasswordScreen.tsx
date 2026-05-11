import { RF } from '../util/responsive'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { useToast } from '../util/useToast'
import { apiGetUserInfo } from '../api/auth'

function maskContact(s: string): string {
  if (!s) return ''
  if (s.includes('@')) {
    const [local, domain] = s.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  }
  return s.slice(0, 3) + '****' + s.slice(-4)
}

// ── Step 1: OTP verification ──────────────────────────────────────────────────
function StepOtp({ onVerified, onError }: {
  onVerified: () => void
  onError: (msg: string) => void
}) {
  const [contactMode, setContactMode] = useState<'phone' | 'email'>('phone')
  const [userPhone, setUserPhone]     = useState('')
  const [userEmail, setUserEmail]     = useState('')
  const [otpCode, setOtpCode]         = useState('')
  const [pinId, setPinId]             = useState('')
  const [sendingOtp, setSendingOtp]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [countdown, setCountdown]     = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiGetUserInfo().then(info => {
      setUserPhone(info.phonenumber || '')
      setUserEmail(info.email || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0 }
        return c - 1
      }), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  const [contactInput, setContactInput] = useState('')  // for social users with no contact
  const contact = contactMode === 'phone'
    ? (userPhone || contactInput)
    : (userEmail || contactInput)
  const hasContact = contactMode === 'phone' ? !!userPhone : !!userEmail
  const maskedContact = hasContact ? maskContact(contact) : ''

  async function sendOtp() {
    if (!contact) { onError(`No ${contactMode} on file`); return }
    setSendingOtp(true)
    try {
      // If social user is entering a new phone, check it's not already registered
      if (!hasContact && contactMode === 'phone' && contactInput) {
        const check = await client.get('/tuka/user/checkPhone', { params: { phone: contactInput } })
        if (check.data?.msg === 'exists') {
          onError('This phone number is already registered. Please log in with that account instead.')
          setSendingOtp(false)
          return
        }
      }
      if (contactMode === 'phone') {
        const res = await client.post('/tuka/otp/send', { phone: contact })
        setPinId(res.data?.data?.pinId || res.data?.pinId || '')
      } else {
        const res = await client.post('/tuka/otp/sendEmail', { email: contact })
        setPinId(res.data?.data?.pinId || res.data?.pinId || contact)
      }
      setCountdown(60)
    } catch (e: any) {
      onError(e.message || 'Failed to send code')
    } finally { setSendingOtp(false) }
  }

  async function handleVerify() {
    if (!pinId) { onError('Please send the verification code first'); return }
    if (!otpCode) { onError('Please enter the verification code'); return }
    setSaving(true)
    try {
      await client.post('/tuka/otp/verify', { pinId, pin: otpCode })
      // If user entered a new phone/email (social user case), save it
      if (!userPhone && !userEmail && contact) {
        try {
          await client.put('/system/user/profile', {
            phonenumber: contactMode === 'phone' ? contact : '',
            email:       contactMode === 'email' ? contact : '',
          })
          await client.put('/tuka/user/profile', {
            phone: contactMode === 'phone' ? contact : '',
            email: contactMode === 'email' ? contact : '',
          })
        } catch { /* non-critical */ }
      }
      onVerified()
    } catch (e: any) {
      onError(e.message || 'Invalid code')
    } finally { setSaving(false) }
  }

  const canVerify = otpCode.length >= 4 && !!pinId && !saving

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: spacing[4] }}>

      <Text style={ot.notice}>
        We'll send a verification code to confirm your identity before changing your withdrawal password.
      </Text>

      {/* Phone / Email toggle */}
      <View style={ot.toggleRow}>
        {(['phone', 'email'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[ot.toggleBtn, contactMode === mode && ot.toggleBtnOn]}
            onPress={() => { setContactMode(mode); setOtpCode(''); setPinId('') }}
            activeOpacity={0.8}>
            <Text style={[ot.toggleTxt, contactMode === mode && ot.toggleTxtOn]}>
              {mode === 'phone' ? 'Phone' : 'Email'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={ot.card}>
        {/* Show masked contact OR input field for social users */}
        {hasContact ? (
          <View style={[ot.field, ot.border]}>
            <Feather name={contactMode === 'phone' ? 'smartphone' : 'mail'} size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
            <Text style={ot.maskedTxt}>{maskedContact}</Text>
          </View>
        ) : (
          <View style={[ot.field, ot.border]}>
            <Feather name={contactMode === 'phone' ? 'smartphone' : 'mail'} size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
            <TextInput
              style={ot.input}
              placeholder={contactMode === 'phone' ? 'Enter your phone number' : 'Enter your email'}
              placeholderTextColor={colors.subtle}
              keyboardType={contactMode === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              value={contactInput}
              onChangeText={v => { setContactInput(v); setOtpCode(''); setPinId('') }}
            />
          </View>
        )}

        {/* OTP input + Send */}
        <View style={ot.field}>
          <Feather name="shield" size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
          <TextInput
            style={ot.input}
            placeholder="Verification code"
            placeholderTextColor={colors.subtle}
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={setOtpCode}
          />
          <TouchableOpacity onPress={sendOtp} disabled={sendingOtp || countdown > 0} activeOpacity={0.7}>
            {sendingOtp
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[ot.sendTxt, countdown > 0 && { color: colors.muted }]}>
                  {countdown > 0 ? `${countdown}s` : 'Send'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <View style={ot.btnWrap}>
        <TouchableOpacity
          style={[ot.btn, !canVerify && ot.btnOff]}
          onPress={handleVerify}
          disabled={!canVerify}
          activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={[ot.btnTxt, !canVerify && ot.btnTxtOff]}>Continue</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const ot = StyleSheet.create({
  notice: {
    fontSize: typography.size.sm, color: '#F59E0B',
    lineHeight: 20, marginHorizontal: spacing[5], marginBottom: spacing[4],
  },
  toggleRow: { flexDirection: 'row', gap: spacing[3], marginHorizontal: spacing[5], marginBottom: spacing[3] },
  toggleBtn: {
    paddingHorizontal: spacing[6], paddingVertical: spacing[2] + 2,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleBtnOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleTxt:    { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.muted },
  toggleTxtOn:  { color: '#fff' },
  card: {
    backgroundColor: colors.surface, marginHorizontal: spacing[4],
    borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], minHeight: 58,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  input:     { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold, paddingVertical: spacing[4] },
  maskedTxt: { flex: 1, fontSize: typography.size.lg, color: colors.muted, fontWeight: typography.weight.extrabold },
  sendTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  btnWrap:   { paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  btn:       { backgroundColor: '#1A1A1A', borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center' },
  btnOff:    { backgroundColor: '#E0E0E0' },
  btnTxt:    { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: '#fff' },
  btnTxtOff: { color: '#AAAAAA' },
})

// ── Step 2: Set new withdrawal PIN ───────────────────────────────────────────
function StepSetPassword({ loginPw, onSuccess, onError, isReset = false }: {
  loginPw: string; onSuccess: () => void; onError: (msg: string) => void; isReset?: boolean
}) {
  const [pin, setPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage]     = useState<'enter' | 'confirm'>('enter')
  const [saving, setSaving]   = useState(false)
  const pinRef = useRef('')   // ref to avoid stale closure

  const PIN_LENGTH = 4

  async function handleConfirm(finalConfirmPin: string) {
    if (pinRef.current !== finalConfirmPin) {
      onError('PINs do not match. Please try again.')
      setConfirmPin('')
      setStage('enter')
      setPin('')
      pinRef.current = ''
      return
    }
    setSaving(true)
    try {
      if (isReset) {
        // Reset via OTP — no old password needed
        await client.put('/tuka/user/resetWithdrawPassword', { newPassword: pinRef.current })
      } else {
        await client.put('/tuka/user/withdrawPassword', { oldPassword: loginPw, newPassword: pinRef.current })
      }
      onSuccess()
    } catch (e: any) {
      onError(e?.response?.data?.msg || e?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  function pressDigit(d: string) {
    if (stage === 'enter') {
      if (pin.length >= PIN_LENGTH) return
      const next = pin + d
      setPin(next)
      pinRef.current = next
      if (next.length === PIN_LENGTH) setTimeout(() => setStage('confirm'), 200)
    } else {
      if (confirmPin.length >= PIN_LENGTH) return
      const next = confirmPin + d
      setConfirmPin(next)
      if (next.length === PIN_LENGTH) setTimeout(() => handleConfirm(next), 200)
    }
  }

  function pressDelete() {
    if (stage === 'enter') { setPin(p => { const n = p.slice(0, -1); pinRef.current = n; return n }) }
    else setConfirmPin(p => p.slice(0, -1))
  }

  const currentPin = stage === 'enter' ? pin : confirmPin

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ]

  return (
    <View style={{ flex: 1 }}>
      {/* Title */}
      <View style={pp.titleWrap}>
        <Text style={pp.title}>
          {stage === 'enter' ? 'Set Withdrawal PIN' : 'Confirm PIN'}
        </Text>
        <Text style={pp.subtitle}>
          {stage === 'enter'
            ? 'Enter a 4-digit PIN for withdrawals'
            : 'Re-enter your PIN to confirm'}
        </Text>
      </View>

      {/* PIN dots */}
      <View style={pp.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[pp.dot, i < currentPin.length && pp.dotFilled]}>
            {i < currentPin.length && <View style={pp.dotInner} />}
          </View>
        ))}
      </View>

      {saving && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[4] }} />}

      <View style={{ flex: 1 }} />

      {/* Numpad */}
      <View style={pp.numpad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={pp.numRow}>
            {row.map((key, ki) => {
              if (!key) return <View key={ki} style={pp.numKey} />
              if (key === 'del') return (
                <TouchableOpacity key={ki} style={pp.numKey} onPress={pressDelete} activeOpacity={0.6}>
                  <Feather name="delete" size={22} color={colors.dark} />
                </TouchableOpacity>
              )
              return (
                <TouchableOpacity key={ki} style={pp.numKey} onPress={() => pressDigit(key)} activeOpacity={0.6}>
                  <Text style={pp.numTxt}>{key}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

const pp = StyleSheet.create({
  titleWrap: { alignItems: 'center', paddingTop: spacing[6], paddingHorizontal: spacing[6] },
  title:     { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2], textAlign: 'center' },
  subtitle:  { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  dotsRow:   { flexDirection: 'row', justifyContent: 'center', gap: spacing[4], marginTop: spacing[6] },
  dot:       { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dotInner:  { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
  numpad:    { paddingHorizontal: spacing[6], paddingBottom: spacing[6] },
  numRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  numKey:    { width: 80, height: 72, alignItems: 'center', justifyContent: 'center' },
  numTxt:    { fontSize: RF(28), fontWeight: typography.weight.semibold, color: colors.dark },
})

// ── Step: Change PIN (enter old PIN → new PIN) ────────────────────────────────
function StepChangePIN({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [oldPin, setOldPin]   = useState('')
  const [newPin, setNewPin]   = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [stage, setStage]     = useState<'old' | 'new' | 'confirm'>('old')
  const [saving, setSaving]   = useState(false)
  const oldPinRef = useRef('')
  const newPinRef = useRef('')

  const PIN_LENGTH = 4

  async function handleConfirm(finalConfirm: string) {
    if (newPinRef.current !== finalConfirm) {
      onError('PINs do not match. Please try again.')
      setConfirmPin(''); setNewPin(''); setOldPin('')
      oldPinRef.current = ''; newPinRef.current = ''
      setStage('old')
      return
    }
    setSaving(true)
    try {
      await client.put('/tuka/user/withdrawPassword', {
        oldPassword: oldPinRef.current,
        newPassword: newPinRef.current,
      })
      onSuccess()
    } catch (e: any) {
      onError(e?.response?.data?.msg || e?.message || 'Incorrect current PIN')
      setOldPin(''); oldPinRef.current = ''
      setStage('old')
    } finally { setSaving(false) }
  }

  function pressDigit(d: string) {
    if (stage === 'old') {
      if (oldPin.length >= PIN_LENGTH) return
      const next = oldPin + d; setOldPin(next); oldPinRef.current = next
      if (next.length === PIN_LENGTH) setTimeout(() => setStage('new'), 200)
    } else if (stage === 'new') {
      if (newPin.length >= PIN_LENGTH) return
      const next = newPin + d; setNewPin(next); newPinRef.current = next
      if (next.length === PIN_LENGTH) setTimeout(() => setStage('confirm'), 200)
    } else {
      if (confirmPin.length >= PIN_LENGTH) return
      const next = confirmPin + d; setConfirmPin(next)
      if (next.length === PIN_LENGTH) setTimeout(() => handleConfirm(next), 200)
    }
  }

  function pressDelete() {
    if (stage === 'old') { setOldPin(p => { const n = p.slice(0,-1); oldPinRef.current = n; return n }) }
    else if (stage === 'new') { setNewPin(p => { const n = p.slice(0,-1); newPinRef.current = n; return n }) }
    else setConfirmPin(p => p.slice(0,-1))
  }

  const currentPin = stage === 'old' ? oldPin : stage === 'new' ? newPin : confirmPin
  const titles = { old: 'Enter Current PIN', new: 'Enter New PIN', confirm: 'Confirm New PIN' }
  const subs   = { old: 'Enter your current 4-digit withdrawal PIN', new: 'Enter a new 4-digit PIN', confirm: 'Re-enter your new PIN to confirm' }

  const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','del']]

  return (
    <View style={{ flex: 1 }}>
      <View style={pp.titleWrap}>
        <Text style={pp.title}>{titles[stage]}</Text>
        <Text style={pp.subtitle}>{subs[stage]}</Text>
      </View>
      <View style={pp.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[pp.dot, i < currentPin.length && pp.dotFilled]}>
            {i < currentPin.length && <View style={pp.dotInner} />}
          </View>
        ))}
      </View>
      {saving && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[4] }} />}
      <View style={{ flex: 1 }} />
      <View style={pp.numpad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={pp.numRow}>
            {row.map((key, ki) => {
              if (!key) return <View key={ki} style={pp.numKey} />
              if (key === 'del') return (
                <TouchableOpacity key={ki} style={pp.numKey} onPress={pressDelete} activeOpacity={0.6}>
                  <Feather name="delete" size={22} color={colors.dark} />
                </TouchableOpacity>
              )
              return (
                <TouchableOpacity key={ki} style={pp.numKey} onPress={() => pressDigit(key)} activeOpacity={0.6}>
                  <Text style={pp.numTxt}>{key}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function WithdrawPasswordScreen(props: StackScreenProps<RootStackParams, 'WithdrawPassword'>) {
  const hasPin = (props.route?.params as any)?.hasPin ?? false
  const [mode, setMode]   = useState<'choose' | 'change' | 'reset' | null>(hasPin ? 'choose' : null)
  const [step, setStep]   = useState<'otp' | 'set'>(hasPin ? 'otp' : 'otp')
  const { showSuccess, showError, Toast } = useToast()

  function handleSuccess() { showSuccess('PIN updated'); setTimeout(() => props.navigation.goBack(), 2200) }

  function getTitle() {
    if (mode === 'choose') return 'Withdrawal PIN'
    if (mode === 'change') return 'Change PIN'
    if (mode === 'reset')  return step === 'otp' ? 'Verify Identity' : 'Set New PIN'
    return step === 'otp' ? 'Verify Identity' : 'Set Withdrawal PIN'
  }

  function handleBack() {
    if (mode === 'change' || mode === 'reset') { setMode('choose'); setStep('otp') }
    else if (step === 'set') setStep('otp')
    else props.navigation.goBack()
  }

  return (
    <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{getTitle()}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Choose mode — only shown when PIN already set */}
        {mode === 'choose' && (
          <View style={s.chooseWrap}>
            <Text style={s.chooseTitle}>What would you like to do?</Text>

            <TouchableOpacity style={s.chooseBtn} onPress={() => setMode('change')} activeOpacity={0.8}>
              <View style={s.chooseBtnIcon}>
                <Feather name="lock" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.chooseBtnTitle}>Change PIN</Text>
                <Text style={s.chooseBtnSub}>Enter your current PIN then set a new one</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.border} />
            </TouchableOpacity>

            <TouchableOpacity style={s.chooseBtn} onPress={() => setMode('reset')} activeOpacity={0.8}>
              <View style={s.chooseBtnIcon}>
                <Feather name="refresh-cw" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.chooseBtnTitle}>Reset PIN</Text>
                <Text style={s.chooseBtnSub}>Verify via OTP then set a new PIN</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.border} />
            </TouchableOpacity>
          </View>
        )}

        {/* Change PIN flow */}
        {mode === 'change' && (
          <StepChangePIN onSuccess={handleSuccess} onError={showError} />
        )}

        {/* Reset PIN flow (OTP → set new) */}
        {(mode === 'reset' || mode === null) && (
          step === 'otp'
            ? <StepOtp onVerified={() => setStep('set')} onError={showError} />
            : <StepSetPassword loginPw="" isReset={true} onSuccess={handleSuccess} onError={showError} />
        )}

      </KeyboardAvoidingView>

      {Toast}
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

  // Choose mode
  chooseWrap: { flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[6] },
  chooseTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[5],
  },
  chooseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[4],
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[5], marginBottom: spacing[3], ...shadow.sm,
  },
  chooseBtnIcon: {
    width: 48, height: 48, borderRadius: radius.lg,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  chooseBtnTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: 3 },
  chooseBtnSub:   { fontSize: typography.size.sm, color: colors.muted },
})
