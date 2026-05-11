import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import storage from '../util/storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { colors, typography, spacing, radius, shadow } from '../theme'

const BIOMETRIC_KEY = '@tuka_biometric_enabled'

export default function SecuritySettingsScreen(props: StackScreenProps<RootStackParams, 'SecuritySettings'>) {
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [supported, setSupported]               = useState(false)

  useEffect(() => {
    // Check hardware support AND enrollment
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([hasHardware, isEnrolled]) => {
      setSupported(hasHardware && isEnrolled)
    })
    storage.getItem(BIOMETRIC_KEY).then(v => setBiometricEnabled(v === 'true'))
  }, [])

  async function handleToggle(val: boolean) {
    if (val) {
      // Check enrollment first
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!enrolled) {
        Alert.alert(
          'Biometrics Not Set Up',
          'Please set up Face ID or fingerprint in your device Settings first.',
          [{ text: 'OK' }]
        )
        return
      }

      // Trigger the native Face ID / fingerprint prompt
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      })
      if (!result.success) {
        // User cancelled or failed — don't enable
        return
      }
    }
    setBiometricEnabled(val)
    await storage.setItem(BIOMETRIC_KEY, val ? 'true' : 'false')
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
              thumbColor={biometricEnabled ? '#fff' : '#fff'}
              disabled={!supported}
            />
          </View>
        </View>

        <Text style={s.hint}>
          After enabling biometrics, it will be prioritized for high-security operations.
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
