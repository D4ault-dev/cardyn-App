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
import { SvgXml } from 'react-native-svg'

// ── Custom SVG icons ──────────────────────────────────────────────────────────
const SVG_QUESTION = `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.512 11.1618C11.3386 11.784 11.8707 12.3294 12.5166 12.3294C13.1147 12.3294 13.5779 11.8443 13.8357 11.3046C14.2292 10.4811 15.0415 9.99653 16.1399 9.99653C17.6264 9.99653 18.5921 10.8971 18.5921 12.1233C18.5921 13.2409 18.1255 13.8702 16.8126 14.6623C15.3261 15.5521 14.6642 16.5286 14.7184 18.0586C14.7244 18.5398 15.1162 18.9266 15.5974 18.9266H16.3135C16.679 18.9266 16.9754 18.6303 16.9754 18.2648C16.9754 17.1471 17.3768 16.572 18.7766 15.7474C20.2089 14.8902 21.0552 13.7075 21.0552 12.0256C21.0552 9.70356 19.1238 8 16.2592 8C13.6348 8 12.0293 9.30573 11.512 11.1618Z" fill="COLOR"/><path d="M15.7885 20.9C15.1506 20.9 14.6334 21.4171 14.6334 22.0551C14.6334 22.693 15.1506 23.2102 15.7885 23.2102C16.4265 23.2102 16.9436 22.693 16.9436 22.0551C16.9436 21.4171 16.4265 20.9 15.7885 20.9Z" fill="COLOR"/><path fill-rule="evenodd" clip-rule="evenodd" d="M30 16C30 23.732 23.732 30 16 30C8.26801 30 2 23.732 2 16C2 8.26801 8.26801 2 16 2C23.732 2 30 8.26801 30 16ZM16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z" fill="COLOR"/></svg>`

const SVG_POCKETBOOK = `<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.85599 7.99998L21.1535 3.79483C23.0749 3.2297 25 4.6701 25 6.67293V7.99998H25.2C26.8802 7.99998 27.7202 7.99998 28.362 8.32696C28.9265 8.61458 29.3854 9.07352 29.673 9.63801C30 10.2797 30 11.1198 30 12.8V25.2C30 26.8801 30 27.7202 29.673 28.362C29.3854 28.9264 28.9265 29.3854 28.362 29.673C27.7202 30 26.8802 30 25.2 30H6.8C5.11984 30 4.27976 30 3.63803 29.673C3.07354 29.3854 2.6146 28.9264 2.32698 28.362C2 27.7202 2 26.8801 2 25.2V12.8C2 11.1198 2 10.2797 2.32698 9.63801C2.6146 9.07352 3.07354 8.61458 3.63803 8.32696C4.27976 7.99998 5.11984 7.99998 6.8 7.99998H6.85599ZM21.7178 5.71356C22.3583 5.52519 23 6.00532 23 6.67293V7.99998H13.944L21.7178 5.71356ZM6.97681 9.99998C6.99194 10.0003 7.00711 10.0003 7.02232 9.99998H25.2C26.0731 9.99998 26.6076 10.0015 27.0075 10.0342C27.1938 10.0494 27.3065 10.0686 27.375 10.0847C27.4076 10.0923 27.4276 10.0988 27.4384 10.1026C27.4488 10.1063 27.454 10.109 27.454 10.109C27.6422 10.2048 27.7951 10.3578 27.891 10.546C27.891 10.546 27.8936 10.5512 27.8973 10.5616C27.9012 10.5724 27.9076 10.5924 27.9153 10.625C27.9314 10.6934 27.9505 10.8061 27.9658 10.9925C27.9984 11.3924 28 11.9269 28 12.8V17.5H23.5C22.9477 17.5 22.5 17.9477 22.5 18.5C22.5 19.0523 22.9477 19.5 23.5 19.5H28V25.2C28 26.0731 27.9984 26.6076 27.9658 27.0075C27.9505 27.1938 27.9314 27.3065 27.9153 27.375C27.9076 27.4075 27.9012 27.4276 27.8973 27.4384C27.8936 27.4488 27.891 27.454 27.891 27.454C27.7951 27.6421 27.6422 27.7951 27.454 27.891C27.454 27.891 27.4488 27.8936 27.4384 27.8973C27.4276 27.9012 27.4076 27.9076 27.375 27.9153C27.3065 27.9314 27.1938 27.9505 27.0075 27.9658C26.6076 27.9984 26.0731 28 25.2 28H6.8C5.92692 28 5.39239 27.9984 4.99247 27.9658C4.80617 27.9505 4.69345 27.9314 4.625 27.9153C4.59244 27.9076 4.57241 27.9012 4.56158 27.8973C4.55118 27.8936 4.54601 27.891 4.54601 27.891C4.35785 27.7951 4.20487 27.6421 4.10899 27.454C4.10899 27.454 4.10636 27.4488 4.10265 27.4384C4.09879 27.4276 4.09236 27.4075 4.08469 27.375C4.06857 27.3065 4.04945 27.1938 4.03423 27.0075C4.00156 26.6076 4 26.0731 4 25.2V12.8C4 11.9269 4.00156 11.3924 4.03423 10.9925C4.04945 10.8061 4.06857 10.6934 4.08469 10.625C4.09236 10.5924 4.09879 10.5724 4.10265 10.5616C4.10636 10.5512 4.10899 10.546 4.10899 10.546C4.20487 10.3578 4.35785 10.2048 4.54601 10.109C4.54601 10.109 4.55118 10.1063 4.56158 10.1026C4.57241 10.0988 4.59244 10.0923 4.625 10.0847C4.69345 10.0686 4.80617 10.0494 4.99247 10.0342C5.39239 10.0015 5.92692 9.99998 6.8 9.99998H6.97681Z" fill="COLOR"/></svg>`

