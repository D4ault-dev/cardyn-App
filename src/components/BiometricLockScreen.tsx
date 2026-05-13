/**
 * BiometricLockScreen
 *
 * Full-screen overlay shown when the app returns from background and the
 * user has biometrics enabled. Purely a device lock — no backend call,
 * no account re-authentication. Just LocalAuthentication.authenticateAsync().
 *
 * Flow:
 *   1. App goes to background → backgroundedAt timestamp saved
 *   2. App returns to foreground after LOCK_AFTER_MS → this screen shown
 *   3. User scans face/finger → onUnlocked() called → overlay removed
 *   4. After MAX_FAILURES attempts → device passcode fallback offered
 *      (LocalAuthentication handles this natively with disableDeviceFallback: false)
 *
 * What was broken before and why:
 *   - AuthScreen was calling login(savedUser, savedPass) on biometric success.
 *     This re-authenticated the account on every app open, and when the JWT
 *     expired or credentials changed, it failed and kicked the user out.
 *   - The AppState listener had a stale closure on `user` — it captured the
 *     value at mount time, so it never saw the logged-in user and never locked.
 *   - Fix: biometric lock is now 100% local. onUnlocked() just removes the
 *     overlay. No login(), no SecureStore credential read, no backend.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Platform,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import Svg, { Path } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, typography, radius } from '../theme'
import { ms, RF } from '../util/responsive'
import { getStatusBarHeight } from '../util/statusBar'

interface Props {
  onUnlocked: () => void
}

// After this many failures, show the device passcode option prominently
const MAX_FAILURES = 3

export function BiometricLockScreen({ onUnlocked }: Props) {
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [failures, setFailures]       = useState(0)
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null)

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.94)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start()

    // Detect biometric type
    LocalAuthentication.supportedAuthenticationTypesAsync().then(types => {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face')
      } else {
        setBiometricType('fingerprint')
      }
    }).catch(() => setBiometricType('fingerprint'))

    // Auto-trigger on mount with a short delay so the animation is visible first
    const t = setTimeout(() => authenticate(), 350)
    return () => clearTimeout(t)
  }, [])

  function shake() {
    shakeAnim.setValue(0)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 40, useNativeDriver: true }),
    ]).start()
  }

  async function authenticate() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:          'Unlock Cardyn',
        fallbackLabel:          'Use Passcode',   // shown after biometric fails
        cancelLabel:            'Cancel',
        // false = allow device passcode as fallback (iOS PIN / Android pattern)
        disableDeviceFallback:  false,
      })

      if (result.success) {
        // Fade out then call onUnlocked — no login(), no backend, purely local
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true })
          .start(() => onUnlocked())
        return
      }

      // Handle failure
      const newFailures = failures + 1
      setFailures(newFailures)

      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        setError('Tap below to try again')
      } else if (result.error === 'not_enrolled') {
        // Device has no biometric enrolled — just unlock
        onUnlocked()
        return
      } else if (result.error === 'lockout' || result.error === 'lockout_permanent') {
        setError('Too many attempts. Use your device passcode.')
      } else {
        setError(newFailures >= MAX_FAILURES
          ? 'Too many failures. Use your device passcode below.'
          : 'Authentication failed. Try again.')
        shake()
      }
    } catch {
      setError('Biometric unavailable. Use your device passcode.')
      setFailures(f => f + 1)
    } finally {
      setLoading(false)
    }
  }

  // Use device passcode — triggers the native OS passcode/PIN prompt
  async function usePasscode() {
    setLoading(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Enter your device passcode',
        disableDeviceFallback: false,
        // On iOS this shows the PIN/passcode entry directly
        // On Android this shows the device credential screen
      })
      if (result.success) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true })
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

  const showPasscodeOption = failures >= MAX_FAILURES

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.inner, { paddingTop: getStatusBarHeight() + spacing[4] }]}>

        {/* Top label */}
        <View style={styles.lockWrap}>
          <Feather name="lock" size={ms(16)} color="rgba(255,255,255,0.55)" />
          <Text style={styles.lockTxt}>Cardyn is locked</Text>
        </View>

        {/* Biometric icon */}
        <Animated.View style={[
          styles.iconSection,
          { transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] },
        ]}>
          <View style={styles.iconOuter}>
            <View style={styles.iconMiddle}>
              <View style={styles.iconInner}>
                <Svg width={ms(52)} height={ms(52)} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 16V11.3615C7 10.8518 7.10026 10.3624 7.28451 9.90769M17 16V12.8154M9.22222 7.73446C10.0167 7.27055 10.9721 7 12 7C14.2795 7 16.2027 8.33062 16.8046 10.15"
                    stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Path
                    d="M10 17V14.8235M14 17V11.8529C14 10.8296 13.1046 10 12 10C10.8954 10 10 10.8296 10 11.8529V12.6471"
                    stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Path d="M6 3H3V6"   stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18 3H21V6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M6 21H3V18" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18 21H21V18" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </View>
          </View>

          <Text style={styles.title}>
            {biometricType === 'face' ? 'Use Face ID to unlock' : 'Use fingerprint to unlock'}
          </Text>
          <Text style={styles.subtitle}>
            Verify your identity to continue using Cardyn
          </Text>
        </Animated.View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Primary unlock button */}
        <TouchableOpacity
          style={[styles.unlockBtn, loading && styles.unlockBtnLoading]}
          onPress={authenticate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Feather
                name={biometricType === 'face' ? 'smile' : 'zap'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.unlockTxt}>
                {biometricType === 'face' ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Passcode fallback — shown after MAX_FAILURES attempts */}
        {showPasscodeOption && (
          <TouchableOpacity
            style={styles.passcodeBtn}
            onPress={usePasscode}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Feather name="grid" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.passcodeTxt}>Use Device Passcode</Text>
          </TouchableOpacity>
        )}

      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    zIndex: 9999,
    elevation: 9999,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[4],
  },

  lockWrap: {
    position: 'absolute',
    top: getStatusBarHeight() + spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  lockTxt: {
    fontSize: RF(13),
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },

  iconSection: {
    alignItems: 'center',
    gap: spacing[5],
  },
  iconOuter: {
    width: ms(160), height: ms(160), borderRadius: ms(80),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconMiddle: {
    width: ms(118), height: ms(118), borderRadius: ms(59),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: {
    width: ms(84), height: ms(84), borderRadius: ms(42),
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    fontSize: RF(22),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: RF(14),
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: ms(20),
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  errorTxt: {
    fontSize: RF(13),
    color: 'rgba(255,255,255,0.85)',
  },

  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
    paddingVertical: ms(16),
    paddingHorizontal: spacing[8],
    marginTop: spacing[4],
    minWidth: ms(220),
    justifyContent: 'center',
  },
  unlockBtnLoading: { opacity: 0.75 },
  unlockTxt: {
    fontSize: RF(16),
    fontWeight: '700',
    color: colors.primary,
  },

  passcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: spacing[2],
  },
  passcodeTxt: {
    fontSize: RF(14),
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
})
