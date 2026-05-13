import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, KeyboardAvoidingView, ScrollView, Platform,
  Keyboard, ActivityIndicator, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from '../../../theme'
import { keyboardBehavior, ms, RF } from '../../../util/responsive'
import { prefixWithPlus, sanitizePhone, isValidPhone, getExpectedDigits, getFullPhone, maskPhone } from '../phoneUtils'
import { StepHeader, CountryPickerModal } from '../AuthComponents'
import { s, suc } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'

// ── Shared flat-design styles ─────────────────────────────────────────────────
const flat = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F5F6FA' },
  scroll:     { flexGrow: 1, paddingHorizontal: spacing[6] },
  iconWrap:   { alignItems: 'center', marginBottom: ms(20) },
  iconBg:     { width: ms(64), height: ms(64), borderRadius: ms(16), backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: RF(28), fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: ms(8) },
  subtitle:   { fontSize: RF(16), fontWeight: '500', color: '#8A94A6', textAlign: 'center', lineHeight: ms(24), marginBottom: ms(24) },
  fieldWrap:  { marginBottom: ms(16) },
  fieldLabel: { fontSize: RF(15), fontWeight: '700', color: '#1A1A2E', marginBottom: ms(8) },
  required:   { color: '#EF4444' },
  inputBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: ms(10), borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: ms(14), paddingVertical: ms(14), gap: ms(8) },
  inputBoxError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  input:      { flex: 1, fontSize: RF(16), color: '#1A1A2E', paddingVertical: 0 },
  errRow:     { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(6) },
  errTxt:     { fontSize: RF(13), color: '#EF4444' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: ms(12), paddingVertical: ms(17), alignItems: 'center', justifyContent: 'center', marginBottom: ms(16) },
  primaryBtnOff: { backgroundColor: '#D0D5DD' },
  primaryBtnTxt: { fontSize: RF(17), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  primaryBtnTxtOff: { color: '#8A94A6' },
  hintRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: ms(12) },
  hintChip:   { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: ms(20), paddingHorizontal: spacing[2], paddingVertical: 3 },
  hintTxt:    { fontSize: RF(11), fontWeight: '500' },
  navRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingTop: ms(16), paddingBottom: ms(12) },
  helpTxt:    { fontSize: RF(15), fontWeight: '600', color: colors.primary },
})

export interface ForgotStepProps {
  step: 'forgot' | 'forgot_otp' | 'forgot_newpassword' | 'password_success'
  // State
  phone: string
  otp: string[]
  otpFocused: number
  password: string
  confirmPw: string
  showPw: boolean
  showConfirmPw: boolean
  loading: boolean
  error: string
  countdown: number
  canResend: boolean
  otpTestCode: string
  showHelp: boolean
  // Country
  selectedCountry: Country
  countries: Country[]
  countriesLoading: boolean
  countryPickerOpen: boolean
  // Animated
  liCardOpacity: Animated.Value
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
  // Insets
  insetsBottom: number
  // Refs
  otpRefs: React.MutableRefObject<(TextInput | null)[]>
  // Setters
  setPhone: (v: string) => void
  setOtp: (v: string[]) => void
  setOtpFocused: (v: number) => void
  setPassword: (v: string) => void
  setConfirmPw: (v: string) => void
  setShowPw: (fn: (v: boolean) => boolean) => void
  setShowConfirmPw: (fn: (v: boolean) => boolean) => void
  setError: (v: string) => void
  setLoading: (v: boolean) => void
  setCountryPickerOpen: (v: boolean) => void
  setSelectedCountry: (c: Country) => void
  setShowHelp: (v: boolean) => void
  setCanResend: (v: boolean) => void
  setCountdown: (v: number) => void
  setLoginInput: (v: string) => void
  // Handlers
  sendOtpToPhone: (phone: string) => Promise<boolean>
  otpFullPhone?: string
  otpPinId?: string
  verifiedOtp?: string
  verifyOtpCode: (pin: string) => Promise<boolean>
  resetPassword: (phone: string, password: string, pinId?: string, otp?: string) => Promise<void>
  goTo: (s: Step) => void
}

