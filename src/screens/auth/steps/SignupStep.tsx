import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  Keyboard, ActivityIndicator, Modal, StatusBar, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from '../../../theme'
import { ms, RF, keyboardBehavior } from '../../../util/responsive'
import { prefixWithPlus, sanitizePhone, isValidPhone, getExpectedDigits, getFullPhone, maskPhone } from '../phoneUtils'
import { StepHeader, HelpModal, CountryPickerModal } from '../AuthComponents'
import { s } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'
import storage from '../../../util/storage'

// ── Shared flat-design styles (matches landing + login screens) ───────────────
const flat = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F5F6FA' },
  scroll:     { flexGrow: 1, paddingHorizontal: spacing[6] },
  backBtn:    { alignSelf: 'flex-start', marginBottom: ms(20) },
  backCircle: { width: ms(36), height: ms(36), borderRadius: ms(18), backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
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
  errLink:    { fontSize: RF(13), fontWeight: '700', color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: ms(12), paddingVertical: ms(17), alignItems: 'center', justifyContent: 'center', marginBottom: ms(16) },
  primaryBtnOff: { backgroundColor: '#D0D5DD' },
  primaryBtnTxt: { fontSize: RF(17), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  primaryBtnTxtOff: { color: '#8A94A6' },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: ms(4) },
  footerTxt:  { fontSize: RF(15), color: '#8A94A6' },
  footerLink: { fontSize: RF(15), fontWeight: '700', color: colors.primary },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: ms(16) },
  dividerLine:{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D0D5DD' },
  dividerTxt: { fontSize: RF(13), color: '#8A94A6', marginHorizontal: ms(12) },
  hintRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: ms(12) },
  hintChip:   { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: ms(20), paddingHorizontal: spacing[2], paddingVertical: 3 },
  hintTxt:    { fontSize: RF(11), fontWeight: '500' },
  // Nav row (used in OTP + password steps)
  navRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingTop: ms(16), paddingBottom: ms(12) },
  helpTxt:    { fontSize: RF(15), fontWeight: '600', color: colors.primary },
})

export interface SignupStepProps {
  step: 'signup' | 'signup_otp' | 'signup_password'
  // State
  name: string
  phone: string
  otp: string[]
  otpFocused: number
  password: string
  confirmPw: string
  showPw: boolean
  showConfirmPw: boolean
  loading: boolean
  error: string
  socialLoading: 'google' | 'apple' | null
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
  // Insets
  insetsBottom: number
  // Refs
  otpRefs: React.MutableRefObject<(TextInput | null)[]>
  // Setters
  setName: (v: string) => void
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
  setLoginMethod: (v: 'phone' | 'email') => void
  // Handlers
  sendOtpToPhone: (phone: string) => Promise<boolean>
  otpFullPhone?: string
  verifyOtpCode: (pin: string) => Promise<boolean>
  handleGoogleSignIn: () => Promise<void>
  handleAppleSignIn: () => Promise<void>
  signup: (params: { name: string; username: string; phone: string; country: string; password: string }) => Promise<void>
  goTo: (s: Step) => void
  reset: () => void
  biometricAvailable: boolean
  setPendingUsername: (v: string) => void
}

