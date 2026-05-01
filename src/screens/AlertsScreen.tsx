import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { ms } from '../util/responsive'

type Notification = {
  id: number
  title: string
  body: string
  screen: string | null
  isRead: boolean
  createTime: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${h}:${m} ${ampm} | ${mo}-${day}`
}

// ── Detail view ───────────────────────────────────────────────────────────────
function DetailView({ item, onBack, onAction }: {
  item: Notification
  onBack: () => void
  onAction: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Message</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={dv.card}>
        <Text style={dv.title}>{item.title}</Text>
        <Text style={dv.date}>{formatDate(item.createTime)}</Text>
        <View style={dv.divider} />
        <Text style={dv.body}>{item.body}</Text>
      </View>

      {item.screen ? (
        <View style={[dv.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity style={dv.btn} onPress={onAction} activeOpacity={0.85}>
            <Text style={dv.btnTxt}>Check Now</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

const dv = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginTop: spacing[4],
    padding: spacing[5], ...shadow.sm,
  },
  title:   { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  date:    { fontSize: ms(typography.size.sm), color: colors.muted, marginBottom: spacing[4] },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[4] },
  body:    { fontSize: ms(typography.size.base), color: colors.body, lineHeight: ms(24) },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  btn: {
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[5],
    alignItems: 'center', justifyContent: 'center',
    minHeight: ms(56),
  },
  btnTxt: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: '#fff' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AlertsScreen(props: StackScreenProps<RootStackParams, 'Alerts'>) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [selected, setSelected]           = useState<Notification | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await client.get('/tuka/user/notifications')
      setNotifications(res.data?.data || [])
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [])

  async function deleteItem(id: number) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    try { await client.delete(`/tuka/user/notifications/${id}`) } catch { /* ignore */ }
  }

  function handleView(item: Notification) {
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n))
    setSelected(item)
    try { client.put('/tuka/user/notifications/readAll') } catch { /* ignore */ }
  }

  function handleAction() {
    if (!selected?.screen) return
    setSelected(null)
    const screen = selected.screen

    try {
      if (screen.startsWith('Orders:')) {
        // Navigate to specific order — fetch it first
        const orderNo = screen.split(':')[1]
        client.get('/tuka/order/my', { params: { pageSize: 100 } }).then(res => {
          const orders = res.data?.rows || []
          const order = orders.find((o: any) => o.orderNo === orderNo)
          if (order) {
            props.navigation.navigate('OrderDetail' as any, { order: JSON.stringify(order) })
          } else {
            props.navigation.navigate('Orders' as any)
          }
        }).catch(() => props.navigation.navigate('Orders' as any))
      } else if (screen.startsWith('Withdraw:')) {
        const withdrawNo = screen.split(':')[1]
        client.get('/tuka/withdrawal/my').then(res => {
          const withdrawals = res.data?.rows || []
          const w = withdrawals.find((w: any) => w.withdrawNo === withdrawNo)
          if (w) {
            props.navigation.navigate('WithdrawDetail' as any, { withdrawal: JSON.stringify(w) })
          } else {
            props.navigation.navigate('Withdraw' as any)
          }
        }).catch(() => props.navigation.navigate('Withdraw' as any))
      } else {
        props.navigation.navigate(screen as any)
      }
    } catch { /* ignore */ }
  }

  if (selected) {
    return (
      <DetailView
        item={selected}
        onBack={() => setSelected(null)}
        onAction={handleAction}
      />
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Message</Text>
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => {
            setNotifications([])
            try { client.delete('/tuka/user/notifications/all') } catch { /* ignore */ }
          }}
          activeOpacity={0.7}>
          <Feather name="trash" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[16] }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => String(n.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Feather name="bell" size={32} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptySub}>Order updates and announcements will appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, !item.isRead && s.cardUnread]}
              onPress={() => handleView(item)}
              activeOpacity={0.75}>
              {/* Top */}
              <View style={s.cardTop}>
                <View style={s.iconCircle}>
                  <Feather name="bell" size={15} color="#fff" />
                </View>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}>
                  <Feather name="trash-2" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <Text style={s.cardBody} numberOfLines={2}>{item.body}</Text>

              {/* Bottom */}
              <View style={s.cardBottom}>
                <Text style={s.cardDate}>{formatDate(item.createTime)}</Text>
                <View style={s.viewBtn}>
                  <Text style={s.viewBtnTxt}>View Details</Text>
                  <Feather name="chevron-right" size={13} color={colors.muted} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3],
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: ms(typography.size.xl), fontWeight: typography.weight.extrabold, color: colors.dark },
  clearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[4], ...shadow.sm, marginBottom: spacing[3],
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2] },
  iconCircle: {
    width: ms(32), height: ms(32), borderRadius: ms(16),
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTitle:  { flex: 1, fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.dark },
  cardBody:   { fontSize: ms(typography.size.sm), color: colors.muted, lineHeight: ms(20), marginBottom: spacing[3] },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[3],
  },
  cardDate:   { fontSize: ms(typography.size.xs), color: colors.muted },
  viewBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewBtnTxt: { fontSize: ms(typography.size.sm), color: colors.muted },

  empty: {
    alignItems: 'center', paddingTop: spacing[16], gap: spacing[3],
  },
  emptyIcon: {
    width: ms(72), height: ms(72), borderRadius: ms(36),
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  emptyTitle: { fontSize: ms(typography.size.xl), fontWeight: typography.weight.bold, color: colors.dark },
  emptySub:   { fontSize: ms(typography.size.base), color: colors.muted, textAlign: 'center', lineHeight: ms(22) },
})
