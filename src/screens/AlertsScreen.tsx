import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Animated, ActivityIndicator,
  Dimensions, BackHandler,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { AppRefreshControl } from '../components/Spinner'
import { Skeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { ms, RF } from '../util/responsive'
import { clearBadge } from '../util/pushNotifications'
import { swrFetch, cacheGet, TTL } from '../util/cache'

const SCREEN_W = Dimensions.get('window').width

// ── Types ─────────────────────────────────────────────────────────────────────
type Notification = {
  id: number
  title: string
  body: string
  screen: string | null
  isRead: boolean
  createTime: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  const dt = new Date(dateStr)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`
}

// Map notification type to icon + color — fixed bell on dark bg
function notifStyle() {
  return { icon: 'bell', bg: colors.dark, color: '#fff' }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function NotifSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
      {[1,2,3,4,5].map(i => (
        <View key={i} style={[sk.row, { opacity: 1 - i * 0.12 }]}>
          <Skeleton circle size={ms(44)} />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Skeleton width="65%" height={14} radius={6} />
            <Skeleton width="85%" height={12} radius={5} />
            <Skeleton width="30%" height={10} radius={5} />
          </View>
        </View>
      ))}
    </View>
  )
}
const sk = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[4], marginBottom: spacing[3], ...shadow.sm,
  },
})

// ── Notification row ──────────────────────────────────────────────────────────
function NotifRow({ item, onPress }: {
  item: Notification
  onPress: () => void
}) {
  const { icon, bg, color } = notifStyle()

  return (
    <View style={[nr.card, !item.isRead && nr.cardUnread, { marginBottom: spacing[3] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {/* Top row */}
        <View style={nr.topRow}>
          <View style={[nr.iconCircle, { backgroundColor: bg }]}>
            <Feather name={icon as any} size={15} color={color} />
          </View>
          <Text style={nr.title} numberOfLines={1}>{item.title}</Text>
          {/* Unread dot — only shown when unread */}
          {!item.isRead && <View style={nr.unreadDot} />}
        </View>

        {/* Body */}
        <Text style={nr.body} numberOfLines={2}>{item.body}</Text>

        {/* Divider */}
        <View style={nr.divider} />

        {/* Bottom row */}
        <View style={nr.bottomRow}>
          <Text style={nr.time}>{timeAgo(item.createTime)}</Text>
          <View style={nr.viewDetails}>
            <Text style={nr.viewDetailsTxt}>View Details</Text>
            <Feather name="chevron-right" size={14} color={colors.muted} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const nr = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    ...shadow.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], marginBottom: spacing[2],
  },
  iconCircle: {
    width: ms(34), height: ms(34), borderRadius: ms(17),
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent, flexShrink: 0,
  },
  body: {
    fontSize: ms(typography.size.sm), color: colors.muted,
    lineHeight: ms(20), marginBottom: spacing[3],
    paddingLeft: ms(34) + spacing[3],
  },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[3] },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: ms(typography.size.xs), color: colors.muted },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetailsTxt: { fontSize: ms(typography.size.sm), color: colors.muted },
})

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ item, onBack, onAction, navigating }: {
  item: Notification
  onBack: () => void
  onAction: () => void
  navigating: boolean
}) {
  const insets = useSafeAreaInsets()
  const slideX = useRef(new Animated.Value(SCREEN_W)).current
  const { icon, bg, color } = notifStyle()

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: 0, useNativeDriver: true,
      stiffness: 300, damping: 38, mass: 1,
    }).start()
  }, [])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack(); return true
    })
    return () => sub.remove()
  }, [])

  function handleBack() {
    Animated.timing(slideX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true }).start(onBack)
  }

  return (
    <Animated.View style={[dp.panel, { transform: [{ translateX: slideX }] }]}>
      <View style={{ flex: 1, paddingTop: getStatusBarHeight() }}>
        {/* Header */}
        <View style={dp.header}>
          <TouchableOpacity onPress={handleBack} style={dp.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={colors.dark} />
          </TouchableOpacity>
          <Text style={dp.headerTitle}>Notification</Text>
          <View style={{ width: ms(36) }} />
        </View>

        {/* Icon + title */}
        <View style={dp.heroSection}>
          <View style={[dp.heroIcon, { backgroundColor: bg }]}>
            <Feather name={icon as any} size={28} color={color} />
          </View>
          <Text style={dp.heroTitle}>{item.title}</Text>
          <Text style={dp.heroTime}>{timeAgo(item.createTime)}</Text>
        </View>

        {/* Body card */}
        <View style={dp.bodyCard}>
          <Text style={dp.bodyText}>{item.body}</Text>
        </View>

        {/* Action button */}
        {item.screen && (
          <View style={[dp.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
            <TouchableOpacity
              style={dp.btn}
              onPress={onAction}
              activeOpacity={0.85}
              disabled={navigating}
            >
              {navigating
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Text style={dp.btnTxt}>View Details</Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  )
}

const dp = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3], paddingBottom: spacing[2],
  },
  backBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: RF(17), fontWeight: typography.weight.extrabold, color: colors.dark,
  },
  heroSection: {
    alignItems: 'center', paddingVertical: spacing[6], paddingHorizontal: spacing[5],
  },
  heroIcon: {
    width: ms(72), height: ms(72), borderRadius: ms(22),
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4],
  },
  heroTitle: {
    fontSize: RF(20), fontWeight: typography.weight.extrabold,
    color: colors.dark, textAlign: 'center', marginBottom: spacing[2],
  },
  heroTime: { fontSize: RF(13), color: colors.muted },
  bodyCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], padding: spacing[5], ...shadow.sm,
  },
  bodyText: { fontSize: RF(15), color: colors.body, lineHeight: 24 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing[4],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  btnTxt: { fontSize: RF(15), fontWeight: typography.weight.extrabold, color: '#fff' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AlertsScreen(props: StackScreenProps<RootStackParams, 'Alerts'>) {
  const insets = useSafeAreaInsets()
  const cachedNotifs = cacheGet<Notification[]>('notifications:list', TTL.orders)
  const [notifications, setNotifications] = useState<Notification[]>(cachedNotifs ?? [])
  const [loading,       setLoading]       = useState(!cachedNotifs)
  const [refreshing,    setRefreshing]    = useState(false)
  const [selected,      setSelected]      = useState<Notification | null>(null)
  const [navigating,    setNavigating]    = useState(false)

  useFocusEffect(
    useCallback(() => { clearBadge().catch(() => {}) }, [])
  )

  const load = useCallback(async () => {
    try {
      const data = await swrFetch('notifications:list', TTL.orders, async () => {
        const res = await client.get('/tuka/user/notifications')
        const raw: any[] = res.data?.data || []
        return raw.map(n => ({ ...n, isRead: !!n.isRead }))
      }, fresh => setNotifications(fresh))
      setNotifications(data)
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [])

  function markRead(id: number) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    client.put('/tuka/user/notifications/readAll').catch(() => {})
  }

  function deleteItem(id: number) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    client.delete(`/tuka/user/notifications/${id}`).catch(() => {})
  }

  function deleteAll() {
    setNotifications([])
    client.delete('/tuka/user/notifications/all').catch(() => {})
  }

  function handleView(item: Notification) {
    markRead(item.id)
    setSelected(item)
  }

  async function handleAction() {
    if (!selected?.screen) return
    setNavigating(true)
    const screen = selected.screen
    setSelected(null)
    try {
      if (screen.startsWith('Orders:')) {
        const orderNo = screen.split(':')[1]
        const res = await client.get('/tuka/order/my', { params: { pageSize: 100 } })
        const order = (res.data?.rows || []).find((o: any) => o.orderNo === orderNo)
        if (order) props.navigation.navigate('OrderDetail' as any, { order: JSON.stringify(order) })
        else props.navigation.navigate('Orders' as any)
      } else if (screen.startsWith('Withdraw:')) {
        const withdrawNo = screen.split(':')[1]
        const res = await client.get('/tuka/withdrawal/my')
        const w = (res.data?.rows || []).find((w: any) => w.withdrawNo === withdrawNo)
        if (w) props.navigation.navigate('WithdrawDetail' as any, { withdrawal: JSON.stringify(w) })
        else props.navigation.navigate('Withdraw' as any)
      } else if (screen.startsWith('ArticleDetail:')) {
        const articleId = parseInt(screen.split(':')[1], 10)
        if (!isNaN(articleId)) props.navigation.navigate('ArticleDetail' as any, { articleId })
        else props.navigation.navigate('Tabs' as any)
      } else if (screen === 'Withdraw') {
        props.navigation.navigate('Withdraw' as any)
      } else if (screen === 'DailyBonus') {
        props.navigation.navigate('DailyBonus' as any)
      } else if (screen === 'Leaderboard') {
        props.navigation.navigate('Leaderboard' as any)
      } else {
        props.navigation.navigate(screen as any)
      }
    } catch {
      props.navigation.navigate('Tabs' as any)
    } finally {
      setNavigating(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.iconBtn}>
            <Feather name="arrow-left" size={20} color={colors.dark} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={deleteAll}
            style={s.iconBtn}
            activeOpacity={0.7}
            disabled={notifications.length === 0}
          >
            <Feather
              name="trash-2"
              size={18}
              color={notifications.length > 0 ? colors.dark : colors.border}
            />
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        {loading ? (
          <NotifSkeleton />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={n => String(n.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing[4],
              paddingTop: spacing[2],
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            }}
            refreshControl={
              <AppRefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load() }}
              />
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Feather name="bell-off" size={28} color={colors.muted} />
                </View>
                <Text style={s.emptyTitle}>All caught up</Text>
                <Text style={s.emptySub}>Order updates and announcements will appear here</Text>
              </View>
            }
            renderItem={({ item }) => (
              <NotifRow
                item={item}
                onPress={() => handleView(item)}
              />
            )}
          />
        )}
      </View>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          item={selected}
          onBack={() => setSelected(null)}
          onAction={handleAction}
          navigating={navigating}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3], paddingBottom: spacing[3],
  },
  iconBtn: {
    width: ms(36), height: ms(36),
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing[2],
  },
  headerTitle: {
    fontSize: RF(18), fontWeight: typography.weight.extrabold, color: colors.dark,
  },
  badge: {
    backgroundColor: colors.error, borderRadius: radius.full,
    minWidth: ms(18), height: ms(18),
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeTxt: { fontSize: RF(10), fontWeight: typography.weight.extrabold, color: '#fff' },

  empty: {
    alignItems: 'center', paddingTop: spacing[20], gap: spacing[3],
    paddingHorizontal: spacing[8],
  },
  emptyIcon: {
    width: ms(64), height: ms(64), borderRadius: ms(32),
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    marginBottom: spacing[2],
  },
  emptyTitle: {
    fontSize: RF(18), fontWeight: typography.weight.bold, color: colors.dark,
  },
  emptySub: {
    fontSize: RF(14), color: colors.muted,
    textAlign: 'center', lineHeight: 22,
  },
})
