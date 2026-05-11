import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Animated, Platform, Keyboard,
  ActivityIndicator, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius } from '../../../theme'
import { ms, RF } from '../../../util/responsive'
import { isValidEmail } from '../phoneUtils'
import { SocialButton } from '../AuthComponents'
import { li2 } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'

export interface LoginStepProps {
  loginInput: string
  loginSubStep: 'account' | 'password'
  password: string
  showPw: boolean
  loading: boolean
  error: string
  socialLoading: 'google' | 'apple' | null
  liHeroHeight: Animated.Value
  liCardOpacity: Animated.Value
  liFooterOpacity: Animated.Value
  liPwAnim: Animated.Value
  liPwOpacity: Animated.Value
  liBtnScale: Animated.Value
  liPwBtnScale: Animated.Value
  fadeAnim: Animated.Value
  selectedCountry: Country
  countries: Country[]
  countriesLoading: boolean
  countryPickerOpen: boolean
  insetsBottom: number
  setLoginInput: (v: string) => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  setShowPw: (fn: (v: boolean) => boolean) => void
  setError: (v: string) => void
  setLoginSubStep: (v: 'account' | 'password') => void
  setCountryPickerOpen: (v: boolean) => void
  handleLoginNext: () => Promise<void>
  doLogin: () => Promise<void>
  handleGoogleSignIn: () => Promise<void>
  handleAppleSignIn: () => Promise<void>
  showHelp: boolean
  setShowHelp: (v: boolean) => void
  goTo: (s: Step) => void
  reset: () => void
  keyboardUp?: boolean
}

