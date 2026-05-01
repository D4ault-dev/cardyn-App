import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, ScrollView,
  Keyboard, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing } from '../../../theme'
import { keyboardBehavior, ms } from '../../../util/responsive'
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
  verifyOtpCode: (pin: string) => Promise<boolean>
  resetPassword: (phone: string, password: string) => Promise<void>
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
              <Text style={li2.heroTitle}>Retrieve{'\n'}Account</Text>
            </View>

            <View style={{ flex: 1 }} />

            <View style={{ backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insetsBottom, 16) + 100 }} />
            <Animated.View style={[li2.card, { opacity: liCardOpacity, paddingBottom: Math.max(insetsBottom, 16) + 32 }]}>
              <Text style={[s.pwSub, { textAlign: 'left', marginBottom: spacing[4] }]}>
                Enter your registered phone number to receive a verification code.
              </Text>

              <View style={s.inputCard}>
                <TouchableOpacity style={s.flagSection} onPress={openCountryPicker} activeOpacity={0.7}>
                  <Text style={s.prefix}>{prefixWithPlus(selectedCountry.phonePrefix)}</Text>
                  <Feather name="chevron-down" size={14} color={colors.muted} />
                </TouchableOpacity>
                <View style={s.vDivider} />
                <TextInput style={s.inputCardTxt} placeholder="Phone number"
                  placeholderTextColor={colors.subtle} keyboardType="phone-pad"
                  maxLength={getExpectedLocalDigits() ?? 14}
                  value={phone} autoFocus
                  onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }} />
              </View>

              {!!error && (
                <View style={li2.errRow}>
                  <Feather name="alert-circle" size={13} color="#FF4D4F" />
                  <Text style={li2.errTxt}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[li2.btn, (!canNext || loading) && li2.btnOff, { marginTop: spacing[4], marginBottom: spacing[8] }]}
                onPress={async () => {
                  if (!canNext) { setError(getPhoneValidationMessage()); return }
                  setLoading(true); setError('')
                  try {
                    const { default: api } = await import('../../../api/client')
                    const res = await api.get('/tuka/user/checkPhone', { params: { phone: fullPhone } })
                    if (res.data?.msg === 'available') { setError('No account found with this phone number'); return }
                    const sent = await sendOtpToPhone(fullPhone)
                    if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                  } catch {
                    const sent = await sendOtpToPhone(fullPhone)
                    if (sent) { setPhone(normalizedPhone); goTo('forgot_otp') }
                  } finally { setLoading(false) }
                }}
                activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={li2.btnTxt}>Send Code</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
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
                      await sendOtpToPhone(phone)
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

  // ── FORGOT NEW PASSWORD ───────────────────────────────────────────────────
  if (step === 'forgot_newpassword') {
    const isValid = password.length >= 6 && password === confirmPw
    return (
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

          <View style={{ flex: 1 }} />

          <View style={{ backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insetsBottom, 16) + 100 }} />
          <Animated.View style={[li2.card, { opacity: liCardOpacity, paddingBottom: Math.max(insetsBottom, 16) + 32 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

              <Text style={s.fieldLabel}>New Password</Text>
              <View style={s.inputCard}>
                <Feather name="lock" size={18} color={colors.subtle} />
                <TextInput style={s.inputCardTxt} placeholder="At least 6 characters"
                  placeholderTextColor={colors.subtle} secureTextEntry={!showPw}
                  value={password} onChangeText={t => { setPassword(t); setError('') }}
                  autoFocus returnKeyType="next" />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.subtle} />
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>Confirm Password</Text>
              <View style={[s.inputCard, confirmPw.length > 0 && password !== confirmPw && { borderColor: colors.error }]}>
                <Feather name="lock" size={18} color={colors.subtle} />
                <TextInput style={s.inputCardTxt} placeholder="Re-enter password"
                  placeholderTextColor={colors.subtle} secureTextEntry={!showConfirmPw}
                  value={confirmPw} onChangeText={t => { setConfirmPw(t); setError('') }}
                  returnKeyType="done" />
                <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showConfirmPw ? 'eye-off' : 'eye'} size={18} color={colors.subtle} />
                </TouchableOpacity>
              </View>

              {confirmPw.length > 0 && password !== confirmPw && (
                <Text style={s.errTxt}>Passwords do not match</Text>
              )}
              {!!error && <Text style={s.errTxt}>{error}</Text>}

              <TouchableOpacity
                style={[li2.btn, (!isValid || loading) && li2.btnOff, { marginTop: spacing[5], marginBottom: spacing[8] }]}
                onPress={async () => {
                  if (!isValid) return
                  setLoading(true)
                  try {
                    await resetPassword(phone, password)
                    setConfirmPw('')
                    setError('')
                    goTo('password_success')
                  } catch (e: any) { setError(e.message || 'Failed to reset password') }
                  finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={li2.btnTxt}>Update Password</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
