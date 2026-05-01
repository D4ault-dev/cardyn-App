import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, KeyboardAvoidingView,
  Platform, Keyboard, Alert,
  ActivityIndicator, Easing
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import storage from '../util/storage'
import { Feather } from '@expo/vector-icons'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '../context/AuthContext'
import { fetchCountries, Country } from '../api/country'
import { colors, typography, spacing } from '../theme'
import { signInWithGoogle, signInWithApple, isAppleAvailable } from '../api/socialAuth'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ── Extracted modules ─────────────────────────────────────────────────────────
import { Step, FALLBACK_COUNTRY, BIOMETRIC_KEY, BIOMETRIC_USER, BIOMETRIC_PASS } from './auth/types'
import { getExpectedDigits, sanitizePhone, isValidPhone, getFullPhone, isValidEmail, maskPhone } from './auth/phoneUtils'
import { sendOtp, verifyOtp } from './auth/otpUtils'
import { HelpModal, CountryPickerModal } from './auth/AuthComponents'
import { Analytics } from '../util/analytics'
import { SCREEN_H, keyboardBehavior } from '../util/responsive'

// ── Step components ───────────────────────────────────────────────────────────
import { OnboardingStep } from './auth/steps/OnboardingStep'
import { LoginStep } from './auth/steps/LoginStep'
import { SignupStep } from './auth/steps/SignupStep'
import { ForgotStep } from './auth/steps/ForgotStep'
import { BiometricStep } from './auth/steps/BiometricStep'
import { s } from './auth/styles/authStyles'

