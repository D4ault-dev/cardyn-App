import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
  Keyboard, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing } from '../../../theme'
import { keyboardBehavior, ms } from '../../../util/responsive'
import { prefixWithPlus, sanitizePhone, isValidPhone, getExpectedDigits, getFullPhone, maskPhone } from '../phoneUtils'
import { SocialButton, SocialDivider, StepHeader, HelpModal, CountryPickerModal } from '../AuthComponents'
import { li2, s } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'
import storage from '../../../util/storage'

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

  // ── SIGNUP — name + phone + terms ─────────────────────────────────────────
  if (step === 'signup') {
    const normalizedPhone = sanitizeLocalPhone(phone)
    const fullPhone = getFullPhoneLocal(phone)
    const canNext = name.trim().length > 0 && isValidPhoneLocal(phone)

    async function handleSignupNext() {
      if (!canNext) { setError(`Enter your full name and ${getPhoneValidationMessage().toLowerCase()}`); return }
      setLoading(true)
      setError('')
      try {
        const clientModule = await import('../../../api/client')
        const apiClient = clientModule.default
        try {
          const res = await apiClient.get('/tuka/user/checkPhone', { params: { phone: fullPhone } })
          if (res.data?.msg === 'exists') {
            setPhone(normalizedPhone)
            setLoginMethod('phone')
            Alert.alert(
              'Account Found',
              `${formatPhoneForDisplay(normalizedPhone)} is already registered. Taking you to login.`,
              [{ text: 'OK', onPress: () => goTo('login_password') }]
            )
            return
          }
          const sent = await sendOtpToPhone(fullPhone)
          if (sent) {
            setPhone(normalizedPhone)
            goTo('signup_otp')
          }
        } catch (checkErr: any) {
          const sent = await sendOtpToPhone(fullPhone)
          if (sent) {
            setPhone(normalizedPhone)
            goTo('signup_otp')
          }
        }
      } finally { setLoading(false) }
    }

    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <CountryPickerModal
          visible={countryPickerOpen}
          countries={countries}
          selected={selectedCountry}
          onSelect={c => { setSelectedCountry(c); setCountryPickerOpen(false) }}
          onClose={() => setCountryPickerOpen(false)}
          loading={countriesLoading}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
          <View style={li2.root}>
            {/* Blue background */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

            {/* Nav */}
            <SafeAreaView edges={['top']} style={li2.safeTop}>
              <View style={li2.navRow}>
                <TouchableOpacity onPress={() => { reset(); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Feather name="chevron-left" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
                  <Text style={li2.helpTxt}>Help</Text>
                </TouchableOpacity>
              </View>
              {/* Progress bar */}
              <View style={[s.progressTrack, { marginHorizontal: spacing[5] }]}>
                <View style={[s.progressFill, { width: '25%' }]} />
              </View>
            </SafeAreaView>

            {/* Hero */}
            <View style={li2.heroWrap} pointerEvents="none">
              <Text style={li2.heroTitle}>Create Your{'\n'}Account</Text>
            </View>

            <View style={{ flex: 1 }} />

            {/* White fill extends below card to cover nav bar area */}
            <View style={{ backgroundColor: '#FFFFFF', position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(insetsBottom, 16) + 100 }} />
            {/* White card */}
            <Animated.View style={[li2.card, { opacity: liCardOpacity, paddingBottom: Math.max(insetsBottom, 16) + 32 }]}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
                bounces={false}>

                <Text style={s.fieldLabel}>Full Name</Text>
                <View style={s.inputCard}>
                  <Feather name="user" size={18} color={colors.subtle} />
                  <TextInput style={s.inputCardTxt} placeholder="Your full name"
                    placeholderTextColor={colors.subtle} autoCapitalize="words"
                    value={name} onChangeText={t => { setName(t); setError('') }} returnKeyType="next" />
                </View>

                <Text style={s.fieldLabel}>Phone Number</Text>
                <View style={s.inputCard}>
                  <TouchableOpacity style={s.flagSection} onPress={openCountryPicker} activeOpacity={0.7}>
                    <Text style={s.prefix}>{prefixWithPlus(selectedCountry.phonePrefix)}</Text>
                    <Feather name="chevron-down" size={14} color={colors.muted} />
                  </TouchableOpacity>
                  <View style={s.vDivider} />
                  <TextInput style={s.inputCardTxt} placeholder="Phone Number"
                    placeholderTextColor={colors.subtle} keyboardType="phone-pad"
                    maxLength={getExpectedLocalDigits() ?? 14}
                    value={phone} onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }} />
                </View>

                {!!error && <Text style={s.errTxt}>{error}</Text>}

                <TouchableOpacity
                  style={[li2.btn, (!canNext || loading) && li2.btnOff, { marginTop: spacing[3] }]}
                  onPress={handleSignupNext}
                  disabled={!canNext || loading}
                  activeOpacity={0.85}>
                  <Text style={li2.btnTxt}>{loading ? <ActivityIndicator size="small" color="#fff" /> : 'Next'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.switchRow} onPress={() => { reset(); goTo('login') }}>
                  <Text style={s.switchTxt}>Already have an account? <Text style={s.switchLink}>Log In</Text></Text>
                </TouchableOpacity>

                <SocialDivider />
                <View style={s.socialRowWrap}>
                  <SocialButton provider="google" loading={socialLoading === 'google'} onPress={handleGoogleSignIn} />
                  {Platform.OS === 'ios' && (
                    <SocialButton provider="apple" loading={socialLoading === 'apple'} onPress={handleAppleSignIn} />
                  )}
                </View>
                <View style={{ paddingHorizontal: spacing[2], paddingBottom: spacing[4] }}>
                  <Text style={s.consentTxt}>
                    By continuing, you agree to our <Text style={s.termsLink}>Terms & Conditions</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
                  </Text>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </>
    )
  }

  // ── SIGNUP OTP ────────────────────────────────────────────────────────────
  if (step === 'signup_otp') {
    const otpFilled = otpValue.length === 6
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
            <StepHeader onBack={() => goTo('signup')} progress={0.5}
              onHelp={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }} />
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Verify Your Number</Text>
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
                    <Text style={s.resendCountTxt}>Resend code in </Text>
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
                  if (ok) goTo('signup_password')
                }}
                disabled={!otpFilled || loading} activeOpacity={0.85}>
                <Text style={[s.primaryBtnTxt, !otpFilled && s.primaryBtnTxtOff]}>
                  {loading ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </>
    )
  }

  // ── SIGNUP PASSWORD ───────────────────────────────────────────────────────
  if (step === 'signup_password') {
    const isValid = password.length >= 6 && password === confirmPw
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
            <StepHeader onBack={() => goTo('signup_otp')} progress={0.85}
              onHelp={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing[6], paddingTop: spacing[5], paddingBottom: spacing[10] }}>

              <Text style={s.stepTitle}>Set Your Password</Text>
              <Text style={s.stepSub}>Choose a strong password to secure your account.</Text>

              <Text style={s.fieldLabel}>Password</Text>
              <View style={s.inputCard}>
                <Feather name="lock" size={18} color={colors.subtle} />
                <TextInput style={s.inputCardTxt} placeholder="At least 6 characters"
                  placeholderTextColor={colors.subtle} secureTextEntry={!showPw}
                  value={password} onChangeText={t => { setPassword(t); setError('') }} returnKeyType="next" />
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
                style={[s.primaryBtn, (!isValid || loading) && s.primaryBtnOff, { marginTop: spacing[5] }]}
                onPress={async () => {
                  if (!isValid) return
                  setLoading(true)
                  try {
                    const fullPhone = getFullPhoneLocal(phone)
                    await signup({
                      name: name.trim(),
                      username: fullPhone,
                      phone: fullPhone,
                      country: selectedCountry.name,
                      password,
                    })
                    // Save phone + country for next login
                    storage.setItem('@tuka_last_phone', sanitizeLocalPhone(phone)).catch(() => {})
                    storage.setItem('@tuka_last_country', JSON.stringify(selectedCountry)).catch(() => {})
                    if (biometricAvailable) {
                      setPendingUsername(fullPhone)
                      goTo('biometric_setup')
                    }
                    // else: AuthContext user state updated → App.tsx navigator switches to authenticated stack
                  } catch (e: any) {
                    const msg: string = e.message || ''
                    if (msg.includes('already registered') || msg.includes('已存在') || msg.includes('exists')) {
                      Alert.alert(
                        'Account Already Exists',
                        `${formatPhoneForDisplay(phone)} is already registered. Please log in instead.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log In', style: 'default', onPress: () => { setLoginMethod('phone'); setPassword(''); goTo('login_password') } },
                        ]
                      )
                    } else {
                      setError(msg || 'Registration failed')
                    }
                  }
                  finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                <Text style={[s.primaryBtnTxt, (!isValid || loading) && s.primaryBtnTxtOff]}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </>
    )
  }

  return null
}
