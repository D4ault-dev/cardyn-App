import { RF, ms } from '../util/responsive'
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { useCountry } from '../context/CountryContext'

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

  const parsed   = parseFloat(amount) || 0
  const receive  = Math.max(0, parsed - (fee || 50))
  const MIN_WITHDRAW = 5000
  const canNext  = parsed >= MIN_WITHDRAW && parsed <= (balance || 0)

  function handleNext() {
    if (!canNext) return
    props.navigation.navigate('WithdrawPin' as any, {
      bank,
      amount: parsed,
      fee: fee || 50,
      receive,
    })
  }

  return (
    <View style={[s.root, { paddingTop: getStatusBarHeight() }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: 'height' })}>

        <AppHeader title="Enter Amount" onBack={() => props.navigation.goBack()} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing[5], flexGrow: 1 }}>

          {/* Bank card — blue card design */}
          {bank && (
            <LinearGradient
              colors={['#2B3FD8', '#3B52EE']}
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
              <Text style={s.bankName}>{bank.bankName}</Text>
              <Text style={s.bankAcc}>{maskAccountNumber(bank.accountNumber)}</Text>
            </LinearGradient>
          )}

          {/* Available balance */}
          <View style={s.balRow}>
            <Text style={s.balLbl}>Available Balance</Text>
            <Text style={s.balVal}>{sym}{fmt(balance)}</Text>
          </View>
          <View style={s.minRow}>
            <Feather name="info" size={12} color={colors.muted} />
            <Text style={s.minTxt}>Minimum withdrawal: {sym}5,000.00</Text>
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
            <TouchableOpacity onPress={() => setAmount(String(balance || 0))} activeOpacity={0.7}>
              <Text style={s.allBtn}>All</Text>
            </TouchableOpacity>
          </View>

          {/* Fee breakdown */}
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

          <View style={{ flex: 1 }} />
        </ScrollView>

        {/* Next button — same pattern as AddBankScreen */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity
            style={[s.nextBtn, !canNext && s.nextBtnOff]}
            onPress={handleNext}
            disabled={!canNext}
            activeOpacity={0.85}>
            <Text style={[s.nextBtnTxt, !canNext && { color: '#AAAAAA' }]}>Continue</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background },
  bankCard:   {
    height: 160, borderRadius: 20, padding: spacing[5],
    marginBottom: spacing[5], overflow: 'hidden', position: 'relative',
    justifyContent: 'flex-end',
    shadowColor: '#2B3FD8', shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  circle1:    { position: 'absolute', right: -20, top: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  circle2:    { position: 'absolute', right: 40, top: 20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' },
  chip:       { position: 'absolute', top: spacing[5], right: spacing[5], width: 44, height: 34, borderRadius: 6, backgroundColor: '#D4A017', justifyContent: 'center', alignItems: 'center', gap: 4 },
  chipLine:   { width: 32, height: 2, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 1 },
  bankName:   { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: '#fff', marginBottom: spacing[2] },
  bankAcc:    { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: 'rgba(255,255,255,0.9)', letterSpacing: 2 },
  balRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] },
  balLbl:     { fontSize: typography.size.base, color: colors.muted },
  balVal:     { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  inputCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[4], marginBottom: spacing[4], gap: spacing[2], ...shadow.sm },
  inputPrefix:{ fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  input:      { flex: 1, fontSize: RF(28), fontWeight: '700', color: colors.dark, paddingVertical: 0 },
  allBtn:     { fontSize: typography.size.sm, fontWeight: typography.weight.extrabold, color: colors.primary, paddingHorizontal: spacing[3], paddingVertical: spacing[1], backgroundColor: colors.primaryLight, borderRadius: radius.full },
  feeBox:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[4], ...shadow.sm },
  feeRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[2] },
  feeLbl:     { fontSize: typography.size.base, color: colors.muted },
  feeVal:     { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  feeTotal:   { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing[1], paddingTop: spacing[3] },
  feeTotalLbl:{ fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.dark },
  feeTotalVal:{ fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  hintRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  hintTxt:    { fontSize: typography.size.sm, color: colors.error, flex: 1 },
  minRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[4], marginTop: -spacing[2] },
  minTxt:     { fontSize: typography.size.xs, color: colors.muted },
  footer:     { paddingHorizontal: spacing[4], paddingTop: spacing[3], backgroundColor: 'transparent' },
  nextBtn:    { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: spacing[5], alignItems: 'center', minHeight: ms(56) },
  nextBtnOff: { backgroundColor: colors.disabled },
  nextBtnTxt: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: '#fff' },
})
