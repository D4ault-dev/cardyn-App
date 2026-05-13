import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Switch, Alert } from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { BIOMETRIC_KEY, BIOMETRIC_USER, BIOMETRIC_PASS } from './auth/types'

export default function SecuritySettingsScreen(props: StackScreenProps<RootStackParams, 'SecuritySettings'>) {
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [supported, setSupported]               = useState(false)

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([hasHardware, isEnrolled]) => {
      setSupported(hasHardware && isEnrolled)
    })
    // Read from SecureStore — same store as App.tsx and AuthScreen use
    SecureStore.getItemAsync(BIOMETRIC_KEY).then(v => setBiometricEnabled(v === 'true')).catch(() => {})
  }, [])

  async function handleToggle(val: boolean) {
    if (val) {
      // Check enrollment
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!enrolled) {
        Alert.alert(
          'Biometrics Not Set Up',
          'Please set up Face ID or fingerprint in your device Settings first.',
          [{ text: 'OK' }]
        )
        return
      }

      // Check if we have saved credentials — biometric auto-login needs them
      const savedUser = await SecureStore.getItemAsync(BIOMETRIC_USER).catch(() => null)
      const savedPass = await SecureStore.getItemAsync(BIOMETRIC_PASS).catch(() => null)

      if (!savedUser || !savedPass) {
        Alert.alert(
          'Re-login Required',
          'Please log out and log back in once to enable biometric login. This securely saves your credentials for auto-login.',
          [{ text: 'OK' }]
        )
        return
      }

      // Trigger native biometric prompt to confirm intent
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      })
      if (!result.success) return
    }

    setBiometricEnabled(val)
    // Save to SecureStore — same store App.tsx reads from on app resume
    await SecureStore.setItemAsync(BIOMETRIC_KEY, val ? 'true' : 'false').catch(() => {})

    if (!val) {
      // Disabling — clear saved credentials
      await SecureStore.deleteItemAsync(BIOMETRIC_USER).catch(() => {})
      await SecureStore.deleteItemAsync(BIOMETRIC_PASS).catch(() => {})
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
              onValueChange={supported ? handleToggle : undefined}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              disabled={!supported}
            />
          </View>
        </View>

        <Text style={s.hint}>
          When enabled, you can use Face ID or fingerprint to unlock the app and log in automatically.
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
