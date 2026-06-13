import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Animated, ActivityIndicator,
  Dimensions, BackHandler, ScrollView, Image, Alert,
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
import { fetchCardCategories, resolveImageUrl } from '../api/cards'

const SCREEN_W = Dimensions.get('window').width

// Strip emojis and common emoji patterns from notification titles/bodies
function stripEmoji(str: string): string {
  if (!str) return str
  // Remove emoji unicode ranges
  return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F000}-\u{1FFFF}]/gu, '').trim()
}

// Extract card category name from notification body (e.g. "Your Razor Gold order...")
function extractCardName(title: string, body: string): string | null {
  const text = `${title} ${body}`
  // Order matters — more specific first
  const names = [
    'Google Play', 'Razer Gold', 'Razor Gold', 'Apple', 'iTunes',
    'Steam', 'Amazon', 'Xbox', 'Netflix', 'Spotify', 'PlayStation',
    'Roblox', 'Fortnite', 'Nintendo', 'Walmart', 'Target',
  ]
  for (const name of names) {
    if (text.toLowerCase().includes(name.toLowerCase())) return name
  }
  return null
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Notification = {
  id: number
  title: string
  body: string
  screen: string | null
  isRead: boolean
  createTime: string
}

type TabType = 'all' | 'system' | 'order' | 'withdrawal'

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
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d}d ago`
  const dt = new Date(dateStr)
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

function groupByDate(items: Notification[]): Array<{ key: string; data: Notification[] }> {
  const today = new Date()
  today.setHours(0,0,0,0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const groups: Record<string, Notification[]> = {}
  for (const n of items) {
    const d = new Date(n.createTime)
    d.setHours(0,0,0,0)
    let label: string
    if (d.getTime() === today.getTime()) label = 'Today'
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday'
    else {
      label = new Date(n.createTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return Object.entries(groups).map(([key, data]) => ({ key, data }))
}

// Determine notification type from screen field
function getNotifType(screen: string | null): 'order' | 'withdrawal' | 'system' | 'announcement' {
  if (!screen) return 'announcement'
  if (screen.startsWith('Orders:') || screen === 'Orders') return 'order'
  if (screen.startsWith('Withdraw:') || screen === 'Withdraw') return 'withdrawal'
  return 'system'
}

function getNotifStyle(type: ReturnType<typeof getNotifType>) {
  switch (type) {
    case 'order':       return { icon: 'shopping-bag' as const, bg: '#EEF4FF', color: '#3B82F6' }
    case 'withdrawal':  return { icon: 'credit-card' as const,  bg: '#FFF4E6', color: '#F59E0B' }
    case 'system':      return { icon: 'bell' as const,         bg: '#F0FFF4', color: '#10B981' }
    case 'announcement':return { icon: 'megaphone' as const,    bg: '#FFF0F6', color: '#EC4899' }
  }
}

// Card name → Feather icon + color to use as icon when we can identify the card
const CARD_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  'apple':       { icon: 'credit-card', bg: '#F5F5F5', color: '#111' },
  'itunes':      { icon: 'credit-card', bg: '#F5F5F5', color: '#111' },
  'steam':       { icon: 'credit-card', bg: '#EEF4FF', color: '#1B2838' },
  'razer gold':  { icon: 'credit-card', bg: '#F0FFF0', color: '#00D100' },
  'razor gold':  { icon: 'credit-card', bg: '#F0FFF0', color: '#00D100' },  // common misspelling
  'google play': { icon: 'credit-card', bg: '#FFF3F0', color: '#EA4335' },
  'amazon':      { icon: 'credit-card', bg: '#FFF8EE', color: '#FF9900' },
  'xbox':        { icon: 'credit-card', bg: '#F0FFF4', color: '#107C10' },
  'netflix':     { icon: 'credit-card', bg: '#FFF0F0', color: '#E50914' },
  'spotify':     { icon: 'credit-card', bg: '#F0FFF4', color: '#1DB954' },
}

// Also normalize card names for logo lookup — handles misspellings
function normalizeCardName(name: string): string {
  const n = name.toLowerCase().trim()
  if (n === 'razor gold') return 'razer gold'
  return n
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function NotifSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
      {[1,2,3,4,5].map(i => (
        <View key={i} style={[sk.row, { opacity: 1 - i * 0.12, marginBottom: spacing[3] }]}>
          <Skeleton circle size={ms(44)} />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Skeleton width="60%" height={14} radius={6} />
            <Skeleton width="88%" height={12} radius={5} />
            <Skeleton width="28%" height={10} radius={5} />
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
    padding: spacing[4], ...shadow.sm,
  },
})

// ── Notification row ──────────────────────────────────────────────────────────
function NotifRow({ item, onPress, onDelete, cardLogoMap }: {
  item: Notification
  onPress: () => void
  onDelete: () => void
  cardLogoMap: Record<string, string>
}) {
  const type  = getNotifType(item.screen)
  const style = getNotifStyle(type)

  // Strip emojis from title and body
  const cleanTitle = stripEmoji(item.title)
  const cleanBody  = stripEmoji(item.body)

  // Try to find the card's actual logo from the category map
  const cardName = extractCardName(cleanTitle, cleanBody)
  const normalizedName = cardName ? normalizeCardName(cardName) : null
  const cardLogoUrl = normalizedName ? (cardLogoMap[normalizedName] || cardLogoMap[cardName!.toLowerCase()] || null) : null
  const cardStyle = normalizedName && !cardLogoUrl ? (CARD_ICONS[normalizedName] || CARD_ICONS[cardName!.toLowerCase()] || null) : null
  const iconBg    = cardStyle?.bg    || style.bg
  const iconColor = cardStyle?.color || style.color

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[nr.card, !item.isRead && nr.cardUnread]}
    >
      {/* Left accent */}
      {!item.isRead && <View style={nr.leftAccent} />}

      {/* Icon — use real card logo if available, else Feather icon */}
      <View style={[nr.iconWrap, { backgroundColor: cardLogoUrl ? '#fff' : iconBg }]}>
        {cardLogoUrl ? (
          <Image source={{ uri: cardLogoUrl }} style={nr.cardLogoImg} resizeMode="cover" />
        ) : (
          <Feather name={style.icon} size={18} color={iconColor} />
        )}
      </View>

      {/* Content */}
      <View style={nr.content}>
        <View style={nr.topRow}>
          <Text style={[nr.title, !item.isRead && nr.titleUnread]} numberOfLines={1}>
            {cleanTitle}
          </Text>
          <Text style={nr.time}>{timeAgo(item.createTime)}</Text>
        </View>
        <Text style={nr.body} numberOfLines={2}>{cleanBody}</Text>
        {item.screen && (
          <Text style={nr.tap}>Tap to view →</Text>
        )}
      </View>

      {/* Unread dot */}
      {!item.isRead && <View style={nr.dot} />}
    </TouchableOpacity>
  )
}

const nr = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[3],
    ...shadow.sm,
    overflow: 'hidden',
  },
  cardUnread: { backgroundColor: '#F8FBFF' },
  leftAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: colors.primary, borderRadius: 2,
  },
  iconWrap: {
    width: ms(42), height: ms(42), borderRadius: ms(12),
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  cardLogoImg: {
    width: ms(36), height: ms(36), borderRadius: ms(8),
  },
  content: { flex: 1 },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing[1],
  },
  title: {
    flex: 1, fontSize: ms(14), fontWeight: '600' as any,
    color: colors.muted, marginRight: spacing[2],
  },
  titleUnread: { color: colors.dark, fontWeight: '700' as any },
  body: {
    fontSize: ms(13), color: colors.muted, lineHeight: ms(19),
    marginBottom: spacing[1],
  },
  time: { fontSize: ms(11), color: colors.subtle, flexShrink: 0 },
  tap: { fontSize: ms(11), color: colors.primary, fontWeight: '600' as any, marginTop: spacing[1] },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    alignSelf: 'center', flexShrink: 0,
  },
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
  const type  = getNotifType(item.screen)
  const style = getNotifStyle(type)

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
          <Text style={dp.headerTitle}>Notification Detail</Text>
          <View style={{ width: ms(36) }} />
        </View>

        {/* Icon + time */}
        <View style={dp.heroSection}>
          <View style={[dp.heroIcon, { backgroundColor: style.bg }]}>
            <Feather name={style.icon} size={32} color={style.color} />
          </View>
          <View style={[dp.typePill, { backgroundColor: style.bg }]}>
            <Text style={[dp.typePillTxt, { color: style.color }]}>
              {type === 'order' ? 'Order Update' : type === 'withdrawal' ? 'Withdrawal' : type === 'system' ? 'System' : 'Announcement'}
            </Text>
          </View>
          <Text style={dp.heroTime}>{timeAgo(item.createTime)}</Text>
        </View>

        {/* Title + body card */}
        <View style={dp.bodyCard}>
          <Text style={dp.bodyTitle}>{stripEmoji(item.title)}</Text>
          <View style={dp.divider} />
          <Text style={dp.bodyText}>{stripEmoji(item.body)}</Text>
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
    fontSize: RF(16), fontWeight: '700' as any, color: colors.dark,
  },
  heroSection: { alignItems: 'center', paddingVertical: spacing[6], paddingHorizontal: spacing[5] },
  heroIcon: {
    width: ms(80), height: ms(80), borderRadius: ms(24),
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3],
  },
  typePill: {
    borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[1] + 2,
    marginBottom: spacing[2],
  },
  typePillTxt: { fontSize: RF(12), fontWeight: '700' as any },
  heroTime: { fontSize: RF(13), color: colors.muted },
  bodyCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], padding: spacing[5], ...shadow.sm,
  },
  bodyTitle: {
    fontSize: RF(18), fontWeight: '800' as any, color: colors.dark,
    marginBottom: spacing[3], lineHeight: RF(26),
  },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[3] },
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
  btnTxt: { fontSize: RF(15), fontWeight: '800' as any, color: '#fff' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
const TABS: { key: TabType; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'system',     label: 'System' },
  { key: 'order',      label: 'Orders' },
  { key: 'withdrawal', label: 'Payments' },
]

export default function AlertsScreen(props: StackScreenProps<RootStackParams, 'Alerts'>) {
  const insets = useSafeAreaInsets()
  const cachedNotifs = cacheGet<Notification[]>('notifications:list', TTL.orders)
  const [notifications, setNotifications] = useState<Notification[]>(cachedNotifs ?? [])
  const [loading,       setLoading]       = useState(!cachedNotifs)
  const [refreshing,    setRefreshing]    = useState(false)
  const [selected,      setSelected]      = useState<Notification | null>(null)
  const [navigating,    setNavigating]    = useState(false)
  const [activeTab,     setActiveTab]     = useState<TabType>('all')
  // name (lowercase) → icon image URL
  const [cardLogoMap,   setCardLogoMap]   = useState<Record<string, string>>({})

  useFocusEffect(
    useCallback(() => { clearBadge().catch(() => {}) }, [])
  )

  // Load card category logos once
  useEffect(() => {
    fetchCardCategories()
      .then(cats => {
        const map: Record<string, string> = {}
        for (const c of cats) {
          if (c.name && c.icon) map[c.name.toLowerCase()] = resolveImageUrl(c.icon) || ''
        }
        setCardLogoMap(map)
      })
      .catch(() => {})
  }, [])

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

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    client.put('/tuka/user/notifications/readAll').catch(() => {})
  }

  function deleteItem(id: number) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    client.delete(`/tuka/user/notifications/${id}`).catch(() => {})
  }

  function deleteAll() {
    Alert.alert(
      'Clear All Notifications',
      'This will delete all your notifications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setNotifications([])
            client.delete('/tuka/user/notifications/all').catch(() => {})
          },
        },
      ]
    )
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
      } else if (screen === 'Withdraw')     { props.navigation.navigate('Withdraw' as any) }
      else if (screen === 'DailyBonus')     { props.navigation.navigate('DailyBonus' as any) }
      else if (screen === 'Leaderboard')    { props.navigation.navigate('Leaderboard' as any) }
      else                                  { props.navigation.navigate(screen as any) }
    } catch {
      props.navigation.navigate('Tabs' as any)
    } finally {
      setNavigating(false)
    }
  }

  // Filter by active tab
  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true
    const type = getNotifType(n.screen)
    if (activeTab === 'order')      return type === 'order'
    if (activeTab === 'withdrawal') return type === 'withdrawal'
    if (activeTab === 'system')     return type === 'system' || type === 'announcement'
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length
  const grouped     = groupByDate(filtered)

  // Build flat list items with section headers
  type ListItem =
    | { type: 'header'; label: string }
    | { type: 'notif';  data: Notification }

  const flatItems: ListItem[] = []
  for (const group of grouped) {
    flatItems.push({ type: 'header', label: group.key })
    for (const n of group.data) flatItems.push({ type: 'notif', data: n })
  }

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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} style={s.iconBtn} activeOpacity={0.7}>
                <Feather name="check-square" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={deleteAll}
              style={s.iconBtn}
              activeOpacity={0.7}
              disabled={notifications.length === 0}
            >
              <Feather name="trash-2" size={18} color={notifications.length > 0 ? colors.dark : colors.border} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
        >
          {TABS.map(tab => {
            const tabCount = tab.key === 'all' ? unreadCount
              : notifications.filter(n => !n.isRead && (
                  tab.key === 'order'      ? getNotifType(n.screen) === 'order' :
                  tab.key === 'withdrawal' ? getNotifType(n.screen) === 'withdrawal' :
                  tab.key === 'system'     ? (getNotifType(n.screen) === 'system' || getNotifType(n.screen) === 'announcement') :
                  false
                )).length
            const active = activeTab === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
                {tabCount > 0 && (
                  <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeTxt, active && s.tabBadgeTxtActive]}>{tabCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── Content ── */}
        {loading ? (
          <NotifSkeleton />
        ) : (
          <FlatList
            data={flatItems}
            keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : `n-${item.data.id}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing[4],
              paddingTop: spacing[2],
              paddingBottom: Math.max(insets.bottom, 16) + 60,
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
                  <Feather name="bell-off" size={32} color={colors.muted} />
                </View>
                <Text style={s.emptyTitle}>No notifications</Text>
                <Text style={s.emptySub}>Order updates and announcements will appear here</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return <Text style={s.dateHeader}>{item.label}</Text>
              }
              return (
                <NotifRow
                  item={item.data}
                  onPress={() => handleView(item.data)}
                  onDelete={() => deleteItem(item.data.id)}
                  cardLogoMap={cardLogoMap}
                />
              )
            }}
          />
        )}
      </View>

      {/* Detail panel slides over */}
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
    fontSize: RF(18), fontWeight: '800' as any, color: colors.dark,
  },
  badge: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { fontSize: RF(11), fontWeight: '700' as any, color: '#fff' },

  // Tabs
  tabs: {
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    gap: spacing[2], flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    height: 32,
  },
  tabActive: {
    backgroundColor: colors.dark, borderColor: colors.dark,
  },
  tabTxt: { fontSize: ms(13), fontWeight: '600' as any, color: colors.muted },
  tabTxtActive: { color: '#fff' },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeTxt: { fontSize: RF(10), fontWeight: '700' as any, color: colors.muted },
  tabBadgeTxtActive: { color: '#fff' },

  // Date group header
  dateHeader: {
    fontSize: ms(12), fontWeight: '700' as any,
    color: colors.muted, textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingBottom: spacing[2], paddingTop: spacing[1],
    paddingHorizontal: spacing[1],
  },

  // Empty state
  empty: {
    alignItems: 'center', paddingVertical: spacing[16],
    paddingHorizontal: spacing[8], gap: spacing[3],
  },
  emptyIcon: {
    width: ms(72), height: ms(72), borderRadius: ms(24),
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: RF(18), fontWeight: '700' as any, color: colors.dark,
  },
  emptySub: {
    fontSize: RF(14), color: colors.muted, textAlign: 'center', lineHeight: 22,
  },
})
