import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image,
  Modal, FlatList, Dimensions, Animated, TextInput, Alert,
  Keyboard, TouchableWithoutFeedback,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useDrawer, DRAWER_W as DRAWER_WIDTH } from '../context/DrawerContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchCountries, Country } from '../api/country'
import { fetchWalletInfo, WalletInfo } from '../api/wallet'
import client from '../api/client'
import { DailyCheckInModal, useDailyCheckIn } from '../components/DailyCheckInModal'
import { useDrawerSwipe } from '../hooks/useDrawerSwipe'
import { tabBarClearance, AVATAR_LG, AVATAR_MD, ms, sw, ICON_SIZE, RF } from '../util/responsive'
import { FadeScreen } from '../components/FadeScreen'

const { width: W } = Dimensions.get('window')

// Soft background colors for card icons — cycles through these
const CARD_BG_COLORS = [
  '#FFF3E0', '#E8F5E9', '#E3F2FD', '#FCE4EC',
  '#F3E5F5', '#E0F7FA', '#FFF8E1', '#E8EAF6',
]

const LOCAL_CARD_IMAGES: Record<string, any> = {
  'amazon':    require('../../assets/amazon.png'),
  'steam':     require('../../assets/steam.png'),
  'vanilla':   require('../../assets/vanilla.png'),
  'lululemon': require('../../assets/lululemon.png'),
  'target':    require('../../assets/target.png'),
  'ebay':      require('../../assets/ebay.png'),
}
function getLocalCardImage(name: string): any | null {
  const key = name.toLowerCase()
  for (const [brand, img] of Object.entries(LOCAL_CARD_IMAGES)) {
    if (key.includes(brand)) return img
  }
  return null
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function fmt(n: number | undefined | null, symbol = '₦') {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0
  return `${symbol}${val.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

export default function HomeScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const { user, logout } = useAuth()
  const { drawerVisible, drawerAnim, overlayAnim, open: ctxOpen, close: ctxClose } = useDrawer()
  const swipeHandlers = useDrawerSwipe()
  const insets = useSafeAreaInsets()
  const [balanceVisible, setBalanceVisible]   = useState(true)
  const [cards, setCards]                     = useState<CardCategory[]>([])
  const [cardsLoading, setCardsLoading]       = useState(true)
  const [refreshing, setRefreshing]           = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [wallet, setWallet]                   = useState<WalletInfo | null>(null)
  const [walletLoading, setWalletLoading]     = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Load unread notification count
  useEffect(() => {
    if (!user.isPresent()) return
    const fetchUnread = () => {
      client.get('/tuka/user/notifications/unread')
        .then(res => setUnreadCount(res.data?.data || 0))
        .catch(() => {})
    }
    fetchUnread()
    // Refresh count every 60 seconds
    const interval = setInterval(fetchUnread, 60000)
    return () => clearInterval(interval)
  }, [user.isPresent()])
  const fadeAnim = useRef(new Animated.Value(0)).current
  const { show: showCheckIn, points: checkInPts, streak: checkInStreak, check: checkDailyIn, dismiss: dismissCheckIn, resetForTesting } = useDailyCheckIn()

  // Trigger daily check-in check when user is logged in
  useEffect(() => {
    if (user.isPresent()) {
      const t = setTimeout(() => checkDailyIn(), 1500)
      return () => clearTimeout(t)
    }
  }, [user.isPresent()])

  useEffect(() => {
    fetchCountries().then(list => {
      if (list.length === 0) return
      // Match the logged-in user's country — fall back to first in list
      const u = user.isPresent() ? user.getOrThrow() : null
      const match = u?.country
        ? list.find(c => c.name.toLowerCase() === u.country!.toLowerCase()) ?? list[0]
        : list[0]
      setSelectedCountry(match)
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (user.isPresent()) {
      fetchWalletInfo()
        .then(w => setWallet(w))
        .catch(() => {})
        .finally(() => setWalletLoading(false))
    } else { setWalletLoading(false) }
  }, [user])

  const loadCards = useCallback(async (force = false) => {
    try {
      const data = await fetchCardCategories(force, selectedCountry?.name || '')
      setCards(data)
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
    } catch {
      setCards([]) // clear stale data on error
    } finally {
      setCardsLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => { loadCards() }, [selectedCountry])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadCards(true)
    if (user.isPresent()) {
      fetchWalletInfo().then(w => setWallet(w)).catch(() => {})
    }
  }, [loadCards])

  // Reset drawer state + refresh balance when screen regains focus
  useEffect(() => {
    const unsub = (props.navigation as any).addListener?.('focus', () => {
      drawerAnim.setValue(-DRAWER_WIDTH)
      overlayAnim.setValue(0)
      ctxClose()
      // Silently refresh balance in background
      if (user.isPresent()) {
        fetchWalletInfo().then(w => setWallet(w)).catch(() => {})
      }
    })
    return unsub
  }, [user])

  const userName       = user.isPresent() ? user.getOrThrow().name : 'Guest'
  const currencySymbol = selectedCountry?.currencySymbol || '₦'
  const balance        = wallet?.balance       ?? 0
  const registerBonus  = wallet?.registerBonus ?? 0
  const initials       = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  function requireAuth(action: () => void) {
    if (user.isPresent()) action()
    else props.navigation.navigate('Login')
  }

  function openDrawer() {
    ctxOpen()
  }

  // Helper: navigate away and instantly reset drawer (no close animation needed — stack covers it)
  function drawerNavigate(screen: string, params?: any) {
    drawerAnim.stopAnimation()
    overlayAnim.stopAnimation()
    drawerAnim.setValue(-DRAWER_WIDTH)
    overlayAnim.setValue(0)
    ctxClose()
    props.navigation.navigate(screen as any, params)
  }

  const calcRate   = 0
  const calcResult = ''

  return (    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <FadeScreen>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Home content ── */}
      <View style={{ flex: 1 }} {...swipeHandlers}>
        {/* Dark overlay — fades in over home content, tap to close */}
        {drawerVisible && (
          <Animated.View
            style={{
              position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
              zIndex: 10,
              backgroundColor: colors.overlay,
              opacity: overlayAnim,
            }}
          >
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={ctxClose} />
          </Animated.View>
        )}
      <SafeAreaView style={s.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={colors.primary} colors={[colors.primary]} />
          }
          contentContainerStyle={{ paddingBottom: tabBarClearance(insets.bottom) }}
        >

        {/* ── Header ── */}
        <View style={s.header}>
          {/* Menu icon — left side, opens drawer */}
          <TouchableOpacity style={s.headerBtn} onPress={openDrawer} activeOpacity={0.7}>
            <Feather name="menu" size={19} color={colors.dark} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text style={s.greetingTxt}>{greeting()}</Text>
            <Text style={s.userNameTxt} numberOfLines={1}>{userName}</Text>
          </View>
          {/* Daily Bonus */}
          <TouchableOpacity style={s.headerBtn} onPress={() => props.navigation.navigate('DailyBonus' as any)} activeOpacity={0.7}>
            <Feather name="gift" size={19} color={colors.dark} />
          </TouchableOpacity>
          <View style={{ width: spacing[2] }} />
          {/* Bell with unread badge */}
          <TouchableOpacity style={s.headerBtn} onPress={() => { props.navigation.navigate('Alerts' as any); setUnreadCount(0) }} activeOpacity={0.7}>
            <Feather name="bell" size={19} color={colors.dark} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Balance row ── */}
        <View style={s.balanceRow}>
          {/* Left: balance */}
          <TouchableOpacity onPress={() => setBalanceVisible(v => !v)} activeOpacity={0.8}>
            {walletLoading ? (
              <ActivityIndicator color={colors.dark} size="small" />
            ) : (
              <>
                <Text style={s.balanceLbl}>Total Balance</Text>
                <Text style={s.balanceAmt}>
                  {balanceVisible ? fmt(balance, currencySymbol) : '••••••'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Right: withdraw */}
          <TouchableOpacity style={s.withdrawBtn}
            onPress={() => requireAuth(() => props.navigation.navigate('Withdraw' as any))}
            activeOpacity={0.8}>
            <Feather name="arrow-up-circle" size={14} color={colors.dark} style={{ marginRight: 5 }} />
            <Text style={s.withdrawBtnTxt}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sell Gift Cards ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Sell Gift Card</Text>
            <TouchableOpacity onPress={() => props.navigation.navigate('RateCalculator' as any)} activeOpacity={0.7}>
              <Text style={s.rateCalcLink}>Rate Calculator</Text>
            </TouchableOpacity>
          </View>

          {cardsLoading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : cards.length === 0 ? (
            <View style={s.emptyBox}>
              <Feather name="inbox" size={36} color={colors.border} />
              <Text style={s.emptyTxt}>No cards available</Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {cards.map((card, i) => {
                const imgUrl = resolveImageUrl(card.icon)
                const rate   = (card.rate ?? 0) * (selectedCountry?.todayRate ?? 1)
                const bgColor = CARD_BG_COLORS[i % CARD_BG_COLORS.length]
                return (
                  <View key={card.id}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={s.cardRow}>
                      {/* Circle icon with unique bg */}
                      <View style={[s.cardIconCircle, { backgroundColor: bgColor }]}>
                        {imgUrl ? (
                          <Image source={{ uri: imgUrl }} style={s.cardIcon} resizeMode="cover" />
                        ) : getLocalCardImage(card.name) ? (
                          <Image source={getLocalCardImage(card.name)} style={s.cardIcon} resizeMode="contain" />
                        ) : (
                          <Feather name="credit-card" size={22} color={colors.muted} />
                        )}
                      </View>

                      {/* Name + rate */}
                      <View style={{ flex: 1, marginLeft: spacing[3] }}>
                        <Text style={s.cardName}>{card.name}</Text>
                        <Text style={s.cardRate}>{fmt(rate, currencySymbol)}</Text>
                      </View>

                      {/* Sell button */}
                      <TouchableOpacity style={s.sellBtn}
                        onPress={() => requireAuth(() => props.navigation.navigate('SellCard' as any, { cardId: card.id }))}
                        activeOpacity={0.8}>
                        <Text style={s.sellBtnTxt}>Sell</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </Animated.View>
          )}
        </View>

      </ScrollView>

    </SafeAreaView>
      </View>

      {/* ── Daily Check-in Modal ── */}
      <DailyCheckInModal
        visible={showCheckIn}
        points={checkInPts}
        streak={checkInStreak}
        onClose={dismissCheckIn}
        onViewLeaderboard={() => {
          dismissCheckIn()
          props.navigation.navigate('Leaderboard' as any, { newPoints: checkInPts } as any)
        }}
      />
    </View>
    </FadeScreen>
    </TouchableWithoutFeedback>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  avatar: {
    width: AVATAR_LG, height: AVATAR_LG, borderRadius: AVATAR_LG / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt:    { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.primary },
  greetingTxt:  { fontSize: ms(typography.size.sm), color: colors.muted, marginBottom: 2 },
  userNameTxt:  { fontSize: ms(typography.size.xl), fontWeight: typography.weight.extrabold, color: colors.dark },
  headerBtn: {
    width: ms(38), height: ms(38), borderRadius: ms(19),
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: ms(18), height: ms(18), borderRadius: ms(9),
    backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.background,
  },
  badgeTxt: { fontSize: RF(10), fontWeight: typography.weight.extrabold, color: '#fff' },

  // Balance row
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4], paddingBottom: spacing[4],
  },
  balanceLbl: { fontSize: ms(typography.size.xs), color: colors.muted, marginBottom: 2 },
  balanceAmt: {
    fontSize: RF(30), fontWeight: typography.weight.extrabold,
    color: colors.primary, letterSpacing: -0.5, lineHeight: ms(42),
  },
  bonusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing[2] + 2, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: spacing[1] + 2,
  },
  bonusTxt: { fontSize: RF(11), color: colors.primary, fontWeight: typography.weight.semibold },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    ...shadow.sm,
  },
  withdrawBtnTxt: { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.dark },

  // Section
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[3], borderRadius: radius.xl,
    overflow: 'hidden', ...shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  sectionTitle:  { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark },
  rateCalcLink:  { fontSize: ms(typography.size.base), fontWeight: typography.weight.semibold, color: colors.secondary, textDecorationLine: 'underline' },
  loadingBox:    { alignItems: 'center', paddingVertical: spacing[10] },
  emptyBox:      { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  emptyTxt:      { fontSize: ms(typography.size.sm), color: colors.muted },

  // Card row
  divider: { height: 1, backgroundColor: colors.background },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2,
  },
  cardIconCircle: {
    width: ms(50), height: ms(50), borderRadius: ms(25),
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    elevation: 0,
  },
  cardIcon:     { width: ms(50), height: ms(50) },
  cardName:     { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: 2 },
  cardRate:     { fontSize: ms(typography.size.base), color: colors.muted, fontWeight: typography.weight.semibold },
  sellBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing[5], paddingVertical: spacing[2] + 3,
    minHeight: ms(36), justifyContent: 'center',
  },
  sellBtnTxt: { fontSize: ms(typography.size.sm), fontWeight: typography.weight.bold, color: '#FFFFFF' },

  // Modals shared
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    maxHeight: '65%', paddingBottom: spacing[5],
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.bold, color: colors.dark },

  // Rate calculator
  calcLabel: { fontSize: ms(typography.size.sm), fontWeight: typography.weight.semibold, color: colors.body, marginBottom: spacing[2] },
  calcChip: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.background, borderRadius: radius.full,
    marginRight: spacing[2], borderWidth: 1.5, borderColor: colors.border,
  },
  calcChipOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  calcChipTxt:   { fontSize: ms(typography.size.sm), fontWeight: typography.weight.semibold, color: colors.body },
  calcInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[5],
  },
  calcPrefix:    { fontSize: ms(typography.size.xl), fontWeight: typography.weight.bold, color: colors.muted, marginRight: spacing[2] },
  calcInputTxt:  { flex: 1, fontSize: ms(typography.size.xl), fontWeight: typography.weight.bold, color: colors.dark },
  calcResult: {
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    padding: spacing[5], alignItems: 'center', marginBottom: spacing[5], minHeight: 90, justifyContent: 'center',
  },
  calcResultLbl:  { fontSize: ms(typography.size.sm), color: colors.primary, marginBottom: spacing[2] },
  calcResultAmt:  { fontSize: RF(32), fontWeight: typography.weight.extrabold, color: colors.primary, letterSpacing: -1 },
  calcResultRate: { fontSize: ms(typography.size.xs), color: colors.muted, marginTop: spacing[2] },
  calcSellBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  calcSellBtnTxt: { fontSize: ms(typography.size.base), fontWeight: typography.weight.bold, color: colors.primaryText },
})