function colorSvg(svg: string, color: string) {
  return svg.replace(/COLOR/g, color)
}

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
    case 'order':       return { icon: 'box' as const,            svgKey: null,           bg: '#F5F5F5', color: '#555' }
    case 'withdrawal':  return { icon: 'arrow-up-right' as const, svgKey: 'pocketbook',   bg: '#FFF8EE', color: '#F59E0B' }
    case 'system':      return { icon: 'bell' as const,           svgKey: 'question',     bg: '#F5F5F5', color: '#555' }
    case 'announcement':return { icon: 'bell' as const,           svgKey: 'question',     bg: '#F5F5F5', color: '#555' }
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

  // Determine which SVG to show for system/withdrawal if no card logo
  const svgXml = !cardLogoUrl && style.svgKey === 'question'
    ? colorSvg(SVG_QUESTION, iconColor)
    : !cardLogoUrl && style.svgKey === 'pocketbook'
    ? colorSvg(SVG_POCKETBOOK, iconColor)
    : null

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[nr.card, !item.isRead && nr.cardUnread]}
    >
      {/* Left accent */}
      {!item.isRead && <View style={nr.leftAccent} />}

      {/* Icon — card logo > SVG > Feather fallback */}
      <View style={[nr.iconWrap, { backgroundColor: cardLogoUrl ? '#fff' : '#F5F5F5', borderWidth: cardLogoUrl ? 1 : 0, borderColor: '#eee' }]}>
        {cardLogoUrl ? (
          <Image source={{ uri: cardLogoUrl }} style={nr.cardLogoImg} resizeMode="cover" />
        ) : svgXml ? (
          <SvgXml xml={svgXml} width={22} height={22} />
        ) : (
          <Feather name={style.icon} size={18} color="#666" />
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
function DetailPanel({ item, onBack, onAction, navigating, cardLogoMap }: {
  item: Notification
  onBack: () => void
  onAction: () => void
  navigating: boolean
  cardLogoMap: Record<string, string>
}) {
  const insets = useSafeAreaInsets()
  const slideX = useRef(new Animated.Value(SCREEN_W)).current
  const type  = getNotifType(item.screen)
  const style = getNotifStyle(type)

  // Card logo for order notifications
  const cleanTitle = stripEmoji(item.title)
  const cleanBody  = stripEmoji(item.body)
  const cardName = extractCardName(cleanTitle, cleanBody)
  const normalizedName = cardName ? normalizeCardName(cardName) : null
  const cardLogoUrl = normalizedName ? (cardLogoMap[normalizedName] || cardLogoMap[cardName!.toLowerCase()] || null) : null

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
          <View style={[dp.heroIcon, { backgroundColor: cardLogoUrl ? '#fff' : '#F5F5F5', borderWidth: cardLogoUrl ? 1 : 0, borderColor: '#eee' }]}>
            {cardLogoUrl ? (
              <Image source={{ uri: cardLogoUrl }} style={{ width: ms(56), height: ms(56), borderRadius: ms(12) }} resizeMode="cover" />
            ) : style.svgKey === 'question' ? (
              <SvgXml xml={colorSvg(SVG_QUESTION, '#555')} width={40} height={40} />
            ) : style.svgKey === 'pocketbook' ? (
              <SvgXml xml={colorSvg(SVG_POCKETBOOK, '#F59E0B')} width={40} height={40} />
            ) : (
              <Feather name={style.icon} size={32} color="#555" />
            )}
          </View>
          <View style={[dp.typePill, { backgroundColor: style.bg }]}>
            <Text style={[dp.typePillTxt, { color: style.color }]}>
              {type === 'order' ? 'Order Update' : type === 'withdrawal' ? 'Payment' : type === 'system' ? 'System' : 'Notice'}
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
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
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
          cardLogoMap={cardLogoMap}
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
    paddingHorizontal: spacing[4], paddingBottom: spacing[2],
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
