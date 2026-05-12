import { RF, ms } from '../util/responsive'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal,
  KeyboardAvoidingView, Platform, Animated, PanResponder,} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { BottomSheet } from '../components/BottomSheet'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import {
  fetchWalletInfo, fetchBankAccounts, addBankAccount, deleteBankAccount,
  submitWithdrawal, BankAccount, WalletInfo,
  fetchNigerianBanks, resolveAccountName, NigerianBank,
} from '../api/wallet'
import { useCountry } from '../context/CountryContext'

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

// ── Bank card — blue card design ─────────────────────────────────────────────
function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return acc
  const last4 = acc.slice(-4)
  // Format: **** ***X XXX
  return `**** ***${last4.slice(0, 1)} ${last4.slice(1)}`
}

function SwipeableBank({ bank, selected, onSelect, onDelete }: {
  bank: BankAccount
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const translateX = useRef(new Animated.Value(0)).current
  const DELETE_THRESHOLD = -80

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -100))
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < DELETE_THRESHOLD) {
        Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start()
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
      }
    },
  })).current

  function confirmDelete() {
    Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => onDelete())
  }

  return (
    <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[4], overflow: 'hidden', borderRadius: 20 }}>
      {/* Delete button behind */}
      <View style={sw.deleteBtn}>
        <TouchableOpacity onPress={confirmDelete} style={sw.deleteBtnInner} activeOpacity={0.8}>
          <Feather name="trash-2" size={20} color="#fff" />
          <Text style={sw.deleteBtnTxt}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Blue card */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity onPress={onSelect} activeOpacity={0.9} style={sw.cardOuter}>
          <LinearGradient
            colors={selected ? ['#1A3FD8', '#2B52EE'] : ['#2B3FD8', '#3B52EE']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={sw.card}>

            {/* Decorative circles */}
            <View style={sw.circle1} />
            <View style={sw.circle2} />

            {/* Bank name */}
            <Text style={sw.bankName}>{bank.bankName}</Text>

            {/* Masked account number */}
            <Text style={sw.accNumber}>{maskAccountNumber(bank.accountNumber)}</Text>

            {/* Chip icon — top right */}
            <View style={sw.chip}>
              <View style={sw.chipInner}>
                <View style={sw.chipLine} />
                <View style={sw.chipLine} />
                <View style={sw.chipLine} />
              </View>
            </View>

            {/* Selected indicator */}
            {selected && (
              <View style={sw.selectedBadge}>
                <Feather name="check" size={12} color="#fff" />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

export default function WithdrawScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const { selectedCountry } = useCountry()
  const localSym = selectedCountry?.currencySymbol ?? '₦'
  const insets = useSafeAreaInsets()

  const [wallet, setWallet]           = useState<WalletInfo | null>(null)
  const [banks, setBanks]             = useState<BankAccount[]>([])
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null)
  const [loading, setLoading]         = useState(true)
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  // Use country's withdrawFee, fallback to systemConfig, then 50
  const [withdrawalFee, setWithdrawalFee] = useState(selectedCountry?.withdrawFee ?? 50)
  const [hasWithdrawPin, setHasWithdrawPin] = useState(true) // assume true until loaded
  const [pinPromptOpen, setPinPromptOpen]   = useState(false)
  // Add bank form
  const [addBankOpen, setAddBankOpen] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newAccNumber, setNewAccNumber] = useState('')
  const [newAccName, setNewAccName]   = useState('')
  const [addingBank, setAddingBank]   = useState(false)
  // Bank picker + account resolution
  const [nigerianBanks, setNigerianBanks] = useState<NigerianBank[]>([])
  const [selectedNgBank, setSelectedNgBank] = useState<NigerianBank | null>(null)
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  const [bankSearch, setBankSearch]         = useState('')
  const [resolvingName, setResolvingName]   = useState(false)

  const load = useCallback(async () => {
    try {
      const [w, b] = await Promise.all([
        fetchWalletInfo(selectedCountry?.name),  // country-scoped wallet
        fetchBankAccounts(),
      ])
      setWallet(w)
      setBanks(b)
      setSelectedBank(b.find(x => x.isDefault) || b[0] || null)
      try {
        // Use country's withdrawFee first, fallback to systemConfig
        if (selectedCountry?.withdrawFee) {
          setWithdrawalFee(selectedCountry.withdrawFee)
        } else {
          const cfgRes = await client.get('/tuka/systemConfig/public')
          const fee = parseFloat(cfgRes.data?.data?.withdrawal_fee || '50')
          if (!isNaN(fee)) setWithdrawalFee(fee)
        }
      } catch { /* use default */ }
      // Check if withdrawal PIN is set
      try {
        const meRes = await client.get('/tuka/user/me')
        setHasWithdrawPin(!!meRes.data?.data?.hasWithdrawPassword)
      } catch { /* assume set */ }
    } catch { /* keep */ }
    finally { setLoading(false) }
  }, [selectedCountry?.name])

  // Reload when country switches
  useEffect(() => {
    setLoading(true)
    load()
  }, [selectedCountry?.name])

  // Refresh when returning from AddBankScreen or WithdrawPassword
  useEffect(() => {
    const unsubscribe = props.navigation.addListener('focus', () => {
      fetchBankAccounts().then(b => {
        setBanks(b)
        setSelectedBank(prev => b.find(x => x.id === prev?.id) || b.find(x => x.isDefault) || b[0] || null)
      })
      // Also refresh balance silently with current country
      fetchWalletInfo(selectedCountry?.name).then(w => setWallet(w)).catch(() => {})
      client.get('/tuka/user/me').then(res => {
        setHasWithdrawPin(!!res.data?.data?.hasWithdrawPassword)
      }).catch(() => {})
    })
    return unsubscribe
  }, [props.navigation])

  async function handleAddBank() {
    if (!selectedNgBank) { Alert.alert('Error', 'Please select a bank'); return }
    if (!newAccNumber.trim()) { Alert.alert('Error', 'Please enter account number'); return }
    if (!newAccName.trim()) { Alert.alert('Error', 'Account name could not be resolved. Check your account number.'); return }
    setAddingBank(true)
    try {
      await addBankAccount({
        bankName: selectedNgBank.name,
        accountNumber: newAccNumber.trim(),
        accountName: newAccName.trim(),
        isDefault: banks.length === 0,
      })
      const b = await fetchBankAccounts()
      setBanks(b)
      setSelectedBank(b[b.length - 1])
      setSelectedNgBank(null); setNewAccNumber(''); setNewAccName('')
      setAddBankOpen(false)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add bank account')
    } finally { setAddingBank(false) }
  }

  async function handleDeleteBank(id: number) {
    Alert.alert('Remove Bank', 'Remove this bank account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await deleteBankAccount(id)
          const b = await fetchBankAccounts()
          setBanks(b)
          if (selectedBank?.id === id) setSelectedBank(b[0] || null)
        } catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])
  }

  const canWithdraw = banks.length > 0 && !!selectedBank && !loading

  return (
    <>
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>

      <AppHeader title="Wallet" onBack={() => props.navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Balance card — clean white */}
        <View style={s.balanceCard}>
          <View style={s.balanceCardTop}>
            <Text style={s.balanceLbl}>Total Balance</Text>
            <TouchableOpacity
              onPress={() => props.navigation.navigate('WithdrawalHistory' as any)}
              activeOpacity={0.8}
              style={s.historyBtn}
            >
              <Feather name="clock" size={13} color={colors.primary} />
              <Text style={s.historyBtnTxt}>History</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[3] }} />
          ) : (
            <Text style={s.balanceAmt}>{localSym} {fmt(wallet?.balance)}</Text>
          )}
        </View>

        {/* Bank Card section */}
        <Text style={s.sectionLbl}>Bank Card ({banks.length})</Text>

        {/* Existing bank cards — swipe left to delete */}
        {banks.map(bank => (
          <SwipeableBank
            key={bank.id}
            bank={bank}
            selected={selectedBank?.id === bank.id}
            onSelect={() => setSelectedBank(bank)}
            onDelete={() => handleDeleteBank(bank.id)}
          />
        ))}

        {/* Add bank card row */}
        <TouchableOpacity style={s.addBankRow} onPress={() => props.navigation.navigate('AddBank' as any)} activeOpacity={0.8}>
          <View style={s.bankIcon}>
            <Feather name="credit-card" size={18} color="#fff" />
          </View>
          <Text style={s.addBankTxt}>Add bank card</Text>
          <Feather name="plus" size={20} color={colors.dark} />
        </TouchableOpacity>

      </ScrollView>

      {/* Withdraw button — same pattern as AddBank: fixed bottom, no border */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
        <TouchableOpacity
          style={[s.withdrawBtn, !canWithdraw && s.withdrawBtnOff]}
          onPress={() => {
            if (!canWithdraw) return
            if (!hasWithdrawPin) { setPinPromptOpen(true); return }
            props.navigation.navigate('WithdrawAmount' as any, {
              bank: selectedBank,
              balance: wallet?.balance || 0,
              fee: withdrawalFee,
            })
          }}
          disabled={!canWithdraw}
          activeOpacity={0.85}>
          <Text style={[s.withdrawBtnTxt, !canWithdraw && { color: '#AAAAAA' }]}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* ── Set PIN prompt — animated bottom sheet ── */}
      <BottomSheet visible={pinPromptOpen} onClose={() => setPinPromptOpen(false)}>
        <View style={{ paddingHorizontal: spacing[6], paddingBottom: spacing[8], alignItems: 'center' }}>
            <View style={pin.iconWrap}>
              <Feather name="lock" size={28} color={colors.primary} />
            </View>
            <Text style={pin.title}>Set Withdrawal PIN</Text>
            <Text style={pin.sub}>
              You need to set a 4-digit withdrawal PIN before you can withdraw funds. This PIN protects your wallet.
            </Text>
            <TouchableOpacity
              style={pin.btn}
              onPress={() => {
                setPinPromptOpen(false)
                props.navigation.navigate('WithdrawPassword' as any)
              }}
              activeOpacity={0.85}>
              <Text style={pin.btnTxt}>Set PIN Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pin.cancelBtn} onPress={() => setPinPromptOpen(false)} activeOpacity={0.7}>
              <Text style={pin.cancelTxt}>Later</Text>
            </TouchableOpacity>
        </View>
      </BottomSheet>

    </View>

      {/* ── Add bank modal ── */}
      <Modal visible={addBankOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={m.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setAddBankOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={m.sheet}>
              <View style={m.handle} />
              <View style={m.header}>
                <TouchableOpacity onPress={() => setAddBankOpen(false)} style={{ width: 32 }}>
                  <Feather name="chevron-left" size={22} color={colors.dark} />
                </TouchableOpacity>
                <Text style={m.title}>Add bank card</Text>
                <View style={{ width: 32 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: spacing[5] }} keyboardShouldPersistTaps="handled">

                {/* Warning banner */}
                <View style={m.warningBox}>
                  <Feather name="alert-circle" size={16} color={colors.warning} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text style={m.warningTxt}>
                    Please enter your real and valid bank card information. Otherwise, it may lead to the failure of your withdrawal or the inability to add the bank card normally.
                  </Text>
                </View>

                {/* Select bank */}
                <TouchableOpacity style={m.fieldBox} onPress={() => setBankPickerOpen(true)} activeOpacity={0.8}>
                  <Text style={selectedNgBank ? m.fieldVal : m.fieldPlaceholder}>
                    {selectedNgBank ? selectedNgBank.name : 'Select your bank'}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.muted} />
                </TouchableOpacity>

                {/* Account number */}
                <View style={m.fieldBox}>
                  <TextInput
                    style={m.fieldInput}
                    placeholder="Please enter account number"
                    placeholderTextColor={colors.subtle}
                    keyboardType="numeric"
                    maxLength={10}
                    value={newAccNumber}
                    onChangeText={setNewAccNumber}
                  />
                </View>

                {/* Account name — auto-resolved */}
                <View style={[m.fieldBox, { backgroundColor: colors.background }]}>
                  {resolvingName ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={newAccName ? m.fieldVal : m.fieldPlaceholder}>
                      {newAccName || 'Holder name (auto-filled)'}
                    </Text>
                  )}
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[m.submitBtn, (addingBank || !newAccName || !selectedNgBank) && m.submitBtnOff]}
                  onPress={handleAddBank}
                  disabled={addingBank || !newAccName || !selectedNgBank}
                  activeOpacity={0.85}>
                  {addingBank
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={[m.submitBtnTxt, (addingBank || !newAccName || !selectedNgBank) && m.submitBtnTxtOff]}>Submit</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Bank picker modal ── */}
      <Modal visible={bankPickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={m.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setBankPickerOpen(false)} />
          <View style={[m.sheet, { height: '70%' }]}>
            <View style={m.handle} />
            <View style={m.header}>
              <Text style={m.title}>Select Bank</Text>
              <TouchableOpacity onPress={() => setBankPickerOpen(false)}>
                <Feather name="x" size={22} color={colors.dark} />
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={m.searchBox}>
              <Feather name="search" size={16} color={colors.muted} />
              <TextInput
                style={m.searchInput}
                placeholder="Search bank..."
                placeholderTextColor={colors.subtle}
                value={bankSearch}
                onChangeText={setBankSearch}
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {nigerianBanks
                .filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
                .map(bank => (
                  <TouchableOpacity key={`${bank.code}_${bank.name}`} style={m.bankPickerRow}
                    onPress={() => { setSelectedNgBank(bank); setBankPickerOpen(false); setBankSearch('') }}
                    activeOpacity={0.7}>
                    <Text style={m.bankPickerName}>{bank.name}</Text>
                    {selectedNgBank?.code === bank.code && (
                      <Feather name="check" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

  </>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.background,
  },

  // Balance card — clean white, no gradient
  balanceCard: {
    marginHorizontal: spacing[4], marginTop: spacing[3], marginBottom: spacing[5],
    borderRadius: radius.xl, padding: spacing[5],
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  balanceLbl: { fontSize: typography.size.sm, color: colors.muted },
  balanceAmt: { fontSize: RF(36), fontWeight: typography.weight.extrabold, color: colors.dark, letterSpacing: -1 },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
  },
  historyBtnTxt: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  balanceStats: {
    flexDirection: 'row', marginTop: spacing[4],
    paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border,
  },
  balanceStat: { flex: 1, alignItems: 'center' },
  balanceStatDivider: { width: 1, backgroundColor: colors.border },
  balanceStatLbl: { fontSize: typography.size.xs, color: colors.muted, marginBottom: 3 },
  balanceStatVal: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.dark },

  // Section label
  sectionLbl: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.muted, paddingHorizontal: spacing[5], marginBottom: spacing[3],
  },

  // Bank rows
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    padding: spacing[4], ...shadow.sm,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  bankRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bankIcon: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center',
  },
  bankInfo: { flex: 1 },
  bankName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  bankAcc: { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },

  // Add bank row — matches reference exactly
  addBankRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    padding: spacing[4], ...shadow.sm,
  },
  addBankTxt: { flex: 1, fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.dark },

  // Settings link — blue like reference
  settingsLink: { alignItems: 'center', paddingVertical: spacing[3] },
  settingsLinkTxt: { fontSize: typography.size.base, color: '#2196F3', fontWeight: typography.weight.medium },

  // Transactions section
  txSection: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[4],
    padding: spacing[4], ...shadow.sm,
  },
  txHeader: { marginBottom: spacing[3] },
  txTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  txTabRow: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing[1], marginBottom: spacing[4],
  },
  txTabBtn: { flex: 1, paddingVertical: spacing[2] + 2, borderRadius: radius.md, alignItems: 'center' },
  txTabBtnOn: { backgroundColor: colors.primary },
  txTabTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },
  txTabTxtOn: { color: '#fff' },
  txDivider: { height: 1, backgroundColor: colors.background },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], gap: spacing[3] },
  txIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txType: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  txOrderNo: { fontSize: typography.size.xs, color: colors.muted, marginTop: 1 },
  txDate: { fontSize: typography.size.xs, color: colors.subtle, marginTop: 2 },
  txAmt: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, flexShrink: 0 },
  txEmpty: { alignItems: 'center', paddingVertical: spacing[8] },
  txEmptyTxt: { fontSize: typography.size.base, color: colors.muted },

  // Bottom bar — same pattern as AddBankScreen
  bottomBar: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  withdrawBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[5],
    alignItems: 'center',
    minHeight: ms(56),
  },
  withdrawBtnOff: { backgroundColor: colors.disabled },
  withdrawBtnTxt: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.bold, color: '#fff' },
})