export function ForgotStep(props: ForgotStepProps) {
  const {
    step, phone, otp, otpFocused, password, confirmPw, showPw, showConfirmPw,
    loading, error, countdown, canResend, otpTestCode, showHelp,
    selectedCountry, countries, countriesLoading, countryPickerOpen,
    insetsBottom, otpRefs,
    setPhone, setOtp, setOtpFocused, setPassword, setConfirmPw,
    setShowPw, setShowConfirmPw, setError, setLoading, setCountryPickerOpen,
    setSelectedCountry, setShowHelp, setCanResend, setCountdown, setLoginInput,
    sendOtpToPhone, verifyOtpCode, resetPassword, goTo,
  } = props
  const otpFullPhone = props.otpFullPhone
  const otpPinId = props.otpPinId
  const verifiedOtp = props.verifiedOtp

  const insets = useSafeAreaInsets()
  const topInset = Platform.OS === 'ios' ? insets.top : getStatusBarHeight()

  const sanitizeLocalPhone = (v: string) => sanitizePhone(v, selectedCountry)
  const getExpectedLocalDigits = () => getExpectedDigits(selectedCountry)
  const getPhoneValidationMessage = () => {
    const n = getExpectedDigits(selectedCountry)
    return n ? `Enter a valid ${n}-digit phone number` : 'Enter a valid phone number'
  }
  const isValidPhoneLocal = (v: string) => isValidPhone(v, selectedCountry)
  const getFullPhoneLocal = (v: string) => getFullPhone(v, selectedCountry)

  function openCountryPicker() {
    Keyboard.dismiss()
    setCountryPickerOpen(true)
  }

  const otpValue = otp.join('')

  // Confirm password touched — only show mismatch after user leaves the field
  const [confirmTouched, setConfirmTouched] = useState(false)

  // ── FORGOT — enter phone ─────────────────────────────────────────────────
  if (step === 'forgot') {
    const normalizedPhone = sanitizeLocalPhone(phone)
    const fullPhone = getFullPhoneLocal(phone)
    const canNext = isValidPhoneLocal(phone)

    return (
      <>
        <CountryPickerModal
          visible={countryPickerOpen} countries={countries} selected={selectedCountry}
          onSelect={c => { setSelectedCountry(c); setCountryPickerOpen(false) }}
          onClose={() => setCountryPickerOpen(false)} loading={countriesLoading}
        />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView style={[{ flex: 1 }, { paddingTop: topInset }]} behavior={keyboardBehavior} keyboardVerticalOffset={0}>
            <View style={flat.root}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}
                contentContainerStyle={[flat.scroll, { paddingBottom: Math.max(insetsBottom, 48) + ms(24) }]}>

                {/* Back */}
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', marginBottom: ms(20) }}
                  onPress={() => { setError(''); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <View style={{ width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' }}>
                    <Feather name="chevron-left" size={18} color="#1A1A2E" />
                  </View>
                </TouchableOpacity>

                {/* Icon */}
                <View style={flat.iconWrap}>
                  <View style={flat.iconBg}>
                    <Feather name="key" size={ms(28)} color="#FFFFFF" />
                  </View>
                </View>

                <Text style={flat.title}>Reset Password</Text>
                <Text style={flat.subtitle}>Enter your phone number and we'll send you a verification code</Text>

                {/* Phone */}
                <View style={flat.fieldWrap}>
                  <Text style={flat.fieldLabel}>Phone Number<Text style={flat.required}>*</Text></Text>
                  <View style={flat.inputBox}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: ms(4), paddingRight: ms(8), borderRightWidth: 1, borderRightColor: '#E2E8F0', marginRight: ms(4) }}
                      onPress={openCountryPicker} activeOpacity={0.7}>
                      <Text style={{ fontSize: RF(15), color: '#1A1A2E', fontWeight: '600' }}>{prefixWithPlus(selectedCountry.phonePrefix)}</Text>
                      <Feather name="chevron-down" size={13} color="#8A94A6" />
                    </TouchableOpacity>
                    <TextInput style={flat.input} placeholder="Phone number"
                      placeholderTextColor="#BBBBBB" keyboardType="phone-pad"
                      maxLength={getExpectedLocalDigits() ?? 14}
                      value={phone} onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }} />
                  </View>
                  {!!error && (
                    <View style={flat.errRow}>
                      <Feather name="alert-circle" size={12} color="#EF4444" />
                      <Text style={flat.errTxt}>{error}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[flat.primaryBtn, (!canNext || loading) && flat.primaryBtnOff]}
                  onPress={async () => {
                    if (!canNext) { setError(getPhoneValidationMessage()); return }
                    setLoading(true); setError('')
                    try {
                      const { default: api } = await import('../../../api/client')
                      const res = await api.get('/tuka/user/checkPhone', { params: { phone: fullPhone } })
                      if (res.data?.msg === 'available') { setError('No account found with this number.'); return }
                      const sent = await sendOtpToPhone(fullPhone)
                      if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                    } catch (e: any) {
                      const msg: string = e?.message || ''
                      if (msg.includes('Network') || msg.includes('timeout')) {
                        setError('Connection failed. Check your internet and try again.')
                      } else {
                        const sent = await sendOtpToPhone(fullPhone)
                        if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                      }
                    } finally { setLoading(false) }
                  }}
                  activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[flat.primaryBtnTxt, (!canNext || loading) && flat.primaryBtnTxtOff]}>Send Code</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </>
    )
  }

  // ── FORGOT OTP ────────────────────────────────────────────────────────────
  if (step === 'forgot_otp') {
    const otpFilled = otpValue.length === 6
    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, { paddingTop: topInset }]}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={0}
      >
        <View style={flat.root}>
          {/* Simple nav row — no progress bar */}
          <View style={flat.navRow}>
            <TouchableOpacity style={flat.backCircle} onPress={() => goTo('forgot')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="chevron-left" size={18} color="#1A1A2E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={flat.helpTxt}>Help</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[flat.scroll, { paddingTop: ms(16), paddingBottom: ms(80) }]}
          >
            <View style={flat.iconWrap}>
              <View style={flat.iconBg}>
                <Feather name="message-square" size={ms(28)} color="#FFFFFF" />
              </View>
            </View>

            <Text style={flat.title}>Enter Verification Code</Text>
            <Text style={flat.subtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>{maskPhone(phone)}</Text>
            </Text>

            {/* OTP boxes */}
            <View style={otp6.row}>
              {otp.map((d, i) => (
                <TextInput
                  key={i}
                  ref={r => { otpRefs.current[i] = r }}
                  style={[otp6.box, otpFocused === i && !d && otp6.boxFocused, !!d && otp6.boxFilled]}
                  value={d}
                  onFocus={() => {
                    // Redirect to first empty box — can't skip ahead
                    const firstEmpty = otp.findIndex(v => !v)
                    if (firstEmpty !== -1 && firstEmpty < i) {
                      otpRefs.current[firstEmpty]?.focus()
                      return
                    }
                    setOtpFocused(i)
                  }}
                  onBlur={() => setOtpFocused(-1)}
                  selectionColor={colors.primary}
                  cursorColor={colors.primary}
                  onChangeText={v => {
                    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
                    if (v && i < 5) { otpRefs.current[i + 1]?.focus() }
                    else if (v && i === 5) { Keyboard.dismiss() }
                    if (!v && i > 0) otpRefs.current[i - 1]?.focus()
                  }}
                  onKeyPress={e => { if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus() }}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {!!error && (
              <View style={[flat.errRow, { justifyContent: 'center', marginBottom: ms(8) }]}>
                <Feather name="alert-circle" size={12} color="#EF4444" />
                <Text style={flat.errTxt}>{error}</Text>
              </View>
            )}

            <View style={{ alignItems: 'center', marginBottom: ms(24) }}>
              {canResend ? (
                <TouchableOpacity
                  style={otp6.resendBtn}
                  onPress={async () => { setOtp(['','','','','','']); setCanResend(false); setCountdown(60); await sendOtpToPhone(otpFullPhone || phone) }}
                  activeOpacity={0.8}>
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={otp6.resendTxt}>Resend Code</Text>
                </TouchableOpacity>
              ) : (
                <Text style={otp6.countdownTxt}>
                  Resend in{' '}
                  <Text style={{ fontWeight: '700', color: '#1A1A2E' }}>
                    {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}
                  </Text>
                </Text>
              )}
            </View>

            {!!otpTestCode && (
              <View style={{ alignItems: 'center', marginBottom: ms(12) }}>
                <Text style={{ fontSize: RF(12), color: colors.warning }}>
                  🔧 Test mode — code: <Text style={{ fontWeight: '700' }}>{otpTestCode}</Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[flat.primaryBtn, (!otpFilled || loading) && flat.primaryBtnOff]}
              onPress={async () => {
                if (!otpFilled || loading) return
                setLoading(true)
                try {
                  const ok = await verifyOtpCode(otpValue)
                  if (ok) { setPassword(''); setConfirmPw(''); goTo('forgot_newpassword') }
                } finally {
                  setLoading(false)
                }
              }}
              disabled={!otpFilled || loading}
              activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[flat.primaryBtnTxt, !otpFilled && flat.primaryBtnTxtOff]}>Verify</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ── FORGOT NEW PASSWORD ───────────────────────────────────────────────────
  if (step === 'forgot_newpassword') {
    const hasUpper  = /[A-Z]/.test(password)
    const hasLower  = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasLength = password.length >= 8
    const isValid   = hasLength && hasUpper && hasLower && hasNumber && password === confirmPw
    const showHints = password.length > 0

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={[{ flex: 1 }, { paddingTop: topInset }]} behavior={keyboardBehavior} keyboardVerticalOffset={0}>
          <View style={flat.root}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}
              contentContainerStyle={[flat.scroll, { paddingTop: ms(8), paddingBottom: Math.max(insetsBottom, 48) + ms(24) }]}>

              {/* Back */}
              <TouchableOpacity
                style={{ alignSelf: 'flex-start', marginBottom: ms(20) }}
                onPress={() => goTo('forgot_otp')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={{ width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' }}>
                  <Feather name="chevron-left" size={18} color="#1A1A2E" />
                </View>
              </TouchableOpacity>

              <View style={flat.iconWrap}>
                <View style={flat.iconBg}>
                  <Feather name="lock" size={ms(28)} color="#FFFFFF" />
                </View>
              </View>

              <Text style={flat.title}>Set New Password</Text>
              <Text style={flat.subtitle}>Choose a strong password for your Cardyn account</Text>

              {/* New Password */}
              <View style={flat.fieldWrap}>
                <Text style={flat.fieldLabel}>New Password<Text style={flat.required}>*</Text></Text>
                <View style={flat.inputBox}>
                  <TextInput style={flat.input} placeholder="Min 8 characters"
                    placeholderTextColor="#BBBBBB" secureTextEntry={!showPw}
                    value={password} onChangeText={t => { setPassword(t); setError('') }} returnKeyType="next" />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name={showPw ? 'eye' : 'eye-off'} size={18} color="#BBBBBB" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Strength hints */}
              {showHints && (
                <View style={[flat.hintRow, { marginBottom: ms(12) }]}>
                  {[{ label: '8+ chars', ok: hasLength }, { label: 'Uppercase', ok: hasUpper }, { label: 'Lowercase', ok: hasLower }, { label: 'Number', ok: hasNumber }].map(h => (
                    <View key={h.label} style={[flat.hintChip, { backgroundColor: h.ok ? '#E8F8F0' : '#F5F5F5' }]}>
                      <Feather name={h.ok ? 'check' : 'x'} size={11} color={h.ok ? '#22C55E' : '#AAAAAA'} />
                      <Text style={[flat.hintTxt, { color: h.ok ? '#22C55E' : '#AAAAAA' }]}>{h.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Confirm Password */}
              <View style={flat.fieldWrap}>
                <Text style={flat.fieldLabel}>Confirm Password<Text style={flat.required}>*</Text></Text>
                <View style={[flat.inputBox, confirmTouched && confirmPw.length > 0 && password !== confirmPw && flat.inputBoxError]}>
                  <TextInput style={flat.input} placeholder="Re-enter password"
                    placeholderTextColor="#BBBBBB" secureTextEntry={!showConfirmPw}
                    value={confirmPw}
                    onChangeText={t => { setConfirmPw(t); setError('') }}
                    onBlur={() => setConfirmTouched(true)}
                    returnKeyType="done" />
                  <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name={showConfirmPw ? 'eye' : 'eye-off'} size={18} color="#BBBBBB" />
                  </TouchableOpacity>
                </View>
                {/* Only show mismatch after user leaves the field */}
                {confirmTouched && confirmPw.length > 0 && password !== confirmPw && (
                  <View style={flat.errRow}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={flat.errTxt}>Passwords do not match</Text>
                  </View>
                )}
              </View>

              {!!error && (
                <View style={flat.errRow}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={flat.errTxt}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[flat.primaryBtn, { marginTop: ms(8) }, (!isValid || loading) && flat.primaryBtnOff]}
                onPress={async () => {
                  if (!isValid) return
                  setLoading(true)
                  try {
                    await resetPassword(phone, password, otpPinId, verifiedOtp || otp.join(''))
                    setConfirmPw(''); setError('')
                    goTo('password_success')
                  } catch (e: any) {
                    const msg: string = e?.message || ''
                    if (msg.includes('Network') || msg.includes('timeout')) { setError('Connection failed. Check your internet and try again.') }
                    else { setError(msg || 'Failed to reset password. Please try again.') }
                  } finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[flat.primaryBtnTxt, (!isValid || loading) && flat.primaryBtnTxtOff]}>Update Password</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    )
  }

  // ── PASSWORD SUCCESS ──────────────────────────────────────────────────────
  if (step === 'password_success') {
    return (
      <View style={[flat.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] }]}>
        {/* Success icon */}
        <View style={suc.iconWrap}>
          <View style={suc.iconOuter}>
            <View style={suc.iconInner}>
              <Feather name="check" size={40} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={suc.title}>Password Updated!</Text>
        <Text style={suc.sub}>
          Your password has been reset successfully.{'\n'}You can now sign in with your new password.
        </Text>

        <TouchableOpacity
          style={[flat.primaryBtn, { width: '100%', marginTop: spacing[8] }]}
          onPress={() => { setPassword(''); setLoginInput(phone || ''); goTo('login') }}
          activeOpacity={0.85}>
          <Text style={flat.primaryBtnTxt}>Sign In Now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return null
}

// ── Inline error styles (kept for fInlineErr references) ─────────────────────
const fInlineErr = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF1F1', borderRadius: ms(10), borderWidth: 1, borderColor: '#FFD6D6', paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[2] },
  txt: { fontSize: RF(13), color: '#CC0000', flex: 1, lineHeight: ms(18) },
})

// ── OTP 6-box styles ──────────────────────────────────────────────────────────
const otp6 = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(10),
    marginBottom: ms(20),
    paddingHorizontal: spacing[2],
  },
  box: {
    width: ms(48),
    height: ms(58),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    textAlign: 'center',
    fontSize: RF(24),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  boxFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  boxFilled: {
    backgroundColor: '#E6F7F5',
    borderColor: colors.primary,
    color: colors.primary,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    backgroundColor: '#E6F7F5',
    borderRadius: ms(50),
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
  },
  resendTxt: {
    fontSize: RF(14),
    fontWeight: '600',
    color: colors.primary,
  },
  countdownTxt: {
    fontSize: RF(14),
    color: '#8A94A6',
  },
})
