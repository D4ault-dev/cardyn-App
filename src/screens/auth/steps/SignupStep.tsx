import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView,
  Keyboard, ActivityIndicator, Modal,
} from 'react-native'
import { getStatusBarHeight, STATUS_BAR_HEIGHT } from '../../../util/statusBar'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../../../theme'
import { ms, SCREEN_H, RF } from '../../../util/responsive'
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

  // Hero title height — collapses to 0 when keyboard opens (same pattern as LoginStep)
  const heroHeight = useRef(new Animated.Value(SCREEN_H * 0.14)).current
  const [keyboardUp, setKeyboardUp] = useState(false)
  useEffect(() => {
    if (step !== 'signup') return
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardUp(true)
        Animated.spring(heroHeight, { toValue: 0, useNativeDriver: false, tension: 60, friction: 14 }).start()
      }
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardUp(false)
        Animated.spring(heroHeight, { toValue: SCREEN_H * 0.14, useNativeDriver: false, tension: 55, friction: 14 }).start()
      }
    )
    return () => { show.remove(); hide.remove() }
  }, [step])

  // Terms modal state — shown only if user hasn't agreed before
  const [termsVisible, setTermsVisible] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)

  // Check if user already agreed to terms on this device
  useEffect(() => {
    storage.getItem('@cardyn_terms_agreed').then(val => {
      setTermsChecked(true)
      // If already agreed, skip the modal entirely
    }).catch(() => setTermsChecked(true))
  }, [])

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
            setError('phone_exists')
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

    function handleNextPress() {
      if (!canNext || loading) return
      Keyboard.dismiss()
      // Check if user already agreed to terms — if so, skip modal
      storage.getItem('@cardyn_terms_agreed').then(agreed => {
        if (agreed === 'true') {
          handleSignupNext()
        } else {
          setTermsVisible(true)
        }
      }).catch(() => setTermsVisible(true))
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={STATUS_BAR_HEIGHT}
          >
          <View style={li2.root}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

            {/* Nav */}
            <View style={[li2.safeTop, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
              <View style={li2.navRow}>
                <TouchableOpacity onPress={() => { reset(); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Feather name="chevron-left" size={26} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
                  <Text style={li2.helpTxt}>Help</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.progressTrack, { marginHorizontal: spacing[5] }]}>
                <View style={[s.progressFill, { width: '25%' }]} />
              </View>
            </View>

            {/* Hero title — collapses when keyboard opens */}
            <Animated.View
              style={{ height: heroHeight, overflow: 'hidden', justifyContent: 'flex-end', paddingHorizontal: spacing[6], paddingBottom: spacing[3] }}
              pointerEvents="none"
            >
              <Text style={li2.heroTitle}>Create Your{'\n'}Account</Text>
            </Animated.View>

            {/* White fill behind keyboard — prevents navy showing below card on Android */}
            {Platform.OS === 'android' && (
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: '#FFFFFF' }} />
            )}

            {/* White card */}
            <Animated.View style={[li2.card, { opacity: liCardOpacity, flex: 1 }]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 16) + spacing[4] }}
              >

                {/* Card header */}
                <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[1] }}>
                  <Text style={{ fontSize: ms(18), fontWeight: '700', color: colors.dark }}>Your details</Text>
                  <Text style={{ fontSize: ms(13), color: colors.muted, marginTop: 3 }}>Enter your name and phone number to get started.</Text>
                </View>

                {/* Full Name */}
                <View style={[li2.inputRow, { marginTop: spacing[3] }]}>
                  <Feather name="user" size={16} color="#AAAAAA" style={{ marginRight: spacing[1] }} />
                  <View style={li2.inputDivider} />
                  <TextInput style={li2.input} placeholder="Full Name"
                    placeholderTextColor="#BBBBBB" autoCapitalize="words"
                    value={name} onChangeText={t => { setName(t); setError('') }}
                    returnKeyType="next" keyboardAppearance="light" />
                </View>

                {/* Phone Number */}
                <View style={li2.inputRow}>
                  <TouchableOpacity style={s.flagSection} onPress={openCountryPicker} activeOpacity={0.7}>
                    <Text style={[li2.inputLabel, { minWidth: 0, marginRight: 0 }]}>{prefixWithPlus(selectedCountry.phonePrefix)}</Text>
                    <Feather name="chevron-down" size={13} color={colors.muted} />
                  </TouchableOpacity>
                  <View style={li2.inputDivider} />
                  <TextInput style={li2.input} placeholder="Phone Number"
                    placeholderTextColor="#BBBBBB" keyboardType="phone-pad"
                    maxLength={getExpectedLocalDigits() ?? 14}
                    value={phone} onChangeText={t => { setPhone(sanitizeLocalPhone(t)); setError('') }}
                    keyboardAppearance="light" />
                </View>

                {error === 'phone_exists' ? (
                  <View style={inlineErr.box}>
                    <Feather name="alert-circle" size={14} color="#FF4D4F" />
                    <Text style={inlineErr.txt}>This number is already registered. </Text>
                    <TouchableOpacity onPress={() => { reset(); goTo('login') }} activeOpacity={0.7}>
                      <Text style={inlineErr.link}>Log in →</Text>
                    </TouchableOpacity>
                  </View>
                ) : !!error ? (
                  <View style={inlineErr.box}>
                    <Feather name="alert-circle" size={14} color="#FF4D4F" />
                    <Text style={inlineErr.txt}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[li2.btn, (!canNext || loading) && li2.btnOff]}
                  onPress={handleNextPress}
                  disabled={!canNext || loading}
                  activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[li2.btnTxt, (!canNext || loading) && li2.btnTxtOff]}>Next</Text>
                  }
                </TouchableOpacity>

                <View style={s.switchRow}>
                  <Text style={s.switchTxt}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => { reset(); goTo('login') }} activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={s.switchLink}>Log In</Text>
                  </TouchableOpacity>
                </View>

                {/* Social section — hidden when keyboard is up to save space */}
                {!keyboardUp && (
                  <>
                    <SocialDivider />
                    <View style={[s.socialRowWrap, { marginHorizontal: spacing[2] }]}>
                      <SocialButton provider="google" loading={socialLoading === 'google'} onPress={handleGoogleSignIn} />
                      {Platform.OS === 'ios' && (
                        <SocialButton provider="apple" loading={socialLoading === 'apple'} onPress={handleAppleSignIn} />
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </View>
          </KeyboardAvoidingView>
        </View>
        </TouchableWithoutFeedback>

        {/* ── Terms & Privacy Modal ── */}
        <Modal
          visible={termsVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setTermsVisible(false)}
        >
          <View style={sgTm.overlay}>
            <View style={sgTm.card}>
              <Text style={sgTm.title}>Service Agreement &{'\n'}Privacy Protection</Text>
              <Text style={sgTm.body}>
                To best protect your legal rights, please read and agree to our{' '}
                <Text style={sgTm.link}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={sgTm.link}>Privacy Policy</Text>
                {' '}before creating your account.
              </Text>
              <View style={sgTm.btnRow}>
                <TouchableOpacity style={sgTm.disagreeBtn} onPress={() => setTermsVisible(false)} activeOpacity={0.8}>
                  <Text style={sgTm.disagreeTxt}>Disagree</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sgTm.agreeBtn} onPress={() => {
                  // Persist agreement so modal never shows again on this device
                  storage.setItem('@cardyn_terms_agreed', 'true').catch(() => {})
                  setTermsVisible(false)
                  handleSignupNext()
                }} activeOpacity={0.85}>
                  <Text style={sgTm.agreeTxt}>Agree</Text>
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
        <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
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
                      // Use the full international phone format saved during first send
                      await sendOtpToPhone(otpFullPhone || phone)
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
        </View>
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

    // Show strength hints only after user starts typing
    const showHints = password.length > 0
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
            <StepHeader onBack={() => goTo('signup_otp')} progress={0.85}
              onHelp={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing[2], paddingTop: spacing[4], paddingBottom: spacing[8] }}>

              <Text style={[s.stepTitle, { marginHorizontal: spacing[2] }]}>Set Your Password</Text>
              <Text style={[s.stepSub, { marginHorizontal: spacing[2] }]}>Choose a strong password to secure your account.</Text>

              {/* Password */}
              <View style={li2.pwRow}>
                <Feather name="lock" size={16} color="#AAAAAA" />
                <TextInput style={li2.pwInput} placeholder="At least 8 characters"
                  placeholderTextColor="#BBBBBB" secureTextEntry={!showPw}
                  value={password} onChangeText={t => { setPassword(t); setError('') }} returnKeyType="next" />
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
                      borderRadius: ms(20), paddingHorizontal: spacing[2], paddingVertical: 3 }}>
                      <Feather name={h.ok ? 'check' : 'x'} size={11} color={h.ok ? '#22C55E' : '#AAAAAA'} />
                      <Text style={{ fontSize: ms(11), color: h.ok ? '#22C55E' : '#AAAAAA', fontWeight: '500' }}>{h.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Confirm Password */}
              <View style={[li2.pwRow, confirmPw.length > 0 && password !== confirmPw && li2.pwRowError]}>
                <Feather name="lock" size={16} color={confirmPw.length > 0 && password !== confirmPw ? '#FF4D4F' : '#AAAAAA'} />
                <TextInput style={li2.pwInput} placeholder="Re-enter password"
                  placeholderTextColor="#BBBBBB" secureTextEntry={!showConfirmPw}
                  value={confirmPw} onChangeText={t => { setConfirmPw(t); setError('') }}
                  returnKeyType="done" />
                <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showConfirmPw ? 'eye-off' : 'eye'} size={16} color="#AAAAAA" />
                </TouchableOpacity>
              </View>

              {confirmPw.length > 0 && password !== confirmPw && (
                <View style={inlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={inlineErr.txt}>Passwords do not match</Text>
                </View>
              )}
              {error === 'phone_exists_pw' ? (
                <View style={inlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={inlineErr.txt}>This number is already registered. </Text>
                  <TouchableOpacity onPress={() => { setLoginMethod('phone'); setPassword(''); goTo('login') }} activeOpacity={0.7}>
                    <Text style={inlineErr.link}>Log in →</Text>
                  </TouchableOpacity>
                </View>
              ) : !!error ? (
                <View style={inlineErr.box}>
                  <Feather name="alert-circle" size={14} color="#FF4D4F" />
                  <Text style={inlineErr.txt}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[li2.btn, (!isValid || loading) && li2.btnOff]}
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
                      setError('phone_exists_pw')
                    } else if (msg.includes('Network') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
                      setError('Check your internet connection and try again.')
                    } else {
                      setError(msg || 'Registration failed. Please try again.')
                    }
                  }
                  finally { setLoading(false) }
                }}
                disabled={!isValid || loading} activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[li2.btnTxt, (!isValid || loading) && li2.btnTxtOff]}>Create Account</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </>
    )
  }

  return null
}

// ── Inline error styles ───────────────────────────────────────────────────────
const inlineErr = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F1',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#FFD6D6',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[2],
    marginBottom: spacing[2],
  },
  txt: {
    fontSize: typography.size.sm,
    color: '#CC0000',
    flex: 1,
    lineHeight: ms(18),
  },
  link: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.primary,
  },
})

// ── Terms modal styles (signup) ───────────────────────────────────────────────
const sgTm = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    padding: spacing[6],
    width: '100%',
  },
  title: {
    fontSize: RF(18),
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: spacing[4],
    lineHeight: ms(26),
  },
  body: {
    fontSize: RF(14),
    color: '#555',
    lineHeight: ms(22),
    marginBottom: spacing[6],
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  disagreeBtn: {
    flex: 1,
    paddingVertical: ms(14),
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  disagreeTxt: {
    fontSize: RF(15),
    fontWeight: '600',
    color: '#555',
  },
  agreeBtn: {
    flex: 2,
    paddingVertical: ms(14),
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  agreeTxt: {
    fontSize: RF(15),
    fontWeight: '700',
    color: '#fff',
  },
})
