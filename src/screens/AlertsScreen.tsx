import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Animated, ActivityIndicator,
  Dimensions, PanResponder, BackHandler, Platform} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { ms, RF } from '../util/responsive'
import { clearBadge } from '../util/pushNotifications'

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
function stripEmoji(str: string): string {
  return str.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u2600-\u27BF]/g, '').trim()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d    = new Date(dateStr)
  const h    = d.getHours()
  const min  = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh   = String(h % 12 || 12).padStart(2, '0')
  const mo   = String(d.getMonth() + 1).padStart(2, '0')
  const day  = String(d.getDate()).padStart(2, '0')
  return `${hh}:${min} ${ampm} | ${mo}-${day}`
}

// ── Notification card ─────────────────────────────────────────────────────────
function NotifCard({ item, onPress, onDelete }: {
  item: Notification
  onPress: () => void
  onDelete: () => void
}) {
  const heightAnim = useRef(new Animated.Value(1)).current

  function handleDelete() {
    Animated.timing(heightAnim, { toValue: 0, duration: 240, useNativeDriver: false }).start(onDelete)
  }

  return (
    <Animated.View style={{ opacity: heightAnim, marginBottom: spacing[3] }}>
      <TouchableOpacity
        style={[nc.card, !item.isRead && nc.cardUnread]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {/* Top row */}
        <View style={nc.topRow}>
          <View style={nc.iconCircle}>
            <Feather name="bell" size={15} color="#fff" />
          </View>
          <Text style={nc.title} numberOfLines={1}>{item.title}</Text>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={17} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <Text style={nc.body} numberOfLines={2}>{item.body}</Text>

        {/* Divider */}
        <View style={nc.divider} />

        {/* Bottom row */}
        <View style={nc.bottomRow}>
          <Text style={nc.time}>{formatDate(item.createTime)}</Text>
          <View style={nc.viewDetails}>
            <Text style={nc.viewDetailsTxt}>View Details</Text>
            <Feather name="chevron-right" size={14} color={colors.muted} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const nc = StyleSheet.create({
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
    backgroundColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: {
    flex: 1,
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  body: {
    fontSize: ms(typography.size.sm), color: colors.muted,
    lineHeight: ms(20), marginBottom: spacing[3],
    paddingLeft: ms(34) + spacing[3],
  },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[3] },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time:      { fontSize: ms(typography.size.xs), color: colors.muted },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetailsTxt: { fontSize: ms(typography.size.sm), color: colors.muted },
})

// ── Detail panel — slides in from right, swipe-back to dismiss ────────────────
function DetailPanel({ item, onBack, onAction, navigating }: {
  item: Notification
  onBack: () => void
  onAction: () => void
  navigating: boolean
}) {
  const insets   = useSafeAreaInsets()
  const slideX   = useRef(new Animated.Value(SCREEN_W)).current
  const overlayO = useRef(new Animated.Value(0)).current

  // Slide in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0, useNativeDriver: true,
        stiffness: 300, damping: 38, mass: 1,
      }),
      Animated.timing(overlayO, { toValue: 0.25, duration: 260, useNativeDriver: true }),
    ]).start()
  }, [])

  // Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack()
      return true
    })
    return () => sub.remove()
  }, [])

  function handleBack() {
    Animated.parallel([
      Animated.timing(slideX,   { toValue: SCREEN_W, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayO, { toValue: 0,         duration: 220, useNativeDriver: true }),
    ]).start(onBack)
  }

  // Swipe-right-to-go-back pan responder
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) {
          slideX.setValue(g.dx)
          overlayO.setValue(Math.max(0, 0.25 - (g.dx / SCREEN_W) * 0.25))
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_W * 0.35 || g.vx > 0.5) {
          handleBack()
        } else {
          Animated.parallel([
            Animated.spring(slideX,   { toValue: 0, useNativeDriver: true, stiffness: 300, damping: 38, mass: 1 }),
            Animated.timing(overlayO, { toValue: 0.25, duration: 180, useNativeDriver: true }),
          ]).start()
        }
      },
    })
  ).current

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim overlay behind the panel */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayO }]}
        pointerEvents="none"
      />

      {/* Sliding panel */}
      <Animated.View
        style={[dp.panel, { transform: [{ translateX: slideX }] }]}
        {...pan.panHandlers}
      >
        <View style={{ flex: 1, paddingTop: getStatusBarHeight() }}>
          {/* Header */}
          <View style={dp.header}>
            <TouchableOpacity onPress={handleBack} style={dp.backBtn}>
              <Feather name="chevron-left" size={22} color={colors.dark} />
            </TouchableOpacity>
            <Text style={dp.headerTitle}>Message</Text>
            <View style={{ width: ms(36) }} />
          </View>

          {/* Card */}
          <View style={dp.card}>
            <Text style={dp.title}>{item.title}</Text>
            <Text style={dp.date}>{formatDate(item.createTime)}</Text>
            <View style={dp.divider} />
            <Text style={dp.body}>{item.body}</Text>
          </View>

          {/* Check Now button */}
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
                  : <Text style={dp.btnTxt}>Check Now</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

