import { RF } from '../util/responsive'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../context/AuthContext'
import {
  fetchWalletInfo, fetchTransactions, WalletInfo, Transaction,
  fetchBankAccounts, addBankAccount, deleteBankAccount, submitWithdrawal,
  BankAccount,
} from '../api/wallet'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { useCountry } from '../context/CountryContext'

type Tab = 'giftcards' | 'withdrawals'

function formatDate(str: string) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

export default function WalletScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const { user } = useAuth()
  const { selectedCountry } = useCountry()
  const sym = selectedCountry?.currencySymbol ?? '₦'

  const [wallet, setWallet]           = useState<WalletInfo>({
    balance: 0, totalSales: 0, totalWithdrawn: 0,
    registerBonus: 0, totalEarned: 0,
    level: 1, exp: 0, realName: '', phone: '', inviteCode: '',
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [tab, setTab]                   = useState<Tab>('giftcards')
  const [balanceVisible, setBalanceVisible] = useState(true)

  // Withdrawal modal state
  const [withdrawOpen, setWithdrawOpen]     = useState(false)
  const [addBankOpen, setAddBankOpen]       = useState(false)
  const [banks, setBanks]                   = useState<BankAccount[]>([])
  const [selectedBank, setSelectedBank]     = useState<BankAccount | null>(null)
  const [withdrawAmt, setWithdrawAmt]       = useState('')
  const [withdrawing, setWithdrawing]       = useState(false)
  const [banksLoading, setBanksLoading]     = useState(false)
  // Add bank form
  const [newBankName, setNewBankName]       = useState('')
  const [newAccNumber, setNewAccNumber]     = useState('')
  const [newAccName, setNewAccName]         = useState('')
  const [addingBank, setAddingBank]         = useState(false)

  const load = useCallback(async () => {
    try {
      // Pass selected country — backend returns that country's wallet (0 if no activity)
      const [w, tx] = await Promise.all([
        fetchWalletInfo(selectedCountry?.name),
        fetchTransactions({ pageSize: 100 }),
      ])
      setWallet(w)
      setTransactions(tx.list)
    } catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedCountry?.name])

  // Reload when user logs in/out OR when country switches
  useEffect(() => {
    if (user.isPresent()) {
      setLoading(true)
      load()
    }
  }, [user, selectedCountry?.name])

  const onRefresh = () => { setRefreshing(true); load() }

  async function openWithdraw() {
    setBanksLoading(true)
    setWithdrawOpen(true)
    try {
      const list = await fetchBankAccounts()
      setBanks(list)
      setSelectedBank(list.find(b => b.isDefault) || list[0] || null)
    } catch { /* keep */ }
    finally { setBanksLoading(false) }
  }

  async function handleWithdraw() {
    const amt = parseFloat(withdrawAmt)
    if (!selectedBank) { Alert.alert('Error', 'Please select a bank account'); return }
    if (!amt || amt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return }
    if (amt > wallet.balance) { Alert.alert('Insufficient Balance', `Your balance is ${sym}${fmt(wallet.balance)}`); return }
    setWithdrawing(true)
    try {
      await submitWithdrawal({
        amount: amt,
        bankName: selectedBank.bankName,
        accountName: selectedBank.accountName,
        accountNo: selectedBank.accountNumber,
      })
      setWithdrawOpen(false)
      setWithdrawAmt('')
      Alert.alert('Submitted', 'Your withdrawal request has been submitted and is being processed.')
      load()
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Withdrawal failed. Please try again.')
    } finally { setWithdrawing(false) }
  }

  async function handleAddBank() {
    if (!newBankName.trim() || !newAccNumber.trim() || !newAccName.trim()) {
      Alert.alert('Error', 'Please fill in all fields'); return
    }
    setAddingBank(true)
    try {
      await addBankAccount({ bankName: newBankName.trim(), accountNumber: newAccNumber.trim(), accountName: newAccName.trim(), isDefault: banks.length === 0 })
      const list = await fetchBankAccounts()
      setBanks(list)
      setSelectedBank(list[list.length - 1])
      setNewBankName(''); setNewAccNumber(''); setNewAccName('')
      setAddBankOpen(false)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add bank account')
    } finally { setAddingBank(false) }
  }

  const giftCardTx   = transactions.filter(tx => !tx.type?.toLowerCase().includes('withdraw'))
  const withdrawalTx = transactions.filter(tx =>  tx.type?.toLowerCase().includes('withdraw'))

  // Backend now returns country-scoped wallet — no client-side filtering needed
  const displayBalance      = wallet.balance
  const displayTotalSales   = wallet.totalSales
  const displayWithdrawn    = wallet.totalWithdrawn
  const displayBonus        = wallet.registerBonus
  const displayGiftCardTx   = giftCardTx
  const displayWithdrawalTx = withdrawalTx
  const displayed = tab === 'giftcards' ? displayGiftCardTx : displayWithdrawalTx

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (!user.isPresent()) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.headerTitle}>Wallet</Text></View>
        <View style={s.guestWrap}>
          <View style={s.guestIcon}><Feather name="lock" size={32} color={colors.primary} /></View>
          <Text style={s.guestTitle}>Sign in to view your wallet</Text>
          <Text style={s.guestSub}>Track your balance and transaction history</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => props.navigation.navigate('Login')}>
            <Text style={s.loginBtnTxt}>Log In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Wallet</Text>
        <TouchableOpacity style={s.withdrawBtn} onPress={() => props.navigation.navigate('Withdraw' as any)} activeOpacity={0.85}>
          <Feather name="arrow-up-right" size={15} color={colors.primaryText} />
          <Text style={s.withdrawBtnTxt}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Balance card ── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.balanceCard}>

          <View style={s.balanceTopRow}>
            <Text style={s.balanceLabel}>Available Balance</Text>
            <TouchableOpacity onPress={() => setBalanceVisible(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={balanceVisible ? 'eye' : 'eye-off'} size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: spacing[3] }} />
          ) : (
            <Text style={s.balanceAmt}>
              {balanceVisible ? `${sym}${fmt(displayBalance)}` : '• • • • • •'}
            </Text>
          )}

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Total Sales</Text>
              <Text style={s.statVal}>{sym}{fmt(displayTotalSales)}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statLabel}>Withdrawn</Text>
              <Text style={s.statVal}>{sym}{fmt(displayWithdrawn)}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statLabel}>Bonus</Text>
              <Text style={s.statVal}>{sym}{fmt(displayBonus)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Transactions section ── */}
        <View style={s.txSection}>

          {/* Section header */}
          <View style={s.txHeader}>
            <Text style={s.txTitle}>Transactions</Text>
            <Text style={s.txCount}>
              {displayed.length} record{displayed.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Two-tab toggle */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'giftcards' && s.tabBtnOn]}
              onPress={() => setTab('giftcards')}
              activeOpacity={0.8}>
              <Feather
                name="credit-card"
                size={14}
                color={tab === 'giftcards' ? colors.primaryText : colors.muted}
                style={{ marginRight: spacing[1] + 2 }}
              />
              <Text style={[s.tabTxt, tab === 'giftcards' && s.tabTxtOn]}>Gift Cards</Text>
              {displayGiftCardTx.length > 0 && (
                <View style={[s.tabBadge, tab === 'giftcards' && s.tabBadgeOn]}>
                  <Text style={[s.tabBadgeTxt, tab === 'giftcards' && s.tabBadgeTxtOn]}>
                    {displayGiftCardTx.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.tabBtn, tab === 'withdrawals' && s.tabBtnOn]}
              onPress={() => setTab('withdrawals')}
              activeOpacity={0.8}>
              <Feather
                name="arrow-up-right"
                size={14}
                color={tab === 'withdrawals' ? colors.primaryText : colors.muted}
                style={{ marginRight: spacing[1] + 2 }}
              />
              <Text style={[s.tabTxt, tab === 'withdrawals' && s.tabTxtOn]}>Withdrawals</Text>
              {displayWithdrawalTx.length > 0 && (
                <View style={[s.tabBadge, tab === 'withdrawals' && s.tabBadgeOn]}>
                  <Text style={[s.tabBadgeTxt, tab === 'withdrawals' && s.tabBadgeTxtOn]}>
                    {displayWithdrawalTx.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[10] }} />
          ) : displayed.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Feather
                  name={tab === 'giftcards' ? 'credit-card' : 'arrow-up-right'}
                  size={28}
                  color={colors.muted}
                />
              </View>
              <Text style={s.emptyTxt}>
                {tab === 'giftcards' ? 'No gift card transactions yet' : 'No withdrawals yet'}
              </Text>
              <Text style={s.emptySub}>
                {tab === 'giftcards' ? 'Sell a gift card to get started' : 'Withdraw your balance to your bank'}
              </Text>
            </View>
          ) : (
            displayed.map((tx, i) => {
              const isWithdraw = tx.type?.toLowerCase().includes('withdraw')
              const amtColor   = isWithdraw ? colors.error : colors.success
              const iconName   = isWithdraw ? 'arrow-up-right' : 'arrow-down-left'
              const iconBg     = isWithdraw ? colors.errorLight : colors.successLight
              return (
                <View key={tx.id}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.txRow}>
                    {/* Icon */}
                    <View style={[s.txIcon, { backgroundColor: iconBg }]}>
                      <Feather name={iconName} size={17} color={amtColor} />
                    </View>

                    {/* Info */}
                    <View style={s.txInfo}>
                      <Text style={s.txType} numberOfLines={1}>
                        {tx.type || (isWithdraw ? 'Withdrawal' : 'Gift Card Sale')}
                      </Text>
                      {tx.orderNo ? (
                        <Text style={s.txOrderNo} numberOfLines={1}>{tx.orderNo}</Text>
                      ) : null}
                      <Text style={s.txDate}>{formatDate(tx.createTime)}</Text>
                    </View>

                    {/* Amount */}
                    <Text style={[s.txAmt, { color: amtColor }]}>
                      {isWithdraw ? '−' : '+'}{sym}{fmt(Math.abs(tx.amount ?? 0))}
                    </Text>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* ── Withdrawal Modal ── */}
      <Modal visible={withdrawOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={w.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setWithdrawOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={w.sheet}>
              <View style={w.handle} />
              <View style={w.sheetHeader}>
                <Text style={w.sheetTitle}>Withdraw</Text>
                <TouchableOpacity onPress={() => setWithdrawOpen(false)}>
                  <Feather name="x" size={22} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: spacing[5] }} keyboardShouldPersistTaps="handled">
                {/* Balance */}
                <View style={w.balanceRow}>
                  <Text style={w.balanceLbl}>Available Balance</Text>
                  <Text style={w.balanceVal}>{sym}{fmt(wallet.balance)}</Text>
                </View>

                {/* Amount */}
                <Text style={w.fieldLbl}>Amount</Text>
                <View style={w.inputRow}>
                  <Text style={w.inputPrefix}>{sym}</Text>
                  <TextInput
                    style={w.input}
                    placeholder="0.00"
                    placeholderTextColor={colors.subtle}
                    keyboardType="decimal-pad"
                    value={withdrawAmt}
                    onChangeText={setWithdrawAmt}
                  />
                  <TouchableOpacity onPress={() => setWithdrawAmt(String(wallet.balance))} activeOpacity={0.7}>
                    <Text style={w.allBtn}>All</Text>
                  </TouchableOpacity>
                </View>

                {/* Bank accounts */}
                <View style={w.bankHeader}>
                  <Text style={w.fieldLbl}>Bank Account</Text>
                  <TouchableOpacity onPress={() => setAddBankOpen(true)} activeOpacity={0.7}>
                    <Text style={w.addBankLink}>+ Add Bank</Text>
                  </TouchableOpacity>
                </View>

                {banksLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[4] }} />
                ) : banks.length === 0 ? (
                  <TouchableOpacity style={w.noBankBox} onPress={() => setAddBankOpen(true)} activeOpacity={0.8}>
                    <Feather name="plus-circle" size={20} color={colors.primary} />
                    <Text style={w.noBankTxt}>Add a bank account to withdraw</Text>
                  </TouchableOpacity>
                ) : (
                  banks.map(bank => (
                    <TouchableOpacity key={bank.id}
                      style={[w.bankCard, selectedBank?.id === bank.id && w.bankCardOn]}
                      onPress={() => setSelectedBank(bank)} activeOpacity={0.8}>
                      <View style={w.bankCardLeft}>
                        <Text style={w.bankName}>{bank.bankName}</Text>
                        <Text style={w.bankAcc}>{bank.accountNumber} · {bank.accountName}</Text>
                      </View>
                      {selectedBank?.id === bank.id && (
                        <View style={w.bankCheck}>
                          <Feather name="check" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[w.submitBtn, (withdrawing || !selectedBank || !withdrawAmt) && w.submitBtnOff]}
                  onPress={handleWithdraw}
                  disabled={withdrawing || !selectedBank || !withdrawAmt}
                  activeOpacity={0.85}>
                  {withdrawing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={w.submitBtnTxt}>Withdraw Now</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Add Bank Modal ── */}
      <Modal visible={addBankOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={w.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setAddBankOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={w.sheet}>
              <View style={w.handle} />
              <View style={w.sheetHeader}>
                <Text style={w.sheetTitle}>Add Bank Account</Text>
                <TouchableOpacity onPress={() => setAddBankOpen(false)}>
                  <Feather name="x" size={22} color={colors.dark} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: spacing[5] }} keyboardShouldPersistTaps="handled">
                {[
                  { lbl: 'Bank Name', val: newBankName, set: setNewBankName, placeholder: 'e.g. GTBank' },
                  { lbl: 'Account Number', val: newAccNumber, set: setNewAccNumber, placeholder: '10-digit account number', keyboard: 'numeric' as const },
                  { lbl: 'Account Name', val: newAccName, set: setNewAccName, placeholder: 'Account holder name' },
                ].map(f => (
                  <View key={f.lbl} style={{ marginBottom: spacing[4] }}>
                    <Text style={w.fieldLbl}>{f.lbl}</Text>
                    <TextInput
                      style={w.textInput}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.subtle}
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType={f.keyboard || 'default'}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  style={[w.submitBtn, addingBank && w.submitBtnOff]}
                  onPress={handleAddBank}
                  disabled={addingBank}
                  activeOpacity={0.85}>
                  {addingBank
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={w.submitBtnTxt}>Save Bank Account</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.dark },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2,
  },
  withdrawBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primaryText },

  // Balance card
  balanceCard: {
    marginHorizontal: spacing[4], marginTop: spacing[4], marginBottom: spacing[4],
    borderRadius: radius.xl, padding: spacing[5],
    shadowColor: colors.primaryDark, shadowOpacity: 0.2,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  balanceLabel: { fontSize: typography.size.sm, color: 'rgba(255,255,255,0.75)', fontWeight: typography.weight.medium },
  balanceAmt: { fontSize: RF(36), fontWeight: typography.weight.extrabold, color: '#fff', letterSpacing: -1, marginBottom: spacing[5] },
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg, padding: spacing[4],
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: spacing[2] },
  statLabel: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.65)' },
  statVal: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#fff' },

  // Transactions section
  txSection: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[4],
    ...shadow.sm,
  },
  txHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  txTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  txCount: { fontSize: typography.size.sm, color: colors.muted },

  // Two-tab toggle
  tabRow: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing[1], marginBottom: spacing[4],
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[2] + 2, borderRadius: radius.md,
    gap: spacing[1],
  },
  tabBtnOn: { backgroundColor: colors.primary },
  tabTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },
  tabTxtOn: { color: colors.primaryText },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeOn: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt: { fontSize: RF(10), fontWeight: typography.weight.bold, color: colors.muted },
  tabBadgeTxtOn: { color: '#fff' },

  // Transaction rows
  divider: { height: 1, backgroundColor: colors.background },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], gap: spacing[3] },
  txIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txType: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  txOrderNo: { fontSize: typography.size.xs, color: colors.muted, marginTop: 1 },
  txDate: { fontSize: typography.size.xs, color: colors.subtle, marginTop: 2 },
  txAmt: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, flexShrink: 0 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  emptyTxt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.muted },
  emptySub: { fontSize: typography.size.sm, color: colors.subtle, textAlign: 'center', paddingHorizontal: spacing[6] },

  // Guest
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8], gap: spacing[3] },
  guestIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark, textAlign: 'center' },
  guestSub: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center' },
  loginBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing[8], paddingVertical: spacing[4], marginTop: spacing[3] },
  loginBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primaryText },
})

// ── Withdrawal modal styles ───────────────────────────────────────────────────
const w = StyleSheet.create({
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
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },

  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[5],
  },
  balanceLbl: { fontSize: typography.size.sm, color: colors.primary },
  balanceVal: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },

  fieldLbl: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.body, marginBottom: spacing[2] },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 56, marginBottom: spacing[5],
  },
  inputPrefix: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark, marginRight: spacing[2] },
  input: { flex: 1, fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark },
  allBtn: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.secondary },

  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  addBankLink: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.secondary },

  noBankBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[4],
  },
  noBankTxt: { fontSize: typography.size.base, color: colors.primary, fontWeight: typography.weight.semibold },

  bankCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing[4], marginBottom: spacing[3],
  },
  bankCardOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bankCardLeft: { flex: 1 },
  bankName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  bankAcc: { fontSize: typography.size.sm, color: colors.muted, marginTop: 3 },
  bankCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  textInput: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 52,
    fontSize: typography.size.base, color: colors.dark,
  },

  submitBtn: {
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[4],
  },
  submitBtnOff: { backgroundColor: colors.muted },
  submitBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})
