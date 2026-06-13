import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import * as ExpoClipboard from 'expo-clipboard'
import { AppHeader } from '../components/AppHeader'
import { BottomBackButton } from '../components/BottomBackButton'
import { AppRefreshControl } from '../components/Spinner'
import { GenericListSkeleton, WithdrawalHistorySkeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchMyWithdrawals, Withdrawal } from '../api/wallet'
import { useCountry } from '../context/CountryContext'
import { ms } from '../util/responsive'
import { cacheGet, TTL } from '../util/cache'

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function formatDateTime(str: string) {
  if (!str) return '—'
  const d = new Date(str)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'completed': case 'success': case 'paid': return '#22C55E'
    case 'rejected':  case 'failed':               return colors.error
    default:                                        return colors.warning
  }
}

function statusLabel(s: string) {
  switch (s?.toLowerCase()) {
    case 'completed': case 'paid': return 'success'
    case 'rejected':               return 'failed'
    case 'pending':                return 'pending'
    case 'processing':             return 'processing'
    default:                       return s || 'pending'
  }
}

export default function WithdrawalHistoryScreen(props: StackScreenProps<RootStackParams, 'WithdrawalHistory'>) {
  const { selectedCountry } = useCountry()
  const sym = selectedCountry?.currencySymbol ?? '₦'

  const cachedList = cacheGet<Withdrawal[]>(`withdrawals:${selectedCountry?.name || 'default'}`, TTL.orders)
  const [list, setList]             = useState<Withdrawal[]>(cachedList ?? [])
  const [loading, setLoading]       = useState(!cachedList)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh && !cachedList) setLoading(true)
    try {
      const data = await fetchMyWithdrawals(selectedCountry?.name, fresh => setList(fresh))
      setList(data)
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedCountry?.name])

  useEffect(() => { load() }, [selectedCountry?.name])

  async function copyId(id: string) {
    await ExpoClipboard.setStringAsync(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Stable renderItem — useCallback prevents new reference on every render
  const renderItem = useCallback(({ item }: { item: Withdrawal }) => {
    const sc = statusColor(item.status)
    const sl = statusLabel(item.status)
    const isCopied = copiedId === item.withdrawNo

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => props.navigation.navigate('WithdrawDetail' as any, { withdrawal: JSON.stringify(item) })}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <View style={s.idRow}>
            <Text style={s.idLabel}>ID: </Text>
            <Text style={s.idValue} numberOfLines={1}>{item.withdrawNo}</Text>
          </View>
          <TouchableOpacity
            onPress={() => copyId(item.withdrawNo)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <View style={[s.copyBtn, isCopied && s.copyBtnDone]}>
              <Feather name={isCopied ? 'check' : 'copy'} size={14} color={isCopied ? '#fff' : colors.primary} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={s.amtRow}>
          <View style={s.amtDot} />
          <Text style={s.amtLabel}>Price: </Text>
          <Text style={s.amtValue}>{sym} {fmt(item.amount)}</Text>
        </View>
        {item.bankName ? (
          <View style={s.bankRow}>
            <Feather name="credit-card" size={13} color={colors.muted} />
            <Text style={s.bankTxt} numberOfLines={1}>{item.bankName}  ·  {item.accountName}</Text>
          </View>
        ) : null}
        <View style={s.cardBottom}>
          <Text style={s.dateText}>{formatDateTime(item.createTime)}</Text>
          <Text style={[s.statusText, { color: sc }]}>{sl}</Text>
        </View>
      </TouchableOpacity>
    )
  }, [copiedId, sym, props.navigation])

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Withdrawal Record" onBack={() => props.navigation.goBack()} />

      {loading ? (
        <WithdrawalHistorySkeleton count={5} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true) }}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="arrow-up-circle" size={48} color={colors.border} />
              <Text style={s.emptyTxt}>No withdrawal records yet</Text>
              <Text style={s.emptySub}>Your withdrawal history will appear here</Text>
            </View>
          }
        />
      )}
      <BottomBackButton onPress={() => props.navigation.goBack()} />
    </View>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.background },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing[4], paddingBottom: spacing[8], gap: spacing[3] },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },

  // Top: ID + copy
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  idRow: {
    flexDirection: 'row', alignItems: 'center',
    flex: 1, marginRight: spacing[3],
  },
  idLabel: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
  },
  idValue: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
    flex: 1,
  },
  copyBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  copyBtnDone: { backgroundColor: colors.primary },

  // Amount
  amtRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing[2],
  },
  amtDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#F97316',
    marginRight: spacing[2],
  },
  amtLabel: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.semibold,
    color: colors.dark,
  },
  amtValue: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: '#EF4444',
  },

  // Bank info
  bankRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[2], marginBottom: spacing[2],
  },
  bankTxt: {
    fontSize: ms(typography.size.sm),
    color: colors.muted, flex: 1,
  },

  // Bottom: date + status
  cardBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
    marginTop: spacing[1],
  },
  dateText: {
    fontSize: ms(typography.size.sm),
    color: colors.muted,
  },
  statusText: {
    fontSize: ms(typography.size.sm),
    fontWeight: typography.weight.bold,
  },

  // Empty
  empty: {
    alignItems: 'center', paddingTop: 80, gap: spacing[3],
  },
  emptyTxt: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.semibold,
    color: colors.muted,
  },
  emptySub: {
    fontSize: ms(typography.size.sm),
    color: colors.subtle, textAlign: 'center',
  },
})