export function SignupStep(props: SignupStepProps) {
  const {
    step, name, phone, otp, otpFocused, password, confirmPw, showPw, showConfirmPw,
    loading, error, socialLoading, countdown, canResend, otpTestCode, showHelp,
    selectedCountry, countries, countriesLoading, countryPickerOpen,
    liCardOpacity, fadeAnim, insetsBottom, otpRefs,
    setName, setPhone, setOtp, setOtpFocused, setPassword, setConfirmPw,
    setShowPw, setShowConfirmPw, setError, setLoading, setCountryPickerOpen,
    setSelectedCountry, setShowHelp, setCanResend, setCountdown, setLoginMethod,
    sendOtpToPhone, verifyOtpCode, handleGoogleSignIn, handleAppleSignIn,
    signup, goTo, reset, biometricAvailable, setPendingUsername,
  } = props
  const otpFullPhone = props.otpFullPhone

  // Use safe area insets for correct top padding on all devices (notched iPhones, Android nav bars)
  const insets = useSafeAreaInsets()
  // Top inset: use safe area on iOS (handles notch correctly), status bar height on Android
  const topInset = Platform.OS === 'ios' ? insets.top : getStatusBarHeight()

  const sanitizeLocalPhone = (v: string) => sanitizePhone(v, selectedCountry)
  const getExpectedLocalDigits = () => getExpectedDigits(selectedCountry)
  const getPhoneValidationMessage = () => {
    const n = getExpectedDigits(selectedCountry)
    return n ? `Enter a valid ${n}-digit phone number` : 'Enter a valid phone number'
  }
  const isValidPhoneLocal = (v: string) => isValidPhone(v, selectedCountry)
  const getFullPhoneLocal = (v: string) => getFullPhone(v, selectedCountry)
  const formatPhoneForDisplay = (v: string) =>
    `${prefixWithPlus(selectedCountry.phonePrefix)}${sanitizePhone(v, selectedCountry)}`

  function openCountryPicker() {
    Keyboard.dismiss()
    setCountryPickerOpen(true)
  }

  const otpValue = otp.join('')

  function handleOtpKey(e: any, i: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  // Terms modal state
  const [termsVisible, setTermsVisible] = useState(false)
  // Confirm password touched state — only show mismatch after user leaves the field
  const [confirmTouched, setConfirmTouched] = useState(false)

  // ── SIGNUP — name + phone + terms ─────────────────────────────────────────
  if (step === 'signup') {
    const normalizedPhone = sanitizeLocalPhone(phone)
    const fullPhone = getFullPhoneLocal(phone)
    const canNext = name.trim().length > 0 && isValidPhoneLocal(phone)

    async function handleSignupNext() {
      if (!canNext) { setError(`Enter your full name and ${getPhoneValidationMessage().toLowerCase()}`); return }
      setLoading(true); setError('')
      try {
        const clientModule = await import('../../../api/client')
        const apiClient = clientModule.default
        try {
          const res = await apiClient.get('/tuka/user/checkPhone', { params: { phone: fullPhone } })
          if (res.data?.msg === 'exists') { setPhone(normalizedPhone); setLoginMethod('phone'); setError('phone_exists'); return }
          const sent = await sendOtpToPhone(fullPhone)
          if (sent) { setPhone(normalizedPhone); goTo('signup_otp') }
        } catch {
          const sent = await sendOtpToPhone(fullPhone)
          if (sent) { setPhone(normalizedPhone); goTo('signup_otp') }
        }
      } finally { setLoading(false) }
    }

    function handleNextPress() {
      if (!canNext || loading) return
      Keyboard.dismiss()
      storage.getItem('@cardyn_terms_agreed').then(agreed => {
        if (agreed === 'true') { handleSignupNext() } else { setTermsVisible(true) }
      }).catch(() => setTermsVisible(true))
    }

    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <CountryPickerModal
          visible={countryPickerOpen} countries={countries} selected={selectedCountry}
          onSelect={c => { setSelectedCountry(c); setCountryPickerOpen(false) }}
          onClose={() => setCountryPickerOpen(false)} loading={countriesLoading}
        />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView style={[{ flex: 1 }, { paddingTop: topInset }]} behavior={keyboardBehavior} keyboardVerticalOffset={0}>
            <View style={flat.root}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={[flat.scroll, { paddingBottom: Math.max(insetsBottom, 48) + ms(24) }]}
              >
                {/* Back */}
                <TouchableOpacity style={flat.backBtn} onPress={() => { reset(); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <View style={flat.backCircle}>
                    <Feather name="chevron-left" size={18} color="#1A1A2E" />
                  </View>
                </TouchableOpacity>

                {/* Icon */}
                <View style={flat.iconWrap}>
                  <View style={flat.iconBg}>
                    <Feather name="user-plus" size={ms(28)} color="#FFFFFF" />
                  </View>
                </View>

                {/* Title */}
                <Text style={flat.title}>Create Account</Text>
                <Text style={flat.subtitle}>Join Cardyn — enter your details to get started</Text>

                {/* Full Name */}
                <View style={flat.fieldWrap}>
                  <Text style={flat.fieldLabel}>Full Name<Text style={flat.required}>*</Text></Text>
                  <View style={flat.inputBox}>
                    <TextInput style={flat.input} placeholder="Your full name"
                      placeholderTextColor="#BBBBBB" autoCapitalize="words"
                      value={name} onChangeText={t => { setName(t); setError('') }}
                      returnKeyType="next" keyboardAppearance="light" />
                  </View>
                </View>

                {/* Phone Number */}
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
                      value={phone} onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }}
                      keyboardAppearance="light" />
                  </View>
                </View>

                {/* Errors */}
                {error === 'phone_exists' ? (
                  <View style={flat.errRow}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={flat.errTxt}>Number already registered. </Text>
                    <TouchableOpacity onPress={() => { reset(); goTo('login') }} activeOpacity={0.7}>
                      <Text style={flat.errLink}>Sign in →</Text>
                    </TouchableOpacity>
                  </View>
                ) : !!error ? (
                  <View style={flat.errRow}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={flat.errTxt}>{error}</Text>
                  </View>
                ) : null}

                {/* Next button */}
                <TouchableOpacity
                  style={[flat.primaryBtn, { marginTop: ms(8) }, (!canNext || loading) && flat.primaryBtnOff]}
                  onPress={handleNextPress} disabled={!canNext || loading} activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[flat.primaryBtnTxt, (!canNext || loading) && flat.primaryBtnTxtOff]}>Continue</Text>
                  }
                </TouchableOpacity>

                {/* Social divider */}
                <View style={sgSocial.dividerRow}>
                  <View style={sgSocial.dividerLine} />
                  <Text style={sgSocial.dividerTxt}>or sign up with</Text>
                  <View style={sgSocial.dividerLine} />
                </View>

                {/* Google */}
                <TouchableOpacity
                  style={sgSocial.btn}
                  onPress={handleGoogleSignIn}
                  disabled={socialLoading !== null}
                  activeOpacity={0.8}
                >
                  {socialLoading === 'google'
                    ? <ActivityIndicator size="small" color="#1A1A2E" />
                    : <>
                        <Image source={require('../../../../assets/google-logo.png')} style={sgSocial.icon} resizeMode="contain" />
                        <Text style={sgSocial.txt}>Continue with Google</Text>
                      </>
                  }
                </TouchableOpacity>

                {/* Apple — iOS only */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={sgSocial.btn}
                    onPress={handleAppleSignIn}
                    disabled={socialLoading !== null}
                    activeOpacity={0.8}
                  >
                    {socialLoading === 'apple'
                      ? <ActivityIndicator size="small" color="#1A1A2E" />
                      : <>
                          <Image source={require('../../../../assets/apple-logo.png')} style={sgSocial.icon} resizeMode="contain" />
                          <Text style={sgSocial.txt}>Continue with Apple</Text>
                        </>
                    }
                  </TouchableOpacity>
                )}

                {/* Sign in link */}
                <View style={[flat.footer, { marginTop: ms(8) }]}>
                  <Text style={flat.footerTxt}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => { reset(); goTo('login') }} activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={flat.footerLink}>Sign in</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>

        {/* Terms Modal */}
        <Modal visible={termsVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTermsVisible(false)}>
          <View style={tm.overlay}>
            <View style={tm.card}>
              <Text style={tm.title}>Service Agreement &{'\n'}Privacy Protection</Text>
              <Text style={tm.body}>
                Please read and agree to our <Text style={tm.link}>Terms & Conditions</Text> and <Text style={tm.link}>Privacy Policy</Text> before creating your account.
              </Text>
              <View style={tm.btnRow}>
                <TouchableOpacity style={tm.disagreeBtn} onPress={() => setTermsVisible(false)} activeOpacity={0.8}>
                  <Text style={tm.disagreeTxt}>Disagree</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tm.agreeBtn} onPress={() => {
                  storage.setItem('@cardyn_terms_agreed', 'true').catch(() => {})
                  setTermsVisible(false)
                  handleSignupNext()
                }} activeOpacity={0.85}>
                  <Text style={tm.agreeTxt}>Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    )
  }
  if (step === 'signup_otp') {
    const otpFilled = otpValue.length === 6
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <KeyboardAvoidingView
          style={[{ flex: 1 }, { paddingTop: topInset }]}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={0}
        >
          <View style={flat.root}>

            {/* Simple nav row — no progress bar */}
            <View style={flat.navRow}>
              <TouchableOpacity
                style={flat.backCircle}
                onPress={() => goTo('signup')}
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
              {/* Icon */}
              <View style={flat.iconWrap}>
                <View style={flat.iconBg}>
                  <Feather name="message-square" size={ms(28)} color="#FFFFFF" />
                </View>
              </View>

              <Text style={flat.title}>Verify Your Number</Text>
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

              {/* Resend */}
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
                    Resend code in{' '}
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
                onPress={async () => { const ok = await verifyOtpCode(otpValue); if (ok) goTo('signup_password') }}
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
      </>
    )
  }

  // ── SIGNUP PASSWORD ───────────────────────────────────────────────────────
  if (step === 'signup_password') {
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasLength = password.length >= 8
    const isValid = hasLength && hasUpper && hasLower && hasNumber && password === confirmPw
    const showHints = password.length > 0

    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <KeyboardAvoidingView
          style={[{ flex: 1 }, { paddingTop: topInset }]}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={0}
        >
          <View style={flat.root}>
            <View style={flat.navRow}>
              <TouchableOpacity style={flat.backCircle} onPress={() => goTo('signup_otp')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Feather name="chevron-left" size={18} color="#1A1A2E" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={flat.helpTxt}>Help</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={[flat.scroll, { paddingTop: ms(8), paddingBottom: ms(80) }]}>

              {/* Icon */}
              <View style={flat.iconWrap}>
                <View style={flat.iconBg}>
                  <Feather name="lock" size={ms(28)} color="#FFFFFF" />
                </View>
              </View>

              <Text style={flat.title}>Set Your Password</Text>
              <Text style={flat.subtitle}>Choose a strong password to secure your Cardyn account</Text>

              {/* Password */}
              <View style={flat.fieldWrap}>
                <Text style={flat.fieldLabel}>Password<Text style={flat.required}>*</Text></Text>
                <View style={flat.inputBox}>
                  <TextInput style={flat.input} placeholder="At least 8 characters"
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

              {error === 'phone_exists_pw' ? (
                <View style={flat.errRow}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={flat.errTxt}>Number already registered. </Text>
                  <TouchableOpacity onPress={() => { setLoginMethod('phone'); setPassword(''); goTo('login') }} activeOpacity={0.7}>
                    <Text style={flat.errLink}>Sign in →</Text>
                  </TouchableOpacity>
                </View>
              ) : !!error ? (
                <View style={flat.errRow}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={flat.errTxt}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[flat.primaryBtn, { marginTop: ms(8) }, (!isValid || loading) && flat.primaryBtnOff]}
                onPress={async () => {
                  if (!isValid) return
                  setLoading(true)
                  try {
                    const fullPhone = getFullPhoneLocal(phone)
                    await signup({ name: name.trim(), username: fullPhone, phone: fullPhone, country: selectedCountry.name, password })
                    storage.setItem('@tuka_last_phone', sanitizeLocalPhone(phone)).catch(() => {})
                    storage.setItem('@tuka_last_country', JSON.stringify(selectedCountry)).catch(() => {})
                    if (biometricAvailable) { setPendingUsername(fullPhone); goTo('biometric_setup') }
                  } catch (e: any) {
                    const msg: string = e.message || ''
                    if (msg.includes('already registered') || msg.includes('exists')) { setError('phone_exists_pw') }
                    else if (msg.includes('Network') || msg.includes('timeout')) { setError('Check your internet connection and try again.') }
                    else { setError(msg || 'Registration failed. Please try again.') }
                  } finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[flat.primaryBtnTxt, (!isValid || loading) && flat.primaryBtnTxtOff]}>Create Account</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </>
    )
  }

  return null
}

// ── Social signup styles ──────────────────────────────────────────────────────
const sgSocial = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: ms(16) },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D0D5DD' },
  dividerTxt:  { fontSize: RF(13), color: '#8A94A6', marginHorizontal: ms(12) },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: ms(12),
    paddingVertical: ms(14), marginBottom: ms(10),
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0',
    gap: ms(10),
  },
  icon: { width: ms(20), height: ms(20) },
  txt:  { fontSize: RF(16), fontWeight: '700', color: '#1A1A2E' },
})

// ── Terms modal styles ────────────────────────────────────────────────────────
const tm = StyleSheet.create({  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  card:    { backgroundColor: '#FFFFFF', borderRadius: ms(20), padding: spacing[6], width: '100%' },
  title:   { fontSize: RF(18), fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: spacing[4], lineHeight: ms(26) },
  body:    { fontSize: RF(14), color: '#555', lineHeight: ms(22), marginBottom: spacing[6] },
  link:    { color: colors.primary, fontWeight: '600' },
  btnRow:  { flexDirection: 'row', gap: spacing[3] },
  disagreeBtn: { flex: 1, paddingVertical: ms(14), borderRadius: ms(50), borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  disagreeTxt: { fontSize: RF(15), fontWeight: '600', color: '#555' },
  agreeBtn:    { flex: 2, paddingVertical: ms(14), borderRadius: ms(50), backgroundColor: colors.primary, alignItems: 'center' },
  agreeTxt:    { fontSize: RF(15), fontWeight: '700', color: '#fff' },
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
