/**
 * BiometricLockScreen — Professional redesign
 *
 * Light background design inspired by modern banking apps.
 * Shows app logo, user greeting, biometric card, and passcode fallback.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Image, Platform,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import Svg, { Path, Rect } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, spacing, typography, radius } from '../theme'
import { ms, RF } from '../util/responsive'
import { getStatusBarHeight } from '../util/statusBar'

interface Props {
  onUnlocked: () => void
  onLogout?: () => void  // "Use Password Instead" — logs out and goes to login
}

const MAX_FAILURES = 3

export function BiometricLockScreen({ onUnlocked, onLogout }: Props) {
  const { user } = useAuth()
  const userName = user.isPresent() ? user.getOrThrow().name : 'User'
  const firstName = userName.split(' ')[0].toUpperCase()

  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [failures, setFailures]           = useState(0)
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null)
  const [exiting, setExiting]             = useState<'unlock' | 'logout' | null>(null)

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Entrance fade
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start()

    // Detect biometric type
    LocalAuthentication.supportedAuthenticationTypesAsync().then(types => {
      setBiometricType(
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'face' : 'fingerprint'
      )
    }).catch(() => setBiometricType('fingerprint'))

    // Auto-trigger after animation
    const t = setTimeout(() => authenticate(), 400)
    return () => clearTimeout(t)
  }, [])

  function shake() {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 35, useNativeDriver: true }),
    ]).start()
  }

  async function authenticate() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         biometricType === 'face' ? 'Use Face ID to unlock Cardyn' : 'Use fingerprint to unlock Cardyn',
        fallbackLabel:         'Use Passcode',
        cancelLabel:           'Cancel',
        disableDeviceFallback: false,
      })

      if (result.success) {
        setExiting('unlock')
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true })
          .start(() => onUnlocked())
        return
      }

      const newFailures = failures + 1
      setFailures(newFailures)

      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        setError('Tap below to try again')
      } else if (result.error === 'not_enrolled') {
        onUnlocked()
        return
      } else if (result.error === 'lockout' || result.error === 'lockout_permanent') {
        setError('Too many attempts. Use your passcode.')
      } else {
        setError(newFailures >= MAX_FAILURES
          ? 'Use your passcode below.'
          : 'Authentication failed. Try again.')
        shake()
      }
    } catch {
      setError('Biometric unavailable. Use your passcode.')
      setFailures(f => f + 1)
    } finally {
      setLoading(false)
    }
  }

  async function usePasscode() {
    setLoading(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Enter your device passcode',
        disableDeviceFallback: false,
      })
      if (result.success) {
        setExiting('unlock')
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true })
          .start(() => onUnlocked())
      } else {
        setError('Passcode incorrect. Try again.')
        shake()
      }
    } catch {
      setError('Could not verify passcode.')
    } finally {
      setLoading(false)
    }
  }

  const showPasscode = failures >= MAX_FAILURES

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, s.container, { opacity: fadeAnim }]}>
      <View style={[s.inner, { paddingTop: getStatusBarHeight() + ms(12) }]}>

        {/* ── Top bar: logo + lock account ── */}
        <View style={s.topBar}>
          <View style={s.logoBox}>
            <Image
              source={require('../../assets/app-icon-round.png')}
              style={s.logoImg}
              resizeMode="cover"
            />
          </View>
          <View style={s.topRight}>
            <Text style={s.lostPhone}>Can't unlock?</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => onLogout?.()}>
              <Text style={s.lockAccount}>
                <Feather name="help-circle" size={12} color={colors.primary} />
                {' '}Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Welcome greeting ── */}
        <View style={s.greetingWrap}>
          <Text style={s.welcomeTxt}>Welcome Back,</Text>
          <Text style={s.nameTxt}>{firstName}</Text>
        </View>

        {/* ── Biometric card ── */}
        <Animated.View style={[s.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={s.cardTitle}>
            {biometricType === 'face' ? 'Face ID Unlock' : 'Fingerprint Unlock'}
          </Text>

          <TouchableOpacity
            style={s.iconBtn}
            onPress={authenticate}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : biometricType === 'face' ? (
              <Svg width={ms(44)} height={ms(44)} viewBox="0 0 24 24" fill="none">
                <Path d="M3 7V5a2 2 0 0 1 2-2h2" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M17 3h2a2 2 0 0 1 2 2v2" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M9 10h.01M15 10h.01" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" />
                <Path d="M9.5 15a3.5 3.5 0 0 0 5 0" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            ) : (
              <Svg width={ms(44)} height={ms(44)} viewBox="0 0 24 24" fill="none">
                <Path d="M12 1a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M8 5a4 4 0 0 0 4 4" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M12 9v6M9 12h6" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
                <Path d="M5 20a7 7 0 0 1 14 0" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            )}
          </TouchableOpacity>

          {!!error && (
            <Text style={s.errorTxt}>{error}</Text>
          )}
        </Animated.View>

        {/* ── Passcode fallback ── */}
        <TouchableOpacity
          style={s.passcodeBtn}
          onPress={() => {
            // Don't fade — keep overlay visible while logout happens
            // App.tsx will call unlock() after logout completes
            onLogout?.()
          }}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={s.passcodeTxt}>Use Password Instead</Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerTxt}>
            Secured by <Text style={s.footerBold}>Cardyn</Text> · Read our{' '}
            <Text style={s.footerLink}>Privacy Policy</Text>
          </Text>
        </View>

      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#F5F6FA',
    zIndex: 9999,
    elevation: 9999,
  },
  inner: {
    flex: 1,
    paddingHorizontal: ms(24),
    paddingBottom: ms(32),
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: ms(8),
  },
  logoBox: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(12),
    overflow: 'hidden',
  },
  logoImg: {
    width: ms(44),
    height: ms(44),
  },
  topRight: {
    alignItems: 'flex-end',
    gap: ms(2),
  },
  lostPhone: {
    fontSize: RF(12),
    color: '#8A94A6',
    fontWeight: '400',
  },
  lockAccount: {
    fontSize: RF(13),
    color: colors.primary,
    fontWeight: '600',
  },

  // Greeting
  greetingWrap: {
    marginBottom: ms(20),
  },
  welcomeTxt: {
    fontSize: RF(26),
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: ms(34),
  },
  nameTxt: {
    fontSize: RF(26),
    fontWeight: '800',
    color: '#1A1A2E',
    lineHeight: ms(34),
  },

  // Biometric card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    paddingVertical: ms(28),
    paddingHorizontal: ms(24),
    alignItems: 'center',
    marginBottom: ms(16),
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: RF(16),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: ms(20),
  },
  iconBtn: {
    width: ms(80),
    height: ms(80),
    borderRadius: ms(20),
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTxt: {
    fontSize: RF(12),
    color: '#EF4444',
    marginTop: ms(14),
    textAlign: 'center',
  },

  // Passcode button
  passcodeBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: ms(14),
    paddingVertical: ms(16),
    alignItems: 'center',
    marginBottom: ms(24),
  },
  passcodeTxt: {
    fontSize: RF(15),
    fontWeight: '700',
    color: colors.primary,
  },

  // Footer
  footer: {
    alignItems: 'center',
  },
  footerTxt: {
    fontSize: RF(11),
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: ms(18),
  },
  footerBold: {
    fontWeight: '700',
    color: '#4A5568',
  },
  footerLink: {
    fontWeight: '600',
    color: colors.primary,
  },
})