const m = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    maxHeight: '85%', paddingBottom: spacing[8],
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },

  selectedBank: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    padding: spacing[3], marginBottom: spacing[4],
  },
  selectedBankTxt: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold },

  balRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  balLbl: { fontSize: typography.size.sm, color: colors.muted },
  balVal: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 60, marginBottom: spacing[5],
  },
  inputPrefix: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.dark, marginRight: spacing[2] },
  input: { flex: 1, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.dark },
  allBtn: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.secondary },

  feeBox: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing[3], marginBottom: spacing[4],
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] + 2 },
  feeLbl: { fontSize: typography.size.sm, color: colors.muted },
  feeVal: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.dark },

  fieldLbl: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.body, marginBottom: spacing[2] },
  textInput: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 52,
    fontSize: typography.size.base, color: colors.dark,
  },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  submitBtnOff: { backgroundColor: colors.disabled },
  submitBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  submitBtnTxtOff: { color: colors.disabledText },

  // Add bank form
  warningBox: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: colors.warningLight, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[5],
  },
  warningTxt: { flex: 1, fontSize: typography.size.sm, color: colors.warning, lineHeight: 20 },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 56, marginBottom: spacing[3],
  },
  fieldInput: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  fieldVal: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  fieldPlaceholder: { flex: 1, fontSize: typography.size.lg, color: colors.subtle },

  // Bank picker
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.background, borderRadius: radius.md,
    marginHorizontal: spacing[5], marginVertical: spacing[3],
    paddingHorizontal: spacing[4], height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.size.base, color: colors.dark },
  bankPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bankPickerName: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
})

