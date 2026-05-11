import React, { useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Animated, KeyboardAvoidingView, ScrollView, Platform,
  Keyboard, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing } from '../../../theme'
import { keyboardBehavior, ms, SCREEN_H } from '../../../util/responsive'
import { prefixWithPlus, sanitizePhone, isValidPhone, getExpectedDigits, getFullPhone, maskPhone } from '../phoneUtils'
import { StepHeader, CountryPickerModal } from '../AuthComponents'
import { li2, s, suc } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'

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
    liCardOpacity, fadeAnim, slideAnim, insetsBottom, otpRefs,
    setPhone, setOtp, setOtpFocused, setPassword, setConfirmPw,
    setShowPw, setShowConfirmPw, setError, setLoading, setCountryPickerOpen,
    setSelectedCountry, setShowHelp, setCanResend, setCountdown, setLoginInput,
    sendOtpToPhone, verifyOtpCode, resetPassword, goTo,
  } = props
  const otpFullPhone = props.otpFullPhone
  const otpPinId = props.otpPinId
  const verifiedOtp = props.verifiedOtp

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

  function handleOtpKey(e: any, i: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  // Animated spacer — shrinks when keyboard opens (same as login/signup)
  const spacerHeight = useRef(new Animated.Value(SCREEN_H * 0.18)).current
  useEffect(() => {
    if (step !== 'forgot' && step !== 'forgot_newpassword') return
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => Animated.spring(spacerHeight, { toValue: SCREEN_H * 0.02, useNativeDriver: false, tension: 60, friction: 14 }).start()
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => Animated.spring(spacerHeight, { toValue: SCREEN_H * 0.18, useNativeDriver: false, tension: 55, friction: 14 }).start()
    )
    return () => { show.remove(); hide.remove() }
  }, [step])

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
        <View style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
          <View style={li2.root}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

            <SafeAreaView edges={['top']} style={li2.safeTop}>
              <View style={li2.navRow}>
                <TouchableOpacity onPress={() => { setError(''); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Feather name="chevron-left" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
                  <Text style={li2.helpTxt}>Help</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            <View style={li2.heroWrap} pointerEvents="none">
              <Text style={li2.heroTitle}>Reset{'\n'}Password</Text>
            </View>

            {/* Animated spacer — shrinks when keyboard opens */}
            <Animated.View style={{ height: spacerHeight }} />

            <View style={{ backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insetsBottom, 16) + 100 }} />
            <Animated.View style={[li2.card, { opacity: liCardOpacity, paddingBottom: Math.max(insetsBottom, 16) + spacing[4] }]}>

              <View style={[li2.inputRow, { marginTop: spacing[5] }]}>
                <TouchableOpacity style={s.flagSection} onPress={openCountryPicker} activeOpacity={0.7}>
                  <Text style={[li2.inputLabel, { minWidth: 0, marginRight: 0 }]}>{prefixWithPlus(selectedCountry.phonePrefix)}</Text>
                  <Feather name="chevron-down" size={13} color={colors.muted} />
                </TouchableOpacity>
                <View style={li2.inputDivider} />
                <TextInput style={li2.input} placeholder="Phone number"
                  placeholderTextColor="#BBBBBB" keyboardType="phone-pad"
                  maxLength={getExpectedLocalDigits() ?? 14}
                  value={phone}
                  onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }} />
              </View>

              {!!error && (
                <View style={fInlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={fInlineErr.txt}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[li2.btn, (!canNext || loading) && li2.btnOff]}
                onPress={async () => {
                  if (!canNext) { setError(getPhoneValidationMessage()); return }
                  setLoading(true); setError('')
                  try {
                    const { default: api } = await import('../../../api/client')
                    const res = await api.get('/tuka/user/checkPhone', { params: { phone: fullPhone } })
                    if (res.data?.msg === 'available') { setError('No account found with this number. Check and try again.'); return }
                    const sent = await sendOtpToPhone(fullPhone)
                    if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                  } catch (e: any) {
                    const msg: string = e?.message || ''
                    if (msg.includes('Network') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
                      setError('Connection failed. Check your internet and try again.')
                    } else {
                      // Try anyway — phone check failed but OTP might still work
                      const sent = await sendOtpToPhone(fullPhone)
                      if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                    }
                  } finally { setLoading(false) }
                }}
                activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[li2.btnTxt, (!canNext || loading) && li2.btnTxtOff]}>Send Code</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          </View>
          </KeyboardAvoidingView>
        </View>
        </TouchableWithoutFeedback>
      </>
    )
  }

  // ── FORGOT OTP ────────────────────────────────────────────────────────────
  if (step === 'forgot_otp') {
    const otpFilled = otpValue.length === 6
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <StepHeader onBack={() => goTo('forgot')} progress={0.66}
              onHelp={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }} />

            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Enter Verification{'\n'}Code</Text>
              <Text style={s.stepSub}>
                We sent a 6-digit code to{' '}
                <Text style={{ fontWeight: typography.weight.bold, color: colors.dark }}>{maskPhone(phone)}</Text>
              </Text>

              <View style={s.otpRow}>
                {otp.map((d, i) => (
                  <TextInput key={i} ref={r => { otpRefs.current[i] = r }}
                    style={[s.otpBox, otpFocused === i && !d && s.otpBoxFocused, d ? s.otpBoxOn : null]}
                    value={d}
                    onFocus={() => setOtpFocused(i)}
                    onBlur={() => setOtpFocused(-1)}
                    selectionColor={colors.primary}
                    cursorColor={colors.primary}
                    onChangeText={v => {
                      const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
                      if (v && i < 5) {
                        otpRefs.current[i + 1]?.focus()
                      } else if (v && i === 5) {
                        Keyboard.dismiss()
                      }
                      if (!v && i > 0) otpRefs.current[i - 1]?.focus()
                    }}
                    onKeyPress={e => handleOtpKey(e, i)}
                    keyboardType="number-pad" maxLength={1} selectTextOnFocus />
                ))}
              </View>

              {!!error && <Text style={s.errTxt}>{error}</Text>}

              <View style={s.resendWrap}>
                {canResend ? (
                  <TouchableOpacity style={s.resendBtn}
                    onPress={async () => {
                      setOtp(['','','','','',''])
                      setCanResend(false)
                      setCountdown(60)
                      await sendOtpToPhone(otpFullPhone || phone)
                    }}
                    activeOpacity={0.8}>
                    <Feather name="refresh-cw" size={14} color={colors.primary} />
                    <Text style={s.resendBtnTxt}>Resend Code</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={s.resendCountTxt}>Resend in </Text>
                    <Text style={[s.resendCountTxt, { fontWeight: typography.weight.bold, color: colors.dark }]}>
                      {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}
                    </Text>
                  </View>
                )}
              </View>
              {!!otpTestCode && (
                <View style={{ alignItems: 'center', marginTop: spacing[2] }}>
                  <Text style={{ fontSize: typography.size.xs, color: colors.warning }}>
                    🔧 Test mode — your code: <Text style={{ fontWeight: typography.weight.bold }}>{otpTestCode}</Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }} />
            <View style={s.bottomPad}>
              <TouchableOpacity
                style={[s.primaryBtn, (!otpFilled || loading) && s.primaryBtnOff]}
                onPress={async () => {
                  const ok = await verifyOtpCode(otpValue)
                  if (ok) { setPassword(''); setConfirmPw(''); goTo('forgot_newpassword') }
                }}
                disabled={!otpFilled || loading} activeOpacity={0.85}>
                <Text style={[s.primaryBtnTxt, !otpFilled && s.primaryBtnTxtOff]}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── FORGOT NEW PASSWORD — matches signup password strength requirements ──────
  if (step === 'forgot_newpassword') {
    const hasUpper  = /[A-Z]/.test(password)
    const hasLower  = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasLength = password.length >= 8
    const isValid   = hasLength && hasUpper && hasLower && hasNumber && password === confirmPw
    const showHints = password.length > 0
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
        <View style={li2.root}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

          <SafeAreaView edges={['top']} style={li2.safeTop}>
            <View style={li2.navRow}>
              <TouchableOpacity onPress={() => goTo('forgot_otp')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Feather name="chevron-left" size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
                <Text style={li2.helpTxt}>Help</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={li2.heroWrap} pointerEvents="none">
            <Text style={li2.heroTitle}>Set New{'\n'}Password</Text>
          </View>

          {/* Animated spacer — shrinks when keyboard opens */}
          <Animated.View style={{ height: spacerHeight }} />

          <View style={{ backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insetsBottom, 16) + 100 }} />
          <Animated.View style={[li2.card, { opacity: liCardOpacity, paddingBottom: Math.max(insetsBottom, 16) + spacing[4] }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

              {/* New Password */}
              <View style={li2.pwRow}>
                <Feather name="lock" size={16} color="#AAAAAA" />
                <TextInput style={li2.pwInput} placeholder="New Password (min 8 chars)"
                  placeholderTextColor="#BBBBBB" secureTextEntry={!showPw}
                  value={password} onChangeText={t => { setPassword(t); setError('') }}
                  returnKeyType="next" />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={16} color="#AAAAAA" />
                </TouchableOpacity>
              </View>

              {/* Password strength hints */}
              {showHints && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: spacing[2], marginBottom: spacing[2] }}>
                  {[
                    { label: '8+ chars', ok: hasLength },
                    { label: 'Uppercase', ok: hasUpper },
                    { label: 'Lowercase', ok: hasLower },
                    { label: 'Number', ok: hasNumber },
                  ].map(h => (
                    <View key={h.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: h.ok ? '#E8F8F0' : '#F5F5F5',
                      borderRadius: msF(20), paddingHorizontal: spacing[2], paddingVertical: 3 }}>
                      <Feather name={h.ok ? 'check' : 'x'} size={11} color={h.ok ? '#22C55E' : '#AAAAAA'} />
                      <Text style={{ fontSize: msF(11), color: h.ok ? '#22C55E' : '#AAAAAA', fontWeight: '500' }}>{h.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Confirm Password */}
              <View style={[li2.pwRow, confirmPw.length > 0 && password !== confirmPw && li2.pwRowError]}>
                <Feather name="lock" size={16} color={confirmPw.length > 0 && password !== confirmPw ? '#FF4D4F' : '#AAAAAA'} />
                <TextInput style={li2.pwInput} placeholder="Confirm Password"
                  placeholderTextColor="#BBBBBB" secureTextEntry={!showConfirmPw}
                  value={confirmPw} onChangeText={t => { setConfirmPw(t); setError('') }}
                  returnKeyType="done" />
                <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showConfirmPw ? 'eye-off' : 'eye'} size={16} color="#AAAAAA" />
                </TouchableOpacity>
              </View>

              {confirmPw.length > 0 && password !== confirmPw && (
                <View style={fInlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={fInlineErr.txt}>Passwords do not match</Text>
                </View>
              )}
              {!!error && (
                <View style={fInlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={fInlineErr.txt}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[li2.btn, (!isValid || loading) && li2.btnOff]}
                onPress={async () => {
                  if (!isValid) return
                  setLoading(true)
                  try {
                    // Use verifiedOtp (saved before goTo cleared the otp array)
                    await resetPassword(phone, password, otpPinId, verifiedOtp || otp.join(''))
                    setConfirmPw('')
                    setError('')
                    goTo('password_success')
                  } catch (e: any) {
                    const msg: string = e?.message || ''
                    if (msg.includes('Network') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
                      setError('Connection failed. Check your internet and try again.')
                    } else {
                      setError(msg || 'Failed to reset password. Please try again.')
                    }
                  }
                  finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[li2.btnTxt, (!isValid || loading) && li2.btnTxtOff]}>Update Password</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
        </KeyboardAvoidingView>
      </View>
      </TouchableWithoutFeedback>
    )
  }

  // ── PASSWORD SUCCESS ──────────────────────────────────────────────────────
  if (step === 'password_success') {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8] }}>

          {/* Success icon */}
          <View style={suc.iconWrap}>
            <View style={suc.iconOuter}>
              <View style={suc.iconInner}>
                <Feather name="check" size={40} color={colors.primaryText} />
              </View>
            </View>
          </View>

          <Text style={suc.title}>Password Updated!</Text>
          <Text style={suc.sub}>
            Your password has been reset successfully.{'\n'}You can now log in with your new password.
          </Text>

          <TouchableOpacity
            style={[s.primaryBtn, { width: '100%', marginTop: spacing[8] }]}
            onPress={() => {
              setPassword('')
              setLoginInput(phone || '')
              goTo('login')
            }}
            activeOpacity={0.85}>
            <Text style={s.primaryBtnTxt}>Log In Now</Text>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    )
  }

  return null
}

// ── Inline error styles ───────────────────────────────────────────────────────
import { ms as msF } from '../../../util/responsive'
import { typography as typo } from '../../../theme'

const fInlineErr = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F1',
    borderRadius: msF(10),
    borderWidth: 1,
    borderColor: '#FFD6D6',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[2],
    marginBottom: spacing[2],
  },
  txt: {
    fontSize: typo.size.sm,
    color: '#CC0000',
    flex: 1,
    lineHeight: msF(18),
  },
})