export default function AuthScreen(props: StackScreenProps<RootStackParams, 'Login'>) {
  const { login, signup, loginWithSocial, resetPassword } = useAuth()
  const insets = useSafeAreaInsets()

  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep]           = useState<Step>('landing')
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [loginInput, setLoginInput] = useState('')
  const [loginSubStep, setLoginSubStep] = useState<'account' | 'password'>('account')
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone')
  const [otp, setOtp]             = useState(['', '', '', '', '', ''])
  const [password, setPassword]   = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [otpPinId, setOtpPinId]   = useState('')
  const [otpTestCode, setOtpTestCode] = useState('')
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError]         = useState('')
  const [showHelp, setShowHelp]   = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<Country>(FALLBACK_COUNTRY)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [pendingUsername, setPendingUsername] = useState('')

  // ── Refs & animated values ────────────────────────────────────────────────
  const otpRefs   = useRef<(TextInput | null)[]>([])
  const [otpFocused, setOtpFocused] = useState(-1)
  const slideAnim = useRef(new Animated.Value(40)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const liCardOpacity = useRef(new Animated.Value(0)).current
  const liBtnScale    = useRef(new Animated.Value(1)).current
  const liLinksAnim   = useRef(new Animated.Value(0)).current
  const liPwAnim      = useRef(new Animated.Value(32)).current
  const liPwOpacity   = useRef(new Animated.Value(0)).current
  const liPwBtnScale  = useRef(new Animated.Value(1)).current
  const [liKeyboardUp, setLiKeyboardUp] = useState(false)
  const liFooterOpacity = useRef(new Animated.Value(1)).current
  const liHeroHeight  = useRef(new Animated.Value(SCREEN_H * 0.32)).current

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      storage.getItem('@tuka_onboarding_done'),
      storage.getItem('@tuka_last_phone'),
      storage.getItem('@tuka_last_country'),
    ]).then(([onboarded, lastPhone, lastCountry]) => {
      if (onboarded === 'true') setStep('login')
      if (lastPhone) { setPhone(lastPhone); setLoginInput(lastPhone) }
      if (lastCountry) {
        try {
          const c = JSON.parse(lastCountry)
          if (c && c.id) setSelectedCountry(c)
        } catch { /* ignore */ }
      }
      setOnboardingChecked(true)
    }).catch(() => setOnboardingChecked(true))
  }, [])

  useEffect(() => {
    slideAnim.setValue(40); fadeAnim.setValue(0)
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start()
  }, [step])

  useEffect(() => {
    let alive = true
    fetchCountries().then(list => {
      if (!alive) return
      const nextCountries = list.length > 0 ? list : [FALLBACK_COUNTRY]
      setCountries(nextCountries)
      setSelectedCountry(current => {
        const match = nextCountries.find(c => c.id === current.id || c.name === current.name)
        return match || nextCountries[0]
      })
    }).finally(() => { if (alive) setCountriesLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (step !== 'login') return
    setLoginSubStep('account')
    liPwAnim.setValue(32); liPwOpacity.setValue(0)
    liCardOpacity.setValue(0); liLinksAnim.setValue(0)
    liFooterOpacity.setValue(1)
    liHeroHeight.setValue(SCREEN_H * 0.32)
    Animated.parallel([
      Animated.timing(liCardOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(liLinksAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 12 }),
      ]),
    ]).start()
  }, [step])

  useEffect(() => {
    if (step === 'login') return
    liCardOpacity.setValue(1)
  }, [step])

  useEffect(() => {
    if (step !== 'login') return
    const footerHidden = liKeyboardUp || loginSubStep === 'password'
    Animated.timing(liFooterOpacity, {
      toValue: footerHidden ? 0 : 1,
      duration: footerHidden ? 180 : 300,
      easing: footerHidden ? Easing.out(Easing.ease) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liKeyboardUp, loginSubStep, step])

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setLiKeyboardUp(true)
        Animated.spring(liHeroHeight, { toValue: SCREEN_H * 0.12, useNativeDriver: false, tension: 60, friction: 14 }).start()
      }
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setLiKeyboardUp(false)
        Animated.spring(liHeroHeight, { toValue: SCREEN_H * 0.32, useNativeDriver: false, tension: 55, friction: 14 }).start()
      }
    )
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    if (step !== 'signup_otp' && step !== 'forgot_otp') return
    setCountdown(60); setCanResend(false)
    const t = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(t); setCanResend(true); return 0 } return p - 1 })
    }, 1000)
    return () => clearInterval(t)
  }, [step])

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has => {
      if (has) LocalAuthentication.isEnrolledAsync().then(enrolled => setBiometricAvailable(enrolled))
    })
  }, [])

  useEffect(() => {
    if (step !== 'landing') return
    ;(async () => {
      try {
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEY)
        if (enabled !== 'true' || !biometricAvailable) return
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Log in to FUFU CARDS',
          fallbackLabel: 'Use Password',
          cancelLabel: 'Cancel',
        })
        if (result.success) {
          const savedUser = await SecureStore.getItemAsync(BIOMETRIC_USER)
          const savedPass = await SecureStore.getItemAsync(BIOMETRIC_PASS)
          if (savedUser && savedPass) {
            setLoading(true)
            try { await login(savedUser, savedPass) }
            catch { /* fall through to normal login */ }
            finally { setLoading(false) }
          }
        }
      } catch { /* biometric not available */ }
    })()
  }, [step, biometricAvailable])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    setError('')
    setSocialLoading('google')
    try {
      const socialUser = await signInWithGoogle()
      await loginWithSocial(socialUser, selectedCountry.name)
    } catch (e: any) {
      if (e.message !== 'Google sign-in was cancelled') {
        setError(e.message || 'Google sign-in failed. Please try again.')
      }
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleAppleSignIn() {
    setError('')
    setSocialLoading('apple')
    try {
      const available = await isAppleAvailable()
      if (!available) {
        setSocialLoading(null)
        Alert.alert('Not Available', 'Sign in with Apple is only available on iOS 13+.')
        return
      }
      const socialUser = await signInWithApple()
      setSocialLoading('apple')
      try {
        await loginWithSocial(socialUser, selectedCountry.name)
      } catch (e: any) {
        setError(e.message || 'Apple sign-in failed')
      } finally {
        setSocialLoading(null)
      }
    } catch (e: any) {
      setSocialLoading(null)
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(e.message || 'Apple sign-in failed')
      }
    }
  }

  function goTo(s: Step) { setError(''); setOtp(['','','','','','']); setStep(s) }

  async function sendOtpToPhone(phoneNumber: string): Promise<boolean> {
    const result = await sendOtp(phoneNumber)
    if (!result) { setError('Failed to send OTP. Please try again.'); return false }
    setOtpPinId(result.pinId)
    setOtpTestCode(result.testOtp || '')
    Analytics.otpRequested(selectedCountry.name)
    return true
  }

  async function verifyOtpCode(pin: string): Promise<boolean> {
    if (!otpPinId) { setError('Session expired. Please request a new code.'); return false }
    const ok = await verifyOtp(otpPinId, pin)
    if (!ok) {
      setError('Invalid code. Please try again.')
      Analytics.otpFailed(selectedCountry.name)
    } else {
      Analytics.otpVerified(selectedCountry.name)
    }
    return ok
  }

  function reset() {
    setPhone(''); setEmail(''); setName(''); setPassword(''); setConfirmPw('')
    setOtp(['','','','','','']); setError(''); setLoginInput(''); setLoginSubStep('account')
    setShowPw(false); setShowConfirmPw(false)
    setOtpPinId(''); setOtpTestCode('')
    setLoginMethod('phone')
  }

  async function enableBiometric(username: string, pass: string) {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometrics',
        cancelLabel: 'Cancel',
      })
      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_KEY,  'true')
        await SecureStore.setItemAsync(BIOMETRIC_USER, username)
        await SecureStore.setItemAsync(BIOMETRIC_PASS, pass)
        return true
      }
    } catch { /* not available */ }
    return false
  }

  function showPasswordPanel() {
    setLoginSubStep('password')
    liPwAnim.setValue(24); liPwOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(liPwAnim,    { toValue: 0, useNativeDriver: true, tension: 65, friction: 12 }),
      Animated.timing(liPwOpacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start()
  }

  async function handleLoginNext() {
    const trimmed = loginInput.trim()
    const isEmailInput = loginInput.includes('@')
    const canNext = isEmailInput
      ? isValidEmail(loginInput)
      : loginInput.replace(/\D/g, '').length >= 7
    if (!trimmed) { setError('Enter your phone number or email'); return }
    if (!canNext)  { setError(isEmailInput ? 'Enter a valid email address' : 'Enter a valid phone number'); return }
    setLoading(true); setError('')
    try {
      const { default: api } = await import('../api/client')
      if (isEmailInput) {
        setLoginMethod('email'); setEmail(trimmed)
        try {
          const res = await api.get('/tuka/user/checkEmail', { params: { email: trimmed } })
          const r = res.data?.msg ?? res.data?.data
          if (r === 'available') { setError('not_found') } else { showPasswordPanel() }
        } catch (e: any) {
          if ((e?.response?.status ?? 0) === 401) { setError('not_found') } else { showPasswordPanel() }
        }
      } else {
        const raw = trimmed.replace(/\D/g, '')
        setLoginMethod('phone'); setPhone(raw)
        try {
          const res = await api.get('/tuka/user/checkPhone', { params: { phone: raw } })
          const r = res.data?.msg ?? res.data?.data
          if (r === 'available') { setError('not_found') } else {
            storage.setItem('@tuka_last_phone', raw).catch(() => {})
            showPasswordPanel()
          }
        } catch { showPasswordPanel() }
      }
    } finally { setLoading(false) }
  }

  async function doLogin() {
    if (!password) { setError('Password is required'); return }
    setLoading(true); setError('')
    try {
      const username = loginMethod === 'phone' ? phone : email
      await login(username, password)
      const alreadyEnabled = await SecureStore.getItemAsync(BIOMETRIC_KEY)
      if (!alreadyEnabled && biometricAvailable) { setPendingUsername(username); goTo('biometric_setup') }
    } catch (e: any) { setError(e.message || 'Incorrect password. Please try again.') }
    finally { setLoading(false) }
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  if (!onboardingChecked) return null

  if (step === 'landing') {
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <OnboardingStep
          fadeAnim={fadeAnim}
          selectedCountry={selectedCountry}
          onGoToSignup={() => { reset(); goTo('signup') }}
          onGoToLogin={() => { reset(); goTo('login') }}
        />
      </>
    )
  }

  if (step === 'login') {
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <CountryPickerModal
          visible={countryPickerOpen} countries={countries} selected={selectedCountry}
          onSelect={c => { setSelectedCountry(c); setCountryPickerOpen(false) }}
          onClose={() => setCountryPickerOpen(false)} loading={countriesLoading}
        />
        <LoginStep
          loginInput={loginInput}
          loginSubStep={loginSubStep}
          password={password}
          showPw={showPw}
          loading={loading}
          error={error}
          socialLoading={socialLoading}
          liHeroHeight={liHeroHeight}
          liCardOpacity={liCardOpacity}
          liFooterOpacity={liFooterOpacity}
          liPwAnim={liPwAnim}
          liPwOpacity={liPwOpacity}
          liBtnScale={liBtnScale}
          liPwBtnScale={liPwBtnScale}
          fadeAnim={fadeAnim}
          selectedCountry={selectedCountry}
          countries={countries}
          countriesLoading={countriesLoading}
          countryPickerOpen={countryPickerOpen}
          insetsBottom={insets.bottom}
          setLoginInput={setLoginInput}
          setPhone={setPhone}
          setEmail={setEmail}
          setPassword={setPassword}
          setShowPw={setShowPw}
          setError={setError}
          setLoginSubStep={setLoginSubStep}
          setCountryPickerOpen={setCountryPickerOpen}
          handleLoginNext={handleLoginNext}
          doLogin={doLogin}
          handleGoogleSignIn={handleGoogleSignIn}
          handleAppleSignIn={handleAppleSignIn}
          showHelp={showHelp}
          setShowHelp={setShowHelp}
          goTo={goTo}
          reset={reset}
        />
      </>
    )
  }

  if (step === 'signup' || step === 'signup_otp' || step === 'signup_password') {
    return (
      <SignupStep
        step={step}
        name={name}
        phone={phone}
        otp={otp}
        otpFocused={otpFocused}
        password={password}
        confirmPw={confirmPw}
        showPw={showPw}
        showConfirmPw={showConfirmPw}
        loading={loading}
        error={error}
        socialLoading={socialLoading}
        countdown={countdown}
        canResend={canResend}
        otpTestCode={otpTestCode}
        showHelp={showHelp}
        selectedCountry={selectedCountry}
        countries={countries}
        countriesLoading={countriesLoading}
        countryPickerOpen={countryPickerOpen}
        liCardOpacity={liCardOpacity}
        fadeAnim={fadeAnim}
        insetsBottom={insets.bottom}
        otpRefs={otpRefs}
        setName={setName}
        setPhone={setPhone}
        setOtp={setOtp}
        setOtpFocused={setOtpFocused}
        setPassword={setPassword}
        setConfirmPw={setConfirmPw}
        setShowPw={setShowPw}
        setShowConfirmPw={setShowConfirmPw}
        setError={setError}
        setLoading={setLoading}
        setCountryPickerOpen={setCountryPickerOpen}
        setSelectedCountry={setSelectedCountry}
        setShowHelp={setShowHelp}
        setCanResend={setCanResend}
        setCountdown={setCountdown}
        setLoginMethod={setLoginMethod}
        sendOtpToPhone={sendOtpToPhone}
        verifyOtpCode={verifyOtpCode}
        handleGoogleSignIn={handleGoogleSignIn}
        handleAppleSignIn={handleAppleSignIn}
        signup={signup}
        goTo={goTo}
        reset={reset}
        biometricAvailable={biometricAvailable}
        setPendingUsername={setPendingUsername}
      />
    )
  }

  if (step === 'forgot' || step === 'forgot_otp' || step === 'forgot_newpassword' || step === 'password_success') {
    return (
      <>
        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
        <ForgotStep
          step={step}
          phone={phone}
          otp={otp}
          otpFocused={otpFocused}
          password={password}
          confirmPw={confirmPw}
          showPw={showPw}
          showConfirmPw={showConfirmPw}
          loading={loading}
          error={error}
          countdown={countdown}
          canResend={canResend}
          otpTestCode={otpTestCode}
          showHelp={showHelp}
          selectedCountry={selectedCountry}
          countries={countries}
          countriesLoading={countriesLoading}
          countryPickerOpen={countryPickerOpen}
          liCardOpacity={liCardOpacity}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          insetsBottom={insets.bottom}
          otpRefs={otpRefs}
          setPhone={setPhone}
          setOtp={setOtp}
          setOtpFocused={setOtpFocused}
          setPassword={setPassword}
          setConfirmPw={setConfirmPw}
          setShowPw={setShowPw}
          setShowConfirmPw={setShowConfirmPw}
          setError={setError}
          setLoading={setLoading}
          setCountryPickerOpen={setCountryPickerOpen}
          setSelectedCountry={setSelectedCountry}
          setShowHelp={setShowHelp}
          setCanResend={setCanResend}
          setCountdown={setCountdown}
          setLoginInput={setLoginInput}
          sendOtpToPhone={sendOtpToPhone}
          verifyOtpCode={verifyOtpCode}
          resetPassword={resetPassword}
          goTo={goTo}
        />
      </>
    )
  }

  if (step === 'biometric_setup') {
    return (
      <BiometricStep
        fadeAnim={fadeAnim}
        slideAnim={slideAnim}
        pendingUsername={pendingUsername}
        password={password}
        enableBiometric={enableBiometric}
      />
    )
  }

  // login_password step — kept inline (legacy redirect from signup)
  if (step === 'login_password') {
    const identifier = loginMethod === 'phone'
      ? maskPhone(phone.length > 6 ? phone : loginInput)
      : email || loginInput
    const doLoginPw = async () => {
      if (!password) { setError('Password is required'); return }
      setLoading(true)
      try {
        const username = loginMethod === 'phone' ? phone : email
        await login(username, password)
        const alreadyEnabled = await SecureStore.getItemAsync(BIOMETRIC_KEY)
        if (!alreadyEnabled && biometricAvailable) {
          setPendingUsername(username)
          goTo('biometric_setup')
        }
      } catch (e: any) { setError(e.message || 'Incorrect password. Please try again.') }
      finally { setLoading(false) }
    }
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={s.pwTopWrap}>
              <View style={s.pwTopBar}>
                <TouchableOpacity onPress={() => { setPassword(''); setError(''); goTo('login') }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <View style={s.backCircle}>
                    <Feather name="chevron-left" size={20} color={colors.primary} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={s.phonePill}
                  onPress={() => { setPassword(''); setError(''); goTo('login') }} activeOpacity={0.7}>
                  <Feather name={loginMethod === 'phone' ? 'phone' : 'mail'} size={13} color={colors.primary} />
                  <Text style={s.phonePillTxt}>{identifier}</Text>
                  <Feather name="x" size={12} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <View style={s.pwCard}>
              <View style={s.pwHandle} />
              <Text style={s.pwTitle}>Enter your password</Text>
              <Text style={s.pwSub}>
                Welcome back{' '}
                <Text style={{ color: colors.primary, fontWeight: typography.weight.bold }}>{identifier}</Text>
              </Text>
              <View style={[s.pwInputBox, !!error && { borderColor: colors.error, borderWidth: 1.5 }]}>
                <Feather name="lock" size={18} color={!!error ? colors.error : colors.subtle} />
                <TextInput
                  style={s.inputCardTxt}
                  placeholder="Password"
                  placeholderTextColor={colors.subtle}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={t => { setPassword(t); setError('') }}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={doLoginPw}
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.subtle} />
                </TouchableOpacity>
              </View>
              {!!error && (
                <Animated.View style={[s.pwErrRow, { opacity: fadeAnim }]}>
                  <Feather name="alert-circle" size={13} color={colors.error} />
                  <Text style={s.pwErrTxt}>{error}</Text>
                </Animated.View>
              )}
              <TouchableOpacity
                style={[s.primaryBtn, (!password || loading) && s.primaryBtnOff, { marginTop: spacing[4] }]}
                onPress={doLoginPw}
                disabled={!password || loading}
                activeOpacity={0.85}>
                {loading
                  ? <ActivityIndicator size="small" color={colors.primaryText} />
                  : <Text style={[s.primaryBtnTxt, !password && s.primaryBtnTxtOff]}>Login</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.forgotRow} activeOpacity={0.7}
                onPress={() => { setPassword(''); setError(''); goTo('forgot') }}>
                <Text style={s.forgotTxt}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return null
}