const dp = StyleSheet.create({
  panel: {
    position: 'absolute', top: 0, bottom: 0,
    left: 0, right: 0,
    backgroundColor: colors.background,
    // Subtle left shadow so it looks like it's on top
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  backBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: ms(typography.size.xl),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginTop: spacing[4],
    padding: spacing[5],
    ...shadow.sm,
  },
  title:   { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[1] },
  date:    { fontSize: ms(typography.size.sm), color: colors.muted, marginBottom: spacing[4] },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[4] },
  body:    { fontSize: ms(typography.size.base), color: colors.muted, lineHeight: ms(24) },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[5], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  btn: {
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center', justifyContent: 'center', minHeight: ms(52),
  },
  btnTxt: { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: '#fff' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AlertsScreen(props: StackScreenProps<RootStackParams, 'Alerts'>) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [selected,      setSelected]      = useState<Notification | null>(null)
  const [navigating,    setNavigating]    = useState(false)

  useFocusEffect(
    useCallback(() => { clearBadge().catch(() => {}) }, [])
  )

  const load = useCallback(async () => {
    try {
      const res = await client.get('/tuka/user/notifications')
      const raw: any[] = res.data?.data || []
      setNotifications(raw.map(n => ({
        ...n,
        title: stripEmoji(n.title || ''),
        isRead: !!n.isRead,
      })))
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
      // ── Order notifications → OrderDetail (order tracking page) ──────────
      if (screen.startsWith('Orders:')) {
        const orderNo = screen.split(':')[1]
        const res = await client.get('/tuka/order/my', { params: { pageSize: 100 } })
        const order = (res.data?.rows || []).find((o: any) => o.orderNo === orderNo)
        if (order) {
          props.navigation.navigate('OrderDetail' as any, { order: JSON.stringify(order) })
        } else {
          // Order not found — go to orders list
          props.navigation.navigate('Orders' as any)
        }

      // ── Withdrawal notifications → WithdrawDetail or Withdraw ────────────
      } else if (screen.startsWith('Withdraw:')) {
        const withdrawNo = screen.split(':')[1]
        const res = await client.get('/tuka/withdrawal/my')
        const w = (res.data?.rows || []).find((w: any) => w.withdrawNo === withdrawNo)
        if (w) {
          props.navigation.navigate('WithdrawDetail' as any, { withdrawal: JSON.stringify(w) })
        } else {
          props.navigation.navigate('Withdraw' as any)
        }

      // ── Discovery post → ArticleDetail screen ────────────────────────────
      } else if (screen.startsWith('ArticleDetail:')) {
        const articleId = parseInt(screen.split(':')[1], 10)
        if (!isNaN(articleId)) {
          props.navigation.navigate('ArticleDetail' as any, { articleId })
        } else {
          props.navigation.navigate('Tabs' as any)
        }

      // ── Welcome / balance / wallet notifications → Withdraw screen ────────
      } else if (screen === 'Withdraw') {
        props.navigation.navigate('Withdraw' as any)

      // ── Daily bonus → DailyBonus screen ──────────────────────────────────
      } else if (screen === 'DailyBonus') {
        props.navigation.navigate('DailyBonus' as any)

      // ── Leaderboard → Leaderboard screen ─────────────────────────────────
      } else if (screen === 'Leaderboard') {
        props.navigation.navigate('Leaderboard' as any)

      // ── Wallet / balance → Wallet tab ─────────────────────────────────────
      } else if (screen === 'Wallet') {
        props.navigation.navigate('Tabs' as any)

      // ── Fallback — try to navigate directly ───────────────────────────────
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

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
            <Feather name="chevron-left" size={22} color={colors.dark} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={deleteAll}
            style={s.trashBtn}
            activeOpacity={0.7}
            disabled={notifications.length === 0}
          >
            <Feather name="trash-2" size={20} color={notifications.length > 0 ? colors.dark : colors.border} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ padding: spacing[4], gap: spacing[3] }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[s.skeleton, { opacity: 1 - i * 0.2 }]} />
            ))}
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={n => String(n.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing[4], paddingBottom: 40 }}
            refreshControl={
              <AppRefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load() }}
              />
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Feather name="bell" size={32} color={colors.primary} />
                </View>
                <Text style={s.emptyTitle}>No notifications yet</Text>
                <Text style={s.emptySub}>
                  Order updates and announcements{'\n'}will appear here
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <NotifCard
                item={item}
                onPress={() => handleView(item)}
                onDelete={() => deleteItem(item.id)}
              />
            )}
          />
        )}
      </View>

      {/* Detail panel — rendered on top, slides in from right */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  backBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing[2],
  },
  headerTitle: {
    fontSize: ms(typography.size.xl),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  unreadBadge: {
    backgroundColor: colors.error, borderRadius: radius.full,
    minWidth: ms(20), height: ms(20),
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadBadgeTxt: { fontSize: RF(10), fontWeight: typography.weight.extrabold, color: '#fff' },
  trashBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },

  skeleton: { height: ms(100), backgroundColor: colors.border, borderRadius: radius.xl },

  empty: { alignItems: 'center', paddingTop: spacing[20], gap: spacing[3] },
  emptyIconWrap: {
    width: ms(80), height: ms(80), borderRadius: ms(40),
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2],
  },
  emptyTitle: { fontSize: ms(typography.size.xl), fontWeight: typography.weight.bold, color: colors.dark },
  emptySub:   { fontSize: ms(typography.size.base), color: colors.muted, textAlign: 'center', lineHeight: ms(22) },
})
