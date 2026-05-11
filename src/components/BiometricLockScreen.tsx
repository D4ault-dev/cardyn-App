/**
 * BiometricLockScreen
 *
 * Shown as a full-screen overlay when the app returns from background
 * and the user has biometrics enabled. The user must authenticate to
 * continue — they cannot dismiss it any other way.
 *
 * Trigger: AppState 'active' after being in 'background' for > LOCK_AFTER_MS
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform, ActivityIndicator,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import Svg, { Path } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, typography, radius } from '../theme'
import { ms, RF } from '../util/responsive'
import { getStatusBarHeight } from '../util/statusBar'
import { BIOMETRIC_KEY } from '../screens/auth/types'

interface Props {
  onUnlocked: () => void
}

export function BiometricLockScreen({ onUnlocked }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'iris' | null>(null)

  // Fade in animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start()

    // Detect biometric type
    LocalAuthentication.supportedAuthenticationTypesAsync().then(types => {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face')
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType('iris')
      } else {
        setBiometricType('fingerprint')
      }
    }).catch(() => setBiometricType('fingerprint'))

    // Auto-trigger biometric prompt on mount
    setTimeout(() => authenticate(), 400)
  }, [])

  async function authenticate() {
    setLoading(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Cardyn',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      })

      if (result.success) {
        // Fade out then unlock
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          onUnlocked()
        })
      } else {
        if (result.error === 'user_cancel' || result.error === 'system_cancel') {
          setError('Tap the button below to try again')
        } else if (result.error === 'not_enrolled') {
          // Biometric not enrolled — just unlock
          onUnlocked()
        } else {
          setError('Authentication failed. Please try again.')
        }
      }
    } catch {
      setError('Biometric authentication unavailable')
    } finally {
      setLoading(false)
    }
  }

  const iconName = biometricType === 'face' ? 'smile' : 'fingerprint-outline'

  return (
    <Animated.View style={[
      StyleSheet.absoluteFillObject,
      styles.container,
      { opacity: fadeAnim },
    ]}>
      <View style={[styles.inner, { paddingTop: getStatusBarHeight() + spacing[4] }]}>

        {/* Lock icon at top */}
        <View style={styles.lockWrap}>
          <Feather name="lock" size={ms(22)} color="rgba(255,255,255,0.6)" />
          <Text style={styles.lockTxt}>Cardyn is locked</Text>
        </View>

        {/* Biometric icon — centered */}
        <Animated.View style={[styles.iconSection, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconOuter}>
            <View style={styles.iconMiddle}>
              <View style={styles.iconInner}>
                {/* Fingerprint SVG */}
                <Svg width={ms(52)} height={ms(52)} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 16V11.3615C7 10.8518 7.10026 10.3624 7.28451 9.90769M17 16V12.8154M9.22222 7.73446C10.0167 7.27055 10.9721 7 12 7C14.2795 7 16.2027 8.33062 16.8046 10.15"
                    stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Path
                    d="M10 17V14.8235M14 17V11.8529C14 10.8296 13.1046 10 12 10C10.8954 10 10 10.8296 10 11.8529V12.6471"
                    stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <Path d="M6 3H3V6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

        {/* Error message */}
        {!!error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* Unlock button */}
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
              <Feather name={biometricType === 'face' ? 'smile' : 'zap'} size={18} color={colors.primary} />
              <Text style={styles.unlockTxt}>
                {biometricType === 'face' ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}
              </Text>
            </>
          )}
        </TouchableOpacity>

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
    color: 'rgba(255,255,255,0.6)',
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
    color: 'rgba(255,255,255,0.8)',
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
  unlockBtnLoading: {
    opacity: 0.8,
  },
  unlockTxt: {
    fontSize: RF(16),
    fontWeight: '700',
    color: colors.primary,
  },
})
