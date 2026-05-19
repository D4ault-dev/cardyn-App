import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { BIOMETRIC_KEY } from './auth/types'
import { useToast } from '../util/useToast'
import storage from '../util/storage'

export default function SecuritySettingsScreen(props: StackScreenProps<RootStackParams, 'SecuritySettings'>) {
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [supported, setSupported]               = useState(false)
  const [toggling, setToggling]                 = useState(false)
  const [diagInfo, setDiagInfo]                 = useState('')
  const { showSuccess, showError, Toast }        = useToast()

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
        AsyncStorage.getItem('@tuka_auth_token'),
        AsyncStorage.getItem('@cardyn_biometric_enabled'),
      ]).then(([hasHardware, isEnrolled, types, storedVal, token, asyncVal]) => {
        if (!active) return
        setSupported(hasHardware)
        setBiometricEnabled(storedVal === 'true')
        const typeNames = types.map(t =>
          t === LocalAuthentication.AuthenticationType.FINGERPRINT ? 'Fingerprint' :
          t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ? 'Face ID' : 'Iris'
        ).join(', ')
        setDiagInfo(
          `Hardware: ${hasHardware ? '✅' : '❌'} | Enrolled: ${isEnrolled ? '✅' : '❌'}\n` +
          `Types: ${typeNames || 'none'}\n` +
          `SecureStore: ${storedVal ?? 'null'} | AsyncStorage: ${asyncVal ?? 'null'}\n` +
          `Token: ${token ? '✅ present' : '❌ missing'}`
        )
      }).catch(() => {})
      return () => { active = false }
    }, [])
  )

  async function runBiometricDiagnostic() {
    const lines: string[] = []
    try {
      // 1. Hardware check
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      lines.push(`Hardware: ${hasHardware ? '✅' : '❌'}`)

      // 2. Enrolled check
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      lines.push(`Enrolled: ${isEnrolled ? '✅' : '❌'}`)

      // 3. Supported types
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const typeNames = types.map(t =>
        t === LocalAuthentication.AuthenticationType.FINGERPRINT ? 'Fingerprint' :
        t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION ? 'Face ID' : 'Iris'
      )
      lines.push(`Types: ${typeNames.join(', ') || 'None'}`)

      // 4. SecureStore value
      const secureVal = await SecureStore.getItemAsync(BIOMETRIC_KEY).catch(() => 'ERROR')
      lines.push(`SecureStore key: "${secureVal}"`)

      // 5. AsyncStorage fallback value
      const asyncVal = await AsyncStorage.getItem('@cardyn_biometric_enabled').catch(() => 'ERROR')
      lines.push(`AsyncStorage key: "${asyncVal}"`)

      // 6. Auth token present — stored in SecureStore as '_tuka_auth_token'
      const token = await SecureStore.getItemAsync('_tuka_auth_token').catch(() => null)
      lines.push(`Auth token: ${token ? '✅ present' : '❌ missing'}`)

      // 7. Would lock trigger?
      const wouldLock = hasHardware && isEnrolled && !!token && (secureVal === 'true' || asyncVal === 'true')
      lines.push(`\nWould lock trigger: ${wouldLock ? '✅ YES' : '❌ NO'}`)

    } catch (e: any) {
      lines.push(`Error: ${e.message}`)
    }

    Alert.alert('Biometric Diagnostic', lines.join('\n'), [{ text: 'OK' }])
  }

  async function handleToggle(val: boolean) {
    if (toggling) return
    setToggling(true)

    try {
      if (val) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Authenticate to enable biometric lock',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        })

        if (!result.success) return

        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true')
        await storage.setItem('@cardyn_biometric_enabled', 'true')
        setBiometricEnabled(true)
        showSuccess('Biometrics enabled')

      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Authenticate to disable biometric lock',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        })

        if (!result.success) return

        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'false')
        await storage.setItem('@cardyn_biometric_enabled', 'false')
        setBiometricEnabled(false)
        showSuccess('Biometrics disabled')
      }
    } catch {
      showError('Biometric unavailable')
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
                <Text style={s.rowSub}>Not available on this device</Text>
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

        {/* Debug button — tap to see biometric diagnostic */}
        <TouchableOpacity style={s.debugBtn} onPress={runBiometricDiagnostic} activeOpacity={0.7}>
          <Text style={s.debugTxt}>Run Biometric Diagnostic</Text>
        </TouchableOpacity>
      </View>

      {Toast}
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
  debugBtn: {
    marginHorizontal: spacing[5], marginTop: spacing[5],
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  debugTxt: {
    fontSize: typography.size.sm, color: colors.muted, fontWeight: typography.weight.semibold,
  },
})