// ── Bank card styles ──────────────────────────────────────────────────────────
const sw = StyleSheet.create({
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#2B3FD8',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  card: {
    height: 160,
    borderRadius: 20,
    padding: spacing[5],
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  cardOn: {},

  // Decorative circles
  circle1: {
    position: 'absolute', right: -20, top: -20,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circle2: {
    position: 'absolute', right: 40, top: 20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Text
  bankName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: '#fff',
    marginBottom: spacing[3],
  },
  accNumber: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
  },

  // Chip — top right
  chip: {
    position: 'absolute', top: spacing[5], right: spacing[5],
    width: 44, height: 34, borderRadius: 6,
    backgroundColor: '#D4A017',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  chipInner: { gap: 4, alignItems: 'center' },
  chipLine: {
    width: 32, height: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 1,
  },

  // Selected badge
  selectedBadge: {
    position: 'absolute', top: spacing[3], left: spacing[3],
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Delete button
  deleteBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 80, backgroundColor: colors.error,
    borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnInner: { alignItems: 'center', gap: spacing[1] },
  deleteBtnTxt: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: '#fff' },
})

const pin = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[6], paddingBottom: spacing[10],
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[5],
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
    alignSelf: 'center',
  },
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[3], textAlign: 'center',
  },
  sub: {
    fontSize: typography.size.base, color: colors.muted,
    textAlign: 'center', lineHeight: 22, marginBottom: spacing[6],
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
    width: '100%', marginBottom: spacing[3],
  },
  btnTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: '#fff' },
  cancelBtn: { paddingVertical: spacing[2], alignSelf: 'center' },
  cancelTxt: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center' },
})