export function LoginStep({
  loginInput, password, showPw, loading, error, socialLoading,
  liHeroHeight, liCardOpacity, liFooterOpacity, liBtnScale, fadeAnim,
  insetsBottom,
  setLoginInput, setPhone, setEmail, setPassword, setShowPw, setError,
  doLogin, handleGoogleSignIn, handleAppleSignIn,
  setShowHelp, goTo, reset,
}: LoginStepProps) {
  const isEmailInput = loginInput.includes('@')
  const canNext = isEmailInput
    ? isValidEmail(loginInput)
    : loginInput.replace(/\D/g, '').length >= 7
  const isNotFound = error === 'not_found'
  const hasError   = !!error && error !== 'not_found'
  const canLogin   = canNext && password.length > 0 && !loading

  // Terms modal — shown on first login attempt
  const [termsVisible, setTermsVisible] = useState(false)

  function onBtnPressIn() {
    Animated.spring(liBtnScale, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10 }).start()
  }
  function onBtnPressOut() {
    Animated.spring(liBtnScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start()
  }

  function handleLoginPress() {
    if (!canLogin) return
    Keyboard.dismiss()
    setTermsVisible(true)
  }

  function handleAgree() {
    setTermsVisible(false)
    doLogin()
  }

  function handleDisagree() {
    setTermsVisible(false)
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={li2.root}>

        {/* Blue background */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

        {/* Nav */}
        <SafeAreaView edges={['top']} style={li2.safeTop}>
          <View style={li2.navRow}>
            <View style={{ width: 40 }} />
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
              <Text style={li2.helpTxt}>Help</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Hero — "Welcome Back" text instead of image */}
        <Animated.View
          style={{ height: liHeroHeight, alignItems: 'flex-start', justifyContent: 'flex-end', paddingHorizontal: spacing[6], paddingBottom: spacing[4] }}
          pointerEvents="none"
        >
          <Text style={li2.heroTitle}>Welcome{'\n'}Back 👋</Text>
        </Animated.View>

        {/* White card — flex:1 fills remaining space, content at top, footer at bottom */}
        <Animated.View style={[li2.card, { opacity: liCardOpacity, flex: 1, marginTop: -ms(4) }]}>

          {/* Form */}
          <View style={{ paddingHorizontal: spacing[1], paddingTop: spacing[6] }}>

            {/* Account */}
            <View style={[li2.inputRow, isNotFound && li2.inputRowError]}>
              <Text style={li2.inputLabel}>Account</Text>
              <View style={li2.inputDivider} />
              <TextInput
                style={li2.input}
                placeholder="Phone/Email"
                placeholderTextColor="#BBBBBB"
                keyboardType={isEmailInput ? 'email-address' : 'default'}
                autoCapitalize="none"
                autoCorrect={false}
                value={loginInput}
                onChangeText={t => {
                  setLoginInput(t)
                  if (t.includes('@')) { setEmail(t.trim()) } else { setPhone(t.replace(/\D/g, '')) }
                  setError('')
                }}
                returnKeyType="next"
              />
              {loginInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setLoginInput(''); setPhone(''); setEmail(''); setError('') }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <View style={li2.clearBtn}><Feather name="x" size={11} color="#fff" /></View>
                </TouchableOpacity>
              )}
            </View>

            {/* Account not found */}
            {isNotFound && (
              <Animated.View style={[li2.notFoundRow, { opacity: fadeAnim }]}>
                <Feather name="alert-circle" size={13} color="#FF4D4F" />
                <Text style={li2.notFoundTxt}>Account not found. </Text>
                <TouchableOpacity onPress={() => { reset(); goTo('signup') }} activeOpacity={0.7}>
                  <Text style={li2.notFoundLink}>Sign up →</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Password */}
            <View style={[li2.pwRow, { marginBottom: spacing[1] }]}>
              <Feather name="lock" size={16} color="#AAAAAA" />
              <TextInput
                style={li2.pwInput}
                placeholder="Password"
                placeholderTextColor="#BBBBBB"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={t => { setPassword(t); setError('') }}
                returnKeyType="done"
                onSubmitEditing={handleLoginPress}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name={showPw ? 'eye-off' : 'eye'} size={16} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {hasError && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginHorizontal: spacing[2], marginBottom: spacing[1] }}>
                <Feather name="alert-circle" size={13} color="#FF4D4F" />
                <Text style={{ fontSize: RF(13), color: '#FF4D4F', flex: 1 }}>{error}</Text>
              </View>
            )}

            {/* Forgot password */}
            <View style={{ alignItems: 'flex-end', marginTop: spacing[2], marginBottom: spacing[2], paddingRight: spacing[4] }}>
              <TouchableOpacity
                onPress={() => { setPassword(''); setError(''); goTo('forgot') }}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Text style={li2.forgotTxt}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Log In button — opens Terms modal first */}
            <Animated.View style={{ transform: [{ scale: liBtnScale }], marginTop: spacing[3] }}>
              <TouchableOpacity
                style={[li2.btn, !canLogin && li2.btnOff]}
                onPress={handleLoginPress}
                onPressIn={onBtnPressIn}
                onPressOut={onBtnPressOut}
                disabled={!canLogin}
                activeOpacity={1}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[li2.btnTxt, !canLogin && li2.btnTxtOff]}>Log In</Text>
                }
              </TouchableOpacity>
            </Animated.View>

          </View>

          {/* Flexible spacer — keeps footer close to form, not pinned to screen bottom */}
          <View style={{ flex: 1, maxHeight: ms(40) }} />

          {/* Footer */}
          <Animated.View style={{
            opacity: liFooterOpacity,
            paddingHorizontal: spacing[1],
            paddingBottom: Math.max(insetsBottom, 16) + spacing[2],
            paddingTop: spacing[2],
          }}>
            <View style={li2.linksRow}>
              <TouchableOpacity onPress={() => { reset(); goTo('signup') }} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={li2.linkTxt}>Create account</Text>
              </TouchableOpacity>
              <View style={li2.linkDot} />
              <TouchableOpacity onPress={() => { setPassword(''); setError(''); goTo('forgot') }} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={li2.linkTxt}>Reset password</Text>
              </TouchableOpacity>
            </View>

            <View style={[li2.dividerRow, { marginVertical: spacing[3] }]}>
              <View style={li2.dividerLine} />
              <Text style={li2.dividerTxt}>or continue with</Text>
              <View style={li2.dividerLine} />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing[3], marginHorizontal: spacing[5], marginBottom: spacing[1] }}>
              <SocialButton provider="google" loading={socialLoading === 'google'} onPress={handleGoogleSignIn} />
              {Platform.OS === 'ios' && (
                <SocialButton provider="apple" loading={socialLoading === 'apple'} onPress={handleAppleSignIn} />
              )}
            </View>
          </Animated.View>

        </Animated.View>

        {/* ── Terms & Privacy Modal ── */}
        <Modal
          visible={termsVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={handleDisagree}
        >
          <View style={tm.overlay}>
            <View style={tm.card}>
              <Text style={tm.title}>Service Agreement &{'\n'}Privacy Protection</Text>
              <Text style={tm.body}>
                To best protect your legal rights, please read and agree to our{' '}
                <Text style={tm.link}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={tm.link}>Privacy Policy</Text>
                {' '}before continuing.
              </Text>
              <View style={tm.btnRow}>
                <TouchableOpacity style={tm.disagreeBtn} onPress={handleDisagree} activeOpacity={0.8}>
                  <Text style={tm.disagreeTxt}>Disagree</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tm.agreeBtn} onPress={handleAgree} activeOpacity={0.85}>
                  <Text style={tm.agreeTxt}>Agree</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </TouchableWithoutFeedback>
  )
}

const errBox = StyleSheet.create({
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
    marginBottom: spacing[1],
  },
  txt: {
    fontSize: RF(13),
    color: '#CC0000',
    flex: 1,
    lineHeight: ms(18),
  },
})

const tm = StyleSheet.create({
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
