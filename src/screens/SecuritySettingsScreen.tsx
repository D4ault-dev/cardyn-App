import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { useFocusEffect } from '@react-navigation/native'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { BIOMETRIC_KEY } from './auth/types'
import { useToast } from '../util/useToast'

export default function SecuritySettingsScreen(props: StackScreenProps<RootStackParams, 'SecuritySettings'>) {
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [supported, setSupported]               = useState(false)
  const [toggling, setToggling]                 = useState(false)
  const [pushToken, setPushToken]               = useState<string>('tap to test')
  const { showSuccess, showError, Toast }        = useToast()

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]).then(([hasHardware, storedVal]) => {
        if (!active) return
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
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         'Authenticate to enable biometric lock',
          fallbackLabel:         'Use Passcode',
          cancelLabel:           'Cancel',
          disableDeviceFallback: false,
        })

        if (!result.success) return

        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true')
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

        {/* ── Push token debug — remove after confirming notifications work ── */}
        <View style={s.debugCard}>
          <Text style={s.debugLabel}>Push Token Test</Text>
          <Text style={s.debugToken} selectable numberOfLines={3}>{pushToken}</Text>
          <TouchableOpacity
            style={s.debugBtn}
            onPress={async () => {
              setPushToken('fetching...')
              try {
                if (!Device.isDevice) { setPushToken('NOT a physical device'); return }
                const { status } = await Notifications.requestPermissionsAsync()
                if (status !== 'granted') { setPushToken('Permission denied'); return }
                const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
                const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
                setPushToken(tokenData.data)
                showSuccess('Token fetched!')
              } catch (e: any) {
                setPushToken('ERROR: ' + (e?.message || String(e)))
                showError('Token fetch failed')
              }
            }}
            activeOpacity={0.8}>
            <Text style={s.debugBtnTxt}>Get Push Token</Text>
          </TouchableOpacity>
        </View>
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
  debugCard: {
    margin: spacing[4], marginTop: spacing[5],
    backgroundColor: '#0D1F24', borderRadius: radius.xl,
    padding: spacing[4],
  },
  debugLabel: {
    fontSize: typography.size.xs, color: '#00C2B4',
    fontWeight: typography.weight.bold, marginBottom: spacing[2],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  debugToken: {
    fontSize: 11, color: '#00ff88', fontFamily: 'monospace',
    lineHeight: 16, marginBottom: spacing[3],
    minHeight: 40,
  },
  debugBtn: {
    backgroundColor: '#00C2B4', borderRadius: radius.full,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  debugBtnTxt: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#fff',
  },
})
