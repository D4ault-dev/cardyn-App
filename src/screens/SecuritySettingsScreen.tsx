import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Switch, Alert } from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useFocusEffect } from '@react-navigation/native'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { BIOMETRIC_KEY } from './auth/types'

export default function SecuritySettingsScreen(props: StackScreenProps<RootStackParams, 'SecuritySettings'>) {
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [supported, setSupported]               = useState(false)
  const [toggling, setToggling]                 = useState(false)

  // useFocusEffect re-reads the stored value every time the screen comes into focus.
  // This fixes the "toggle resets itself" bug — previously useEffect only ran on mount,
  // so navigating away and back would show a stale value.
  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]).then(([hasHardware, isEnrolled, storedVal]) => {
        if (!active) return
        // On some Android devices isEnrolledAsync() returns false even when
        // fingerprint is enrolled — treat hasHardware alone as sufficient
        setSupported(hasHardware)
        setBiometricEnabled(storedVal === 'true')
      }).catch(() => {})
      return () => { active = false }
    }, [])
  )

  async function handleToggle(val: boolean) {
    if (toggling) return
    setToggling(true)

    try {
      if (val) {
        // Ask user to confirm with biometric before enabling
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Authenticate to enable biometric lock',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        })

        if (!result.success) {
          // user_cancel or lockout — don't change toggle
          return
        }

        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true')
        setBiometricEnabled(true)

        Alert.alert(
          'Biometrics Enabled',
          'The app will now ask for your fingerprint or Face ID when you return after 5 minutes.',
          [{ text: 'OK' }]
        )

      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Authenticate to disable biometric lock',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        })

        if (!result.success) return

        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'false')
        setBiometricEnabled(false)
      }
    } catch (e) {
      // Biometric unavailable — don't change state
      console.warn('[Biometric] toggle error:', e)
    } finally {
      setToggling(false)
    }
  }

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Security" onBack={() => props.navigation.goBack()} />

      <View style={s.body}>
        <View style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Facial or fingerprint verification</Text>
              {!supported && (
                <Text style={s.rowSub}>Not available — set up Face ID or fingerprint in Settings</Text>
              )}
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={supported && !toggling ? handleToggle : undefined}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              disabled={!supported || toggling}
            />
          </View>
        </View>

        <Text style={s.hint}>
          When enabled, the app will lock after 5 minutes in the background and require your fingerprint or Face ID to unlock.
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingTop: spacing[4] },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4] + 2,
    minHeight: 60,
  },
  rowLabel: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark,
  },
  rowSub: {
    fontSize: typography.size.xs, color: colors.muted, marginTop: 3,
  },
  hint: {
    fontSize: typography.size.xs, color: colors.muted,
    marginHorizontal: spacing[5], marginTop: spacing[3],
    lineHeight: 18,
  },
})
