import React from 'react'
import {
  View, Text, TouchableOpacity, Image, Platform, StyleSheet,
  KeyboardAvoidingView, ScrollView, Dimensions, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import { Animated } from 'react-native'
import { ms, RF } from '../../../util/responsive'
import { colors, spacing, radius } from '../../../theme'
import { Country } from '../../../api/country'
import storage from '../../../util/storage'
import { Analytics } from '../../../util/analytics'

const SCREEN_W = Dimensions.get('window').width

export interface OnboardingStepProps {
  fadeAnim: Animated.Value
  selectedCountry: Country
  onGoToSignup: () => void
  onGoToLogin: () => void
}

export function OnboardingStep({
  fadeAnim,
  selectedCountry,
  onGoToSignup,
  onGoToLogin,
}: OnboardingStepProps) {
  const insets = useSafeAreaInsets()
  const topPad = Platform.OS === 'ios' ? insets.top : getStatusBarHeight()
  const bottomPad = Math.max(insets.bottom, 16)

  function handleGetStarted() {
    storage.setItem('@tuka_onboarding_done', 'true').catch(() => {})
    Analytics.onboardingCompleted()
    Analytics.signupStarted('phone', selectedCountry.name)
    onGoToSignup()
  }

  function handleLogin() {
    storage.setItem('@tuka_onboarding_done', 'true').catch(() => {})
    Analytics.onboardingCompleted()
    onGoToLogin()
  }

  return (
    <View style={[st.root, { paddingTop: topPad }]}>
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[st.inner, { paddingBottom: bottomPad + ms(8) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >

        {/* Logo */}
        <View style={st.logoWrap}>
          <Image
            source={require('../../../../assets/onboarding-logo.png')}
            style={st.logo}
            resizeMode="contain"
          />
        </View>

        {/* Welcome text */}
        <View style={st.textWrap}>
          <Text style={st.welcomeLabel}>Welcome to the</Text>
          <Text style={st.appName}>Cardyn</Text>
        </View>

        {/* Buttons */}
        <View style={st.btnWrap}>
          {/* Primary CTA */}
          <TouchableOpacity style={st.primaryBtn} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={st.primaryBtnTxt}>Get Started</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerTxt}>or</Text>
            <View style={st.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity style={st.socialBtn} onPress={handleGetStarted} activeOpacity={0.8}>
            <Image
              source={require('../../../../assets/google-logo.png')}
              style={st.socialIcon}
              resizeMode="contain"
            />
            <Text style={st.socialBtnTxt}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={st.socialBtn} onPress={handleGetStarted} activeOpacity={0.8}>
              <Image
                source={require('../../../../assets/apple-logo.png')}
                style={st.socialIcon}
                resizeMode="contain"
              />
              <Text style={st.socialBtnTxt}>Continue with Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer sign-in link */}
        <View style={[st.footer, { paddingBottom: ms(8) }]}>
          <Text style={st.footerTxt}>Have an account? </Text>
          <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  )
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  inner: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },

  // Logo
  logoWrap: {
    marginTop: ms(24),
    marginBottom: ms(8),
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: SCREEN_W * 0.75,
    height: SCREEN_W * 0.75 * (1024 / 1536), // preserve 3:2 aspect ratio
  },

  // Welcome text
  textWrap: {
    alignItems: 'center',
    paddingBottom: ms(24),
    marginTop: ms(8),
  },
  welcomeLabel: {
    fontSize: RF(34),
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    lineHeight: ms(42),
  },
  appName: {
    fontSize: RF(36),
    fontWeight: '800',
    fontStyle: 'italic',
    color: colors.primary,
    textAlign: 'center',
    lineHeight: ms(44),
  },

  // Buttons block
  btnWrap: {
    width: '100%',
    marginBottom: ms(16),
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(12),
  },
  primaryBtnTxt: {
    fontSize: RF(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: ms(8),
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

  // Social buttons
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
    paddingVertical: ms(14),
    marginTop: ms(10),
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

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: ms(8),
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
})
