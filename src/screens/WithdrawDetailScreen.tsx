import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Modal, Dimensions, Alert, ActivityIndicator,
} from 'react-native'
import * as ExpoClipboard from 'expo-clipboard'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import { fetchMyWithdrawals } from '../api/wallet'

const { width: W } = Dimensions.get('window')

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatDateTime(str: string) {
  if (!str) return '—'
  const d = new Date(str)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

const STATUS_STEPS = ['Pending', 'Processing', 'Completed']

function getStepIndex(status: string) {
  const s = status?.toLowerCase()
  if (s === 'completed') return 2
  if (s === 'processing') return 1
  return 0
}

export default function WithdrawDetailScreen(props: StackScreenProps<RootStackParams, 'WithdrawDetail'>) {
  const insets = useSafeAreaInsets()
  const initial = JSON.parse(props.route.params.withdrawal)
  const [w, setW] = useState(initial)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Refresh data to get latest receiptImage
  useEffect(() => {
    fetchMyWithdrawals().then(list => {
      const fresh = list.find((x: any) => x.id === initial.id)
      if (fresh) setW(fresh)
    }).catch(() => {})
  }, [])

  const stepIdx  = getStepIndex(w.status)
  const failed   = w.status?.toLowerCase() === 'rejected'
  const sc       = failed ? colors.error : stepIdx === 2 ? colors.success : colors.warning
  const sl       = failed ? 'Rejected' : stepIdx === 2 ? 'Completed' : 'Pending'
  const receiptUrl = w.receiptImage ? resolveImageUrl(w.receiptImage) : null

  function copyId() {
    ExpoClipboard.setStringAsync(w.withdrawNo)
    Alert.alert('Copied', 'Withdrawal ID copied')
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader title="Withdrawal Detail" onBack={() => props.navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}>

        {/* Timeline */}
        <View style={s.timeline}>
          {STATUS_STEPS.map((step, i) => {
            const isFailStep = failed && i === 2
            const active     = i <= stepIdx
            const isCurrent  = i === stepIdx && !failed && stepIdx < 2
            const dotBg      = isFailStep ? colors.error : active ? colors.primary : colors.border
            const lblColor   = isFailStep ? colors.error : active ? colors.dark : colors.subtle
            const isLast     = i === STATUS_STEPS.length - 1
            return (
              <React.Fragment key={step}>
                <View style={s.stepItem}>
                  <View style={[s.stepDot, { backgroundColor: dotBg }]}>
                    {active ? <Feather name={isFailStep ? 'x' : 'check'} size={13} color="#fff" /> : null}
                  </View>
                  <Text style={[s.stepLabel, { color: lblColor }]}>
                    {isFailStep ? 'Rejected' : step}
                  </Text>
                </View>
                {!isLast && (
                  <View style={[s.stepLine, { backgroundColor: i < stepIdx ? colors.primary : colors.border }]} />
                )}
              </React.Fragment>
            )
          })}
        </View>

        {/* Details card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Withdrawal Details</Text>

          {/* ID */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Withdrawal ID</Text>
            <TouchableOpacity onPress={copyId} activeOpacity={0.6} style={{ flex: 1 }}>
              <Text style={[s.rowVal, { fontSize: typography.size.sm }]} numberOfLines={1} adjustsFontSizeToFit>{w.withdrawNo}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.sep} />

          {[
            { lbl: 'Bank',        val: w.bankName },
            { lbl: 'Account No',  val: w.accountNumber || w.accountNo },
            { lbl: 'Holder',      val: w.accountName },
            { lbl: 'Amount',      val: `₦${fmt(w.amount)}`, accent: true },
            { lbl: 'Fee',         val: `₦${fmt(w.fee || 0)}` },
            { lbl: 'Date',        val: formatDateTime(w.createTime) },
          ].map((item, i, arr) => (
            <View key={item.lbl}>
              <View style={s.row}>
                <Text style={s.rowLbl}>{item.lbl}</Text>
                <Text style={[s.rowVal, item.accent && { color: colors.primary, fontWeight: typography.weight.extrabold }]}>
                  {item.val}
                </Text>
              </View>
              {i < arr.length - 1 && <View style={s.sep} />}
            </View>
          ))}

          {/* Remark from admin */}
          {w.remark ? (
            <>
              <View style={s.sep} />
              <View style={s.row}>
                <Text style={s.rowLbl}>Remark</Text>
                <Text style={[s.rowVal, { color: failed ? colors.error : colors.muted }]}>{w.remark}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Receipt from admin */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.cardTitle}>Payment Receipt</Text>
            {receiptUrl ? (
              <TouchableOpacity onPress={() => setReceiptOpen(true)} activeOpacity={0.7}>
                <Text style={s.viewLink}>View</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.noReceipt}>
                {stepIdx < 2 && !failed ? 'Pending payment' : 'No receipt'}
              </Text>
            )}
          </View>
          {receiptUrl && (
            <TouchableOpacity onPress={() => setReceiptOpen(true)} activeOpacity={0.85} style={{ marginTop: spacing[3] }}>
              <Image source={{ uri: receiptUrl }} style={s.receiptThumb} resizeMode="cover" />
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Receipt full-screen viewer */}
      {receiptOpen && receiptUrl && (
        <Modal visible animationType="fade" transparent={false}>
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 56, right: spacing[5], zIndex: 10 }}
              onPress={() => setReceiptOpen(false)}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
            <Image source={{ uri: receiptUrl }} style={{ width: W, height: W * 1.4, maxHeight: '85%' as any }} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  heroIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroInfo: { flex: 1 },
  heroAmt: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  heroBank: { fontSize: typography.size.base, color: colors.dark, fontWeight: typography.weight.semibold, marginTop: 2 },
  heroAcc: { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2, borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },

  timeline: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginTop: spacing[4], marginBottom: spacing[4],
    paddingVertical: spacing[5], paddingHorizontal: spacing[5],
    ...shadow.sm,
  },
  stepItem: { alignItems: 'center', gap: spacing[1] + 2 },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2, marginBottom: spacing[5] },
  stepLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    padding: spacing[5], ...shadow.sm,
  },
  cardTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[3] + 2 },
  rowLbl: { fontSize: typography.size.base, color: colors.muted, flexShrink: 0, marginRight: spacing[3] },
  rowVal: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark, textAlign: 'right', flex: 1 },
  sep: { height: 1, backgroundColor: colors.border },

  viewLink: { fontSize: typography.size.base, color: colors.secondary, fontWeight: typography.weight.bold },
  noReceipt: { fontSize: typography.size.sm, color: colors.subtle },
  receiptThumb: { width: '100%', height: 180, borderRadius: radius.lg },
})
