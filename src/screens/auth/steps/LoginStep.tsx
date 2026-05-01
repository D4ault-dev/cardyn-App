import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, Animated, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard, Image, ActivityIndicator, Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, spacing } from '../../../theme'
import { keyboardBehavior, ms, SCREEN_H } from '../../../util/responsive'
import { isValidEmail } from '../phoneUtils'
import { SocialButton } from '../AuthComponents'
import { li2, s } from '../styles/authStyles'
import { Country } from '../../../api/country'
import { Step } from '../types'

const { width: W } = Dimensions.get('window')

export interface LoginStepProps {
  // State
  loginInput: string
  loginSubStep: 'account' | 'password'
  password: string
  showPw: boolean
  loading: boolean
  error: string
  socialLoading: 'google' | 'apple' | null
  // Animated values
  liHeroHeight: Animated.Value
  liCardOpacity: Animated.Value
  liFooterOpacity: Animated.Value
  liPwAnim: Animated.Value
  liPwOpacity: Animated.Value
  liBtnScale: Animated.Value
  liPwBtnScale: Animated.Value
  fadeAnim: Animated.Value
  // Country
  selectedCountry: Country
  countries: Country[]
  countriesLoading: boolean
  countryPickerOpen: boolean
  // Insets
  insetsBottom: number
  // Setters
  setLoginInput: (v: string) => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
  setPassword: (v: string) => void
  setShowPw: (fn: (v: boolean) => boolean) => void
  setError: (v: string) => void
  setLoginSubStep: (v: 'account' | 'password') => void
  setCountryPickerOpen: (v: boolean) => void
  // Handlers
  handleLoginNext: () => Promise<void>
  doLogin: () => Promise<void>
  handleGoogleSignIn: () => Promise<void>
  handleAppleSignIn: () => Promise<void>
  showHelp: boolean
  setShowHelp: (v: boolean) => void
  goTo: (s: Step) => void
  reset: () => void
}

