import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Animated, Platform, Keyboard, Image,
  ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius } from '../../../theme'
import { ms, RF } from '../../../util/responsive'
import { isValidEmail } from '../phoneUtils'
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
  liBtnScale, fadeAnim,
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

  const insets = useSafeAreaInsets()
  const topInset = Platform.OS === 'ios' ? insets.top : getStatusBarHeight()
  const bottomPad = Math.max(insetsBottom, 48)

  const [termsVisible, setTermsVisible] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  function onBtnPressIn() {
    Animated.spring(liBtnScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start()
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
      <KeyboardAvoidingView
        style={[{ flex: 1 }, { paddingTop: topInset }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={st.root}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[st.scrollContent, { paddingBottom: bottomPad + ms(48) }]}
          >

            {/* Back button */}
            <TouchableOpacity
              style={st.backBtn}
              onPress={() => { reset(); goTo('landing') }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={st.backCircle}>
                <Feather name="chevron-left" size={18} color="#1A1A2E" />
              </View>
            </TouchableOpacity>

            {/* App icon */}
            <View style={st.iconWrap}>
              <View style={st.iconBg}>
                <Image
                  source={require('../../../../assets/icon.png')}
                  style={st.iconImg}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Title */}
            <Text style={st.title}>Sign in</Text>
            <Text style={st.subtitle}>Sign in to your Cardyn account</Text>

            {/* Email / Phone field */}
            <View style={st.fieldWrap}>
              <Text style={st.fieldLabel}>Account<Text style={st.required}>*</Text></Text>
              <View style={[st.inputBox, isNotFound && st.inputBoxError]}>
                <TextInput
                  style={st.input}
                  placeholder="Phone or Email"
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
                  keyboardAppearance="light"
                />
                {loginInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setLoginInput(''); setPhone(''); setEmail(''); setError('') }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="x-circle" size={16} color="#BBBBBB" />
                  </TouchableOpacity>
                )}
              </View>
              {isNotFound && (
                <Animated.View style={[st.errRow, { opacity: fadeAnim }]}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={st.errTxt}>Account not found. </Text>
                  <TouchableOpacity onPress={() => { reset(); goTo('signup') }} activeOpacity={0.7}>
                    <Text style={st.errLink}>Sign up →</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {/* Password field */}
            <View style={st.fieldWrap}>
              <Text style={st.fieldLabel}>Password<Text style={st.required}>*</Text></Text>
              <View style={[st.inputBox, hasError && st.inputBoxError]}>
                <TextInput
                  style={st.input}
                  placeholder="••••••••"
                  placeholderTextColor="#BBBBBB"
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={t => { setPassword(t); setError('') }}
                  returnKeyType="done"
                  onSubmitEditing={handleLoginPress}
                  keyboardAppearance="light"
                />
                <TouchableOpacity
                  onPress={() => setShowPw(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={showPw ? 'eye' : 'eye-off'} size={18} color="#BBBBBB" />
                </TouchableOpacity>
              </View>
              {hasError && (
                <Animated.View style={[st.errRow, { opacity: fadeAnim }]}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={st.errTxt}>{error}</Text>
                </Animated.View>
              )}
            </View>

            {/* Remember me + Forgot password */}
            <View style={st.rememberRow}>
              <TouchableOpacity
                style={st.rememberLeft}
                onPress={() => setRememberMe(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[st.checkbox, rememberMe && st.checkboxOn]}>
                  {rememberMe && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Text style={st.rememberTxt}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setPassword(''); setError(''); goTo('forgot') }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={st.forgotTxt}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign in button */}
            <Animated.View style={{ transform: [{ scale: liBtnScale }] }}>
              <TouchableOpacity
                style={[st.primaryBtn, !canLogin && st.primaryBtnOff]}
                onPress={handleLoginPress}
                onPressIn={onBtnPressIn}
                onPressOut={onBtnPressOut}
                disabled={!canLogin}
                activeOpacity={1}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[st.primaryBtnTxt, !canLogin && st.primaryBtnTxtOff]}>Sign in</Text>
                }
              </TouchableOpacity>
            </Animated.View>

            {/* Social login divider */}
            <View style={st.dividerRow}>
              <View style={st.dividerLine} />
              <Text style={st.dividerTxt}>or continue with</Text>
              <View style={st.dividerLine} />
            </View>

            {/* Social buttons */}
            <TouchableOpacity
              style={st.socialBtn}
              onPress={handleGoogleSignIn}
              disabled={socialLoading !== null}
              activeOpacity={0.8}
            >
              {socialLoading === 'google'
                ? <ActivityIndicator size="small" color="#1A1A2E" />
                : <>
                    <Image source={require('../../../../assets/google-logo.png')} style={st.socialIcon} resizeMode="contain" />
                    <Text style={st.socialBtnTxt}>Continue with Google</Text>
                  </>
              }
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={st.socialBtn}
                onPress={handleAppleSignIn}
                disabled={socialLoading !== null}
                activeOpacity={0.8}
              >
                {socialLoading === 'apple'
                  ? <ActivityIndicator size="small" color="#1A1A2E" />
                  : <>
                      <Image source={require('../../../../assets/apple-logo.png')} style={st.socialIcon} resizeMode="contain" />
                      <Text style={st.socialBtnTxt}>Continue with Apple</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* Sign up footer */}
            <View style={[st.footer, { marginTop: ms(16) }]}>
              <Text style={st.footerTxt}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => { reset(); goTo('signup') }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={st.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>

        {/* Terms & Privacy Modal */}
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

      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: ms(8),
    flexGrow: 1,
  },

  // Back button
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: ms(20),
  },
  backCircle: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },

  // App icon
  iconWrap: {
    alignItems: 'center',
    marginBottom: ms(20),
  },
  iconBg: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImg: {
    width: ms(64),
    height: ms(64),
  },

  // Title
  title: {
    fontSize: RF(28),
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: ms(6),
  },
  subtitle: {
    fontSize: RF(16),
    fontWeight: '500',
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: ms(24),
    marginBottom: ms(28),
  },

  // Fields
  fieldWrap: {
    marginBottom: ms(16),
  },
  fieldLabel: {
    fontSize: RF(15),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: ms(8),
  },
  required: {
    color: '#EF4444',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: ms(14),
    paddingVertical: ms(14),
    gap: ms(8),
  },
  inputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  input: {
    flex: 1,
    fontSize: RF(16),
    color: '#1A1A2E',
    paddingVertical: 0,
  },

  // Error
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    marginTop: ms(6),
  },
  errTxt: {
    fontSize: RF(12),
    color: '#EF4444',
  },
  errLink: {
    fontSize: RF(12),
    fontWeight: '700',
    color: colors.primary,
  },

  // Remember me + Forgot
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ms(24),
  },
  rememberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  checkbox: {
    width: ms(16),
    height: ms(16),
    borderRadius: ms(4),
    borderWidth: 1.5,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberTxt: {
    fontSize: RF(14),
    color: '#4A5568',
  },
  forgotTxt: {
    fontSize: RF(14),
    fontWeight: '700',
    color: colors.primary,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: ms(12),
    paddingVertical: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(24),
  },
  primaryBtnOff: {
    backgroundColor: '#D0D5DD',
  },
  primaryBtnTxt: {
    fontSize: RF(17),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  primaryBtnTxtOff: {
    color: '#8A94A6',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: ms(4),
  },
  footerTxt: {
    fontSize: RF(15),
    color: '#8A94A6',
  },
  footerLink: {
    fontSize: RF(15),
    fontWeight: '700',
    color: colors.primary,
  },

  // Social
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: ms(16),
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D0D5DD',
  },
  dividerTxt: {
    fontSize: RF(13),
    color: '#8A94A6',
    marginHorizontal: ms(12),
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    paddingVertical: ms(14),
    marginBottom: ms(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    gap: ms(10),
  },
  socialIcon: {
    width: ms(20),
    height: ms(20),
  },
  socialBtnTxt: {
    fontSize: RF(16),
    fontWeight: '700',
    color: '#1A1A2E',
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
    color: '#1A1A2E',
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
    borderRadius: ms(50),
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
    borderRadius: ms(50),
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  agreeTxt: {
    fontSize: RF(15),
    fontWeight: '700',
    color: '#fff',
  },
})
