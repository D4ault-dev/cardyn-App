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
import { SvgXml } from 'react-native-svg'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, spacing, radius, typography } from '../theme'
import client from '../api/client'
import { submitWithdrawal } from '../api/wallet'
import { useCountry } from '../context/CountryContext'

const PIN_LENGTH = 4

// Face ID SVG icon
const FACE_ID_SVG = `<svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.16146 2H9.5C10.0523 2 10.5 2.44772 10.5 3C10.5 3.55229 10.0523 4 9.5 4H6.2C5.62345 4 5.25118 4.00078 4.96784 4.02393C4.69618 4.04613 4.59546 4.0838 4.54601 4.109C4.35785 4.20487 4.20487 4.35785 4.109 4.54601C4.0838 4.59546 4.04613 4.69618 4.02393 4.96784C4.00078 5.25118 4 5.62345 4 6.2V9.93334C4 10.4856 3.55229 10.9333 3 10.9333C2.44772 10.9333 2 10.4856 2 9.93334V6.16146C1.99998 5.63433 1.99997 5.17954 2.03057 4.80497C2.06287 4.40963 2.13419 4.01641 2.32698 3.63803C2.6146 3.07354 3.07354 2.6146 3.63803 2.32698C4.01641 2.13419 4.40963 2.06287 4.80497 2.03057C5.17954 1.99997 5.63433 1.99998 6.16146 2Z" fill="currentColor"/>
<path d="M27.0322 4.02393C26.7488 4.00078 26.3766 4 25.8 4H22.5C21.9477 4 21.5 3.55229 21.5 3C21.5 2.44772 21.9477 2 22.5 2H25.8385C26.3657 1.99998 26.8205 1.99997 27.195 2.03057C27.5904 2.06287 27.9836 2.13419 28.362 2.32698C28.9265 2.6146 29.3854 3.07354 29.673 3.63803C29.8658 4.01641 29.9371 4.40963 29.9694 4.80497C30 5.17954 30 5.6343 30 6.16144V9.93334C30 10.4856 29.5523 10.9333 29 10.9333C28.4477 10.9333 28 10.4856 28 9.93334V6.2C28 5.62345 27.9992 5.25118 27.9761 4.96784C27.9539 4.69618 27.9162 4.59546 27.891 4.54601C27.7951 4.35785 27.6422 4.20487 27.454 4.109C27.4045 4.0838 27.3038 4.04613 27.0322 4.02393Z" fill="currentColor"/>
<path d="M3 21.0667C3.55229 21.0667 4 21.5144 4 22.0667V25.8C4 26.3766 4.00078 26.7488 4.02393 27.0322C4.04613 27.3038 4.0838 27.4045 4.109 27.454C4.20487 27.6422 4.35785 27.7951 4.54601 27.891C4.59546 27.9162 4.69618 27.9539 4.96784 27.9761C5.25118 27.9992 5.62345 28 6.2 28H9.5C10.0523 28 10.5 28.4477 10.5 29C10.5 29.5523 10.0523 30 9.5 30H6.16144C5.6343 30 5.17954 30 4.80497 29.9694C4.40963 29.9371 4.01641 29.8658 3.63803 29.673C3.07354 29.3854 2.6146 28.9265 2.32698 28.362C2.13419 27.9836 2.06287 27.5904 2.03057 27.195C1.99997 26.8205 1.99998 26.3657 2 25.8386V22.0667C2 21.5144 2.44772 21.0667 3 21.0667Z" fill="currentColor"/>
<path d="M29 21.0667C29.5523 21.0667 30 21.5144 30 22.0667V25.8386C30 26.3657 30 26.8205 29.9694 27.195C29.9371 27.5904 29.8658 27.9836 29.673 28.362C29.3854 28.9265 28.9265 29.3854 28.362 29.673C27.9836 29.8658 27.5904 29.9371 27.195 29.9694C26.8205 30 26.3657 30 25.8386 30H22.5C21.9477 30 21.5 29.5523 21.5 29C21.5 28.4477 21.9477 28 22.5 28H25.8C26.3766 28 26.7488 27.9992 27.0322 27.9761C27.3038 27.9539 27.4045 27.9162 27.454 27.891C27.6422 27.7951 27.7951 27.6422 27.891 27.454C27.9162 27.4045 27.9539 27.3038 27.9761 27.0322C27.9992 26.7488 28 26.3766 28 25.8V22.0667C28 21.5144 28.4477 21.0667 29 21.0667Z" fill="currentColor"/>
<path d="M11 9C11.5523 9 12 9.44772 12 10V12C12 12.5523 11.5523 13 11 13C10.4477 13 10 12.5523 10 12V10C10 9.44772 10.4477 9 11 9Z" fill="currentColor"/>
<path d="M22 10C22 9.44772 21.5523 9 21 9C20.4477 9 20 9.44772 20 10V12C20 12.5523 20.4477 13 21 13C21.5523 13 22 12.5523 22 12V10Z" fill="currentColor"/>
<path d="M16 8C16.5523 8 17 8.44772 17 9V14.7337C17 15.6395 16.6563 16.5743 15.9021 17.223C15.1316 17.8857 14.0606 18.1415 12.8263 17.9237C12.2824 17.8278 11.9193 17.3091 12.0152 16.7652C12.1112 16.2213 12.6299 15.8582 13.1737 15.9542C13.9394 16.0893 14.3684 15.904 14.5979 15.7067C14.8437 15.4953 15 15.151 15 14.7337V9C15 8.44772 15.4477 8 16 8Z" fill="currentColor"/>
<path d="M11.4343 20.0992C10.9368 19.8594 10.3391 20.0682 10.0992 20.5657C9.85938 21.0632 10.0682 21.6609 10.5657 21.9008C11.4577 22.3308 12.9664 22.8167 14.7146 22.9589C16.4684 23.1015 18.5301 22.903 20.4655 21.8851C20.9543 21.628 21.1421 21.0233 20.8851 20.5345C20.628 20.0457 20.0233 19.8579 19.5345 20.115C18.0264 20.9081 16.3707 21.0869 14.8767 20.9654C13.3771 20.8435 12.1076 20.4238 11.4343 20.0992Z" fill="currentColor"/>
</svg>`

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
                    {biometricType === 'fingerprint' ? (
                      <Feather name="shield" size={24} color={colors.primary} />
                    ) : (
                      <SvgXml
                        xml={FACE_ID_SVG.replace(/fill="#242729"/g, `fill="${colors.primary}"`)}
                        width={28}
                        height={28}
                      />
                    )}
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