export function LoginStep({
  loginInput,
  loginSubStep,
  password,
  showPw,
  loading,
  error,
  socialLoading,
  liHeroHeight,
  liCardOpacity,
  liFooterOpacity,
  liPwAnim,
  liPwOpacity,
  liBtnScale,
  liPwBtnScale,
  fadeAnim,
  selectedCountry,
  insetsBottom,
  setLoginInput,
  setPhone,
  setEmail,
  setPassword,
  setShowPw,
  setError,
  setLoginSubStep,
  handleLoginNext,
  doLogin,
  handleGoogleSignIn,
  handleAppleSignIn,
  setShowHelp,
  goTo,
  reset,
}: LoginStepProps) {
  const isEmailInput = loginInput.includes('@')
  const canNext = isEmailInput
    ? isValidEmail(loginInput)
    : loginInput.replace(/\D/g, '').length >= 7
  const showPwPanel = loginSubStep === 'password'
  const isNotFound  = error === 'not_found'
  const hasError    = !!error && error !== 'not_found'

  function onBtnPressIn() {
    Animated.spring(liBtnScale, {
      toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10,
    }).start()
  }
  function onBtnPressOut() {
    Animated.spring(liBtnScale, {
      toValue: 1, useNativeDriver: true, tension: 300, friction: 10,
    }).start()
  }
  function onPwBtnPressIn() {
    Animated.spring(liPwBtnScale, {
      toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10,
    }).start()
  }
  function onPwBtnPressOut() {
    Animated.spring(liPwBtnScale, {
      toValue: 1, useNativeDriver: true, tension: 300, friction: 10,
    }).start()
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={0}
      >
        {/* ── Root: full screen, blue bg ── */}
        <View style={li2.root}>

          {/* ── Blue background (absolute, full screen) ── */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />

          {/* ── Nav row — no back button on login, just Help ── */}
          <SafeAreaView edges={['top']} style={li2.safeTop}>
            <View style={li2.navRow}>
              <View style={{ width: 40 }} />
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setTimeout(() => setShowHelp(true), 150) }}>
                <Text style={li2.helpTxt}>Help</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* ── Hero — shrinks when keyboard opens ── */}
          <Animated.View style={{ height: liHeroHeight, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <Image
              source={require('../../../../assets/login-hero.png')}
              style={{ width: W * 0.72, height: W * 0.72 * (332 / 263) }}
              resizeMode="contain"
              fadeDuration={0}
            />
          </Animated.View>

          {/* White fill — covers from card top all the way to screen bottom */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: SCREEN_H * 0.42, backgroundColor: '#FFFFFF' }} />
          <Animated.View style={[li2.card, { opacity: liCardOpacity, flex: 1, paddingBottom: Math.max(insetsBottom, 16) + 32 }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 24 : 0 }}
            >

              {/* Account input row */}
              <View style={[
                li2.inputRow,
                isNotFound && li2.inputRowError,
                showPwPanel && li2.inputRowDone,
              ]}>
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
                  editable={!showPwPanel}
                  onChangeText={t => {
                    setLoginInput(t)
                    if (t.includes('@')) { setEmail(t.trim()) } else { setPhone(t.replace(/\D/g, '')) }
                    setError('')
                    if (showPwPanel) { setLoginSubStep('account'); setPassword('') }
                  }}
                  returnKeyType={showPwPanel ? 'done' : 'next'}
                  onSubmitEditing={showPwPanel ? doLogin : handleLoginNext}
                />
                {loginInput.length > 0 && !showPwPanel && (
                  <TouchableOpacity onPress={() => { setLoginInput(''); setPhone(''); setEmail(''); setError('') }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <View style={li2.clearBtn}><Feather name="x" size={11} color="#fff" /></View>
                  </TouchableOpacity>
                )}
                {showPwPanel && (
                  <TouchableOpacity onPress={() => { setLoginSubStep('account'); setPassword(''); setError('') }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
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

              {/* Password panel — springs in */}
              {showPwPanel && (
                <Animated.View style={{ transform: [{ translateY: liPwAnim }], opacity: liPwOpacity, marginTop: spacing[3] }}>
                  <View style={[li2.pwRow, hasError && li2.pwRowError]}>
                    <Feather name="lock" size={16} color={hasError ? '#FF4D4F' : '#AAAAAA'} />
                    <TextInput
                      style={li2.pwInput}
                      placeholder="Password"
                      placeholderTextColor="#BBBBBB"
                      secureTextEntry={!showPw}
                      value={password}
                      onChangeText={t => { setPassword(t); setError('') }}
                      autoFocus={false}
                      ref={r => { if (r && showPwPanel) setTimeout(() => r.focus(), 100) }}
                      returnKeyType="done"
                      onSubmitEditing={doLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPw(v => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name={showPw ? 'eye-off' : 'eye'} size={16} color="#AAAAAA" />
                    </TouchableOpacity>
                  </View>
                  {hasError && (
                    <Animated.View style={[li2.errRow, { opacity: fadeAnim }]}>
                      <Feather name="alert-circle" size={12} color="#FF4D4F" />
                      <Text style={li2.errTxt}>{error}</Text>
                    </Animated.View>
                  )}
                  <TouchableOpacity style={li2.forgotRow}
                    onPress={() => { setPassword(''); setError(''); goTo('forgot') }} activeOpacity={0.7}>
                    <Text style={li2.forgotTxt}>Forgot password?</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* CTA button */}
              <Animated.View style={{ transform: [{ scale: showPwPanel ? liPwBtnScale : liBtnScale }], marginTop: spacing[4] }}>
                <TouchableOpacity
                  style={[li2.btn, (showPwPanel ? (!password || loading) : (!canNext || loading)) && li2.btnOff]}
                  onPress={showPwPanel ? doLogin : handleLoginNext}
                  onPressIn={showPwPanel ? onPwBtnPressIn : onBtnPressIn}
                  onPressOut={showPwPanel ? onPwBtnPressOut : onBtnPressOut}
                  disabled={showPwPanel ? (!password || loading) : (!canNext || loading)}
                  activeOpacity={1}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={li2.btnTxt}>{showPwPanel ? 'Log In' : 'Next'}</Text>
                  }
                </TouchableOpacity>
              </Animated.View>

              {/* Footer — fades out on focus/keyboard */}
              <Animated.View style={{ opacity: liFooterOpacity }}>

                {/* Sign up + Retrieve */}
                <View style={li2.linksRow}>
                  <TouchableOpacity
                    onPress={() => { reset(); goTo('signup') }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={li2.linkTxt}>Sign up</Text>
                  </TouchableOpacity>
                  <View style={li2.linkDot} />
                  <TouchableOpacity
                    onPress={() => { setPassword(''); setError(''); goTo('forgot') }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={li2.linkTxt}>Retrieve account</Text>
                  </TouchableOpacity>
                </View>

                {/* Social divider */}
                <View style={li2.dividerRow}>
                  <View style={li2.dividerLine} />
                  <Text style={li2.dividerTxt}>or continue with</Text>
                  <View style={li2.dividerLine} />
                </View>

                {/* Social buttons */}
                <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
                  <SocialButton provider="google" loading={socialLoading === 'google'} onPress={handleGoogleSignIn} />
                  {Platform.OS === 'ios' && (
                    <SocialButton provider="apple" loading={socialLoading === 'apple'} onPress={handleAppleSignIn} />
                  )}
                </View>

                {/* Consent */}
                <Text style={[li2.consent, { marginTop: spacing[3] }]}>
                  By continuing, you agree to our{' '}
                  <Text style={li2.consentLink}>Terms & Conditions</Text>
                  {' '}and{' '}
                  <Text style={li2.consentLink}>Privacy Policy</Text>
                </Text>

              </Animated.View>

            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}
