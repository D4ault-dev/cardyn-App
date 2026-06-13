import { RF, ms } from '../util/responsive'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, Alert, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as LocalAuthentication from 'expo-local-authentication'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, spacing, radius, typography } from '../theme'
import client from '../api/client'
import { submitWithdrawal } from '../api/wallet'
import { useCountry } from '../context/CountryContext'

const PIN_LENGTH = 4

function fmt(n: number) {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return acc
  const last4 = acc.slice(-4)
  return `**** ***${last4.slice(0, 1)} ${last4.slice(1)}`
}

export default function WithdrawPinScreen(props: StackScreenProps<RootStackParams, 'WithdrawPin'>) {
  const { bank, amount, fee, receive } = (props.route.params as any) || {}
  const { selectedCountry } = useCountry()
  const localSym = selectedCountry?.currencySymbol ?? '₦'
  const [pin, setPin]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const shakeAnim             = useRef(new Animated.Value(0)).current
  const successScale          = useRef(new Animated.Value(0.7)).current
  const successOpacity        = useRef(new Animated.Value(0)).current

  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null)

  // Check biometric availability on mount — NO auto-prompt, user must tap
  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(has => {
      if (!has) return
      LocalAuthentication.isEnrolledAsync().then(async enrolled => {
        if (enrolled) {
          setBiometricAvailable(true)
          // Determine biometric type
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
          // Type 2 = FACIAL_RECOGNITION, Type 1 = FINGERPRINT
          if (types.includes(2)) setBiometricType('face')
          else if (types.includes(1)) setBiometricType('fingerprint')
        }
      })
    })
  }, [])

  // Shake on error
  useEffect(() => {
    if (error) {
      setPin('')
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start()
    }
  }, [error])

  // Animate success screen in
  useEffect(() => {
    if (success) {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    }
  }, [success])

  async function handlePinComplete(fullPin: string) {
    setLoading(true)
    setError(null)
    try {
      await client.post('/tuka/user/verifyWithdrawPassword', { password: fullPin })
      await submitWithdrawal({
        amount,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNo: bank.accountNumber,
        country: selectedCountry?.name || 'Nigeria',
      })
      setSuccess(true)
    } catch (e: any) {
      const msg = e.message || 'Incorrect PIN'
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('pin') || msg.toLowerCase().includes('password')) {
        setError('Incorrect PIN. Please try again.')
      } else {
        Alert.alert('Failed', msg)
        props.navigation.navigate('Withdraw' as any)
      }
    } finally { setLoading(false) }
  }

  async function handleBiometric() {
    if (loading) return
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Use Face ID or fingerprint to authorize payment',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      })
      if (result.success) {
        // Biometric verified on device — skip PIN and submit directly
        setLoading(true)
        setError(null)
        try {
          await submitWithdrawal({
            amount,
            bankName: bank.bankName,
            accountName: bank.accountName,
            accountNo: bank.accountNumber,
            country: selectedCountry?.name || 'Nigeria',
          })
          setSuccess(true)
        } catch (e: any) {
          Alert.alert('Failed', e.message || 'Withdrawal failed')
          props.navigation.navigate('Withdraw' as any)
        } finally { setLoading(false) }
      }
    } catch {
      // biometric prompt dismissed — do nothing
    }
  }

  function pressDigit(d: string) {
    if (pin.length >= PIN_LENGTH || loading) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      setTimeout(() => handlePinComplete(next), 120)
    }
  }

  function pressDelete() {
    if (loading) return
    setError(null)
    setPin(p => p.slice(0, -1))
  }

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ]

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={[s.root, { paddingTop: getStatusBarHeight(), justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={[ss.container, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
          {/* Check circle */}
          <View style={ss.iconOuter}>
            <View style={ss.iconInner}>
              <Feather name="check" size={36} color="#fff" />
            </View>
          </View>

          <Text style={ss.title}>Withdrawal Submitted</Text>
          <Text style={ss.subtitle}>
            Your withdrawal of {localSym}{fmt(receive || amount)} to{'\n'}
            <Text style={{ fontWeight: '700', color: colors.dark }}>{bank?.bankName}</Text> is being processed.
          </Text>

          {/* Receipt row */}
          <View style={ss.receiptCard}>
            {[
              { label: 'Amount', value: `${localSym}${fmt(amount)}` },
              { label: 'Fee', value: `${localSym}${fmt(fee || 0)}` },
              { label: 'You receive', value: `${localSym}${fmt(receive || amount)}`, bold: true },
              { label: 'Account', value: maskAccountNumber(bank?.accountNumber || '') },
              { label: 'Status', value: 'Pending', status: true },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={ss.receiptRow}>
                  <Text style={ss.receiptLabel}>{row.label}</Text>
                  <Text style={[
                    ss.receiptValue,
                    row.bold && { color: colors.primary, fontWeight: '800' },
                    row.status && { color: colors.warning },
                  ]}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={ss.divider} />}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={ss.doneBtn}
            onPress={() => props.navigation.navigate('Withdraw' as any)}
            activeOpacity={0.85}>
            <Text style={ss.doneBtnTxt}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={ss.historyBtn}
            onPress={() => props.navigation.navigate('WithdrawalHistory' as any)}
            activeOpacity={0.7}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={ss.historyBtnTxt}>View History</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    )
  }

  return (
    <View style={[s.root, { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Authorize Payment" onBack={() => props.navigation.goBack()} />

      {/* Blue bank card */}
      <LinearGradient
        colors={['#2B3FD8', '#3B52EE']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.bankCard}>
        <View style={s.circle1} />
        <View style={s.circle2} />
        <View style={s.chip}>
          <View style={s.chipLine} />
          <View style={s.chipLine} />
          <View style={s.chipLine} />
        </View>
        <Text style={s.bankName}>{bank?.bankName}</Text>
        <Text style={s.bankAcc}>{maskAccountNumber(bank?.accountNumber || '')}</Text>
        <View style={s.receiveRow}>
          <Text style={s.receiveLbl}>You receive</Text>
          <Text style={s.receiveAmt}>₦{fmt(receive || 0)}</Text>
        </View>
      </LinearGradient>

      {/* Title */}
      <View style={s.titleWrap}>
        <Text style={s.title}>Enter Transaction PIN</Text>
        <Text style={s.subtitle}>To complete this transaction, enter your 4-digit PIN</Text>
      </View>

      {/* PIN dots */}
      <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]}>
            {i < pin.length && <View style={s.dotInner} />}
          </View>
        ))}
      </Animated.View>

      {/* Error */}
      {!!error && <Text style={s.errorTxt}>{error}</Text>}

      {/* Loading */}
      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[3] }} />}

      {/* Push numpad to bottom third of screen */}
      <View style={{ flex: 1, minHeight: 40, maxHeight: 80 }} />

      {/* Numpad — more compact */}
      <View style={s.numpad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={s.numRow}>
            {row.map((key, ki) => {
              if (!key) {
                // Bottom-left: Face ID / Touch ID button if available
                return biometricAvailable ? (
                  <TouchableOpacity key={ki} style={s.numKey} onPress={handleBiometric} activeOpacity={0.6} disabled={loading}>
                    <View style={s.bioBtn}>
                      <Feather
                        name={biometricType === 'fingerprint' ? 'zap' : 'camera'}
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={s.bioLabel}>
                        {biometricType === 'fingerprint' ? 'Touch' : 'Face ID'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : <View key={ki} style={s.numKey} />
              }
              if (key === 'del') return (
                <TouchableOpacity key={ki} style={s.numKey} onPress={pressDelete} activeOpacity={0.6}>
                  <Feather name="delete" size={20} color={colors.dark} />
                </TouchableOpacity>
              )
              return (
                <TouchableOpacity key={ki} style={s.numKey} onPress={() => pressDigit(key)} activeOpacity={0.6}>
                  <Text style={s.numTxt}>{key}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },

  // Blue bank card
  bankCard:    {
    marginHorizontal: spacing[5], marginTop: spacing[3],
    height: 160, borderRadius: 20, padding: spacing[5],
    overflow: 'hidden', position: 'relative', justifyContent: 'flex-end',
    shadowColor: '#2B3FD8', shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  circle1:     { position: 'absolute', right: -20, top: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  circle2:     { position: 'absolute', right: 40, top: 20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' },
  chip:        { position: 'absolute', top: spacing[5], right: spacing[5], width: 44, height: 34, borderRadius: 6, backgroundColor: '#D4A017', justifyContent: 'center', alignItems: 'center', gap: 4 },
  chipLine:    { width: 32, height: 2, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 1 },
  bankName:    { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: '#fff', marginBottom: spacing[1] },
  bankAcc:     { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginBottom: spacing[3] },
  receiveRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receiveLbl:  { fontSize: typography.size.sm, color: 'rgba(255,255,255,0.7)' },
  receiveAmt:  { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: '#fff' },

  titleWrap:   { alignItems: 'center', paddingTop: spacing[6], paddingHorizontal: spacing[6] },
  title:       { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2], textAlign: 'center' },
  subtitle:    { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  dotsRow:     { flexDirection: 'row', justifyContent: 'center', gap: spacing[3], marginTop: spacing[4] },
  dot:         { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotFilled:   { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dotInner:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  errorTxt:    { textAlign: 'center', color: colors.error, fontSize: typography.size.base, marginTop: spacing[2] },
  numpad:      { paddingHorizontal: spacing[8], paddingBottom: spacing[8], marginTop: 0 },
  numRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[1] },
  numKey:      { width: 68, height: 56, alignItems: 'center', justifyContent: 'center' },
  numTxt:      { fontSize: RF(24), fontWeight: typography.weight.semibold, color: colors.dark },
  bioBtn:      { alignItems: 'center', gap: 2 },
  bioLabel:    { fontSize: RF(9), color: colors.primary, fontWeight: typography.weight.semibold },
})

// ── Success screen styles ─────────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: {
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconOuter: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.success + '18',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  iconInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[5],
  },
  receiptCard: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  receiptLabel: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },
  receiptValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.dark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  doneBtnTxt: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#fff',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
  },
  historyBtnTxt: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
})
