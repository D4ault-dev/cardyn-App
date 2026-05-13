import { RF, ms } from '../util/responsive'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { useCountry } from '../context/CountryContext'
import { hapticMedium } from '../util/haptics'

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return acc
  const last4 = acc.slice(-4)
  return `**** ***${last4.slice(0, 1)} ${last4.slice(1)}`
}

export default function WithdrawAmountScreen(props: StackScreenProps<RootStackParams, 'WithdrawAmount'>) {
  const { bank, balance, fee } = (props.route.params as any) || {}
  const { selectedCountry } = useCountry()
  const sym = selectedCountry?.currencySymbol ?? '₦'
  const insets = useSafeAreaInsets()
  const [amount, setAmount] = useState('')
  const [keyboardUp, setKeyboardUp] = useState(false)

  // Animate bank card height: full (110) → compact (0) when keyboard opens
  const cardHeight = useRef(new Animated.Value(110)).current
  const cardOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardUp(true)
        Animated.parallel([
          Animated.timing(cardHeight,  { toValue: 0,   duration: 220, useNativeDriver: false }),
          Animated.timing(cardOpacity, { toValue: 0,   duration: 160, useNativeDriver: false }),
        ]).start()
      }
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardUp(false)
        Animated.parallel([
          Animated.timing(cardHeight,  { toValue: 110, duration: 260, useNativeDriver: false }),
          Animated.timing(cardOpacity, { toValue: 1,   duration: 220, useNativeDriver: false }),
        ]).start()
      }
    )
    return () => { show.remove(); hide.remove() }
  }, [])

  const parsed   = parseFloat(amount) || 0
  const receive  = Math.max(0, parsed - (fee || 50))
  const MIN_WITHDRAW = 5000
  const canNext  = parsed >= MIN_WITHDRAW && parsed <= (balance || 0)

  function handleNext() {
    if (!canNext) return
    hapticMedium()
    props.navigation.navigate('WithdrawPin' as any, {
      bank,
      amount: parsed,
      fee: fee || 50,
      receive,
    })
  }

  return (
    <View style={[s.root, { paddingTop: getStatusBarHeight() }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}>

        <AppHeader title="Enter Amount" onBack={() => props.navigation.goBack()} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing[5], flexGrow: 1 }}>

          {/* Bank card — animates to 0 height when keyboard opens */}
          {bank && (
            <Animated.View style={{ height: cardHeight, opacity: cardOpacity, overflow: 'hidden', marginBottom: spacing[4] }}>
              <LinearGradient
                colors={['#1A3FD8', '#2B52EE']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.bankCard}>
                {/* Decorative circles */}
                <View style={s.circle1} />
                <View style={s.circle2} />
                {/* Chip */}
                <View style={s.chip}>
                  <View style={s.chipLine} />
                  <View style={s.chipLine} />
                  <View style={s.chipLine} />
                </View>
                {/* Text */}
                <View style={s.bankCardContent}>
                  <View>
                    <Text style={s.bankName} numberOfLines={1}>{bank.bankName}</Text>
                    <Text style={s.bankAcc}>{maskAccountNumber(bank.accountNumber)}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* Available balance row */}
          <View style={s.balRow}>
            <Text style={s.balLbl}>Available Balance</Text>
            <Text style={s.balVal}>{sym}{fmt(balance)}</Text>
          </View>
          <View style={s.minRow}>
            <Feather name="info" size={12} color={colors.muted} />
            <Text style={s.minTxt}>Min. withdrawal: {sym}5,000 · Fee: {sym}{fmt(fee || 50)}</Text>
          </View>

          {/* Amount input */}
          <View style={s.inputCard}>
            <Text style={s.inputPrefix}>{sym}</Text>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={colors.subtle}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={t => {
                const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                setAmount(clean)
              }}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => setAmount(String(balance || 0))}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.allBtn}>All</Text>
            </TouchableOpacity>
          </View>

          {/* Fee breakdown — only show when amount entered */}
          {parsed > 0 && (
            <View style={s.feeBox}>
              <View style={s.feeRow}>
                <Text style={s.feeLbl}>Amount</Text>
                <Text style={s.feeVal}>{sym}{fmt(parsed)}</Text>
              </View>
              <View style={s.feeRow}>
                <Text style={s.feeLbl}>Transaction Fee</Text>
                <Text style={[s.feeVal, { color: colors.error }]}>−{sym}{fmt(fee || 50)}</Text>
              </View>
              <View style={[s.feeRow, s.feeTotal]}>
                <Text style={s.feeTotalLbl}>You Receive</Text>
                <Text style={s.feeTotalVal}>{sym}{fmt(receive)}</Text>
              </View>
            </View>
          )}

          {/* Validation hint */}
          {parsed > 0 && !canNext && (
            <View style={s.hintRow}>
              <Feather name="alert-circle" size={13} color={colors.error} />
              <Text style={s.hintTxt}>
                {parsed > (balance || 0)
                  ? 'Amount exceeds your balance'
                  : `Minimum withdrawal is ${sym}${fmt(MIN_WITHDRAW)}`}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, minHeight: spacing[4] }} />
        </ScrollView>

        {/* Continue button — always visible above keyboard */}
        <View style={[s.footer, {
          paddingBottom: keyboardUp
            ? spacing[3]
            : Math.max(insets.bottom, 16) + spacing[3],
        }]}>
          <TouchableOpacity
            style={[s.nextBtn, !canNext && s.nextBtnOff]}
            onPress={handleNext}
            disabled={!canNext}
            activeOpacity={0.85}
            accessible
            accessibilityLabel={canNext ? 'Continue to withdrawal PIN' : 'Enter a valid amount to continue'}
            accessibilityRole="button">
            <Text style={[s.nextBtnTxt, !canNext && { color: '#AAAAAA' }]}>Continue</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Bank card — compact height (110), collapses when keyboard opens
  bankCard: {
    height: 110,
    borderRadius: 18,
    padding: spacing[4],
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    shadowColor: '#1A3FD8',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bankCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  circle1: {
    position: 'absolute', right: -20, top: -20,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circle2: {
    position: 'absolute', right: 40, top: 10,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chip: {
    position: 'absolute', top: spacing[4], right: spacing[4],
    width: 36, height: 28, borderRadius: 5,
    backgroundColor: '#D4A017',
    justifyContent: 'center', alignItems: 'center', gap: 3,
  },
  chipLine: { width: 26, height: 2, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 1 },
  bankName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.extrabold,
    color: '#fff',
    marginBottom: spacing[1],
  },
  bankAcc: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
  },

  // Balance row
  balRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing[1],
  },
  balLbl: { fontSize: typography.size.sm, color: colors.muted },
  balVal: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.dark },

  minRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    marginBottom: spacing[4],
  },
  minTxt: { fontSize: typography.size.xs, color: colors.muted },

  // Amount input
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.primary,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[4],
    gap: spacing[2],
    ...shadow.sm,
  },
  inputPrefix: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  input: {
    flex: 1,
    fontSize: RF(26),
    fontWeight: '700',
    color: colors.dark,
    paddingVertical: 0,
  },
  allBtn: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },

  // Fee breakdown
  feeBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadow.sm,
  },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing[1] + 2,
  },
  feeLbl:     { fontSize: typography.size.sm, color: colors.muted },
  feeVal:     { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.dark },
  feeTotal:   { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing[1], paddingTop: spacing[2] },
  feeTotalLbl:{ fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.dark },
  feeTotalVal:{ fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.primary },

  // Hint
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  hintTxt: { fontSize: typography.size.sm, color: colors.error, flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    minHeight: ms(52),
  },
  nextBtnOff: { backgroundColor: colors.disabled },
  nextBtnTxt: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: '#fff',
  },
})
