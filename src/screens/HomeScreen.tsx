import { useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Dimensions, Animated, Modal,
  Keyboard, TouchableWithoutFeedback, StatusBar, Platform,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useDrawer, DRAWER_W as DRAWER_WIDTH } from '../context/DrawerContext'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { HomeBalanceSkeleton, Skeleton as SkeletonBlock } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchWalletInfo, WalletInfo } from '../api/wallet'
import client from '../api/client'
import { cacheGet, TTL } from '../util/cache'
import { DailyCheckInModal, useDailyCheckIn } from '../components/DailyCheckInModal'
import { useDrawerSwipe } from '../hooks/useDrawerSwipe'
import { tabBarClearance, ms, RF } from '../util/responsive'
import { FadeScreen } from '../components/FadeScreen'
import { useCountry } from '../context/CountryContext'
import { getStatusBarHeight } from '../util/statusBar'
import { hapticMedium, hapticLight } from '../util/haptics'

const { width: W } = Dimensions.get('window')

// Soft background colors
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
  const { user } = useAuth()
  const { drawerVisible, drawerAnim, overlayAnim, open: ctxOpen, close: ctxClose } = useDrawer()
  const swipeHandlers = useDrawerSwipe()
  const insets = useSafeAreaInsets()
  const isLoggedIn = user.isPresent()

  const [balanceVisible, setBalanceVisible]   = useState(true)
  const [refreshing, setRefreshing]           = useState(false)
  const { selectedCountry, setSelectedCountry, countries } = useCountry()
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [wallet, setWallet]                   = useState<WalletInfo | null>(null)
  const [walletLoading, setWalletLoading]     = useState(false)
  const [unreadCount, setUnreadCount]         = useState(0)

  // Pre-populate cards from cache — eliminates skeleton flash on repeat visits
  // Must be after useCountry() so selectedCountry is available
  const cachedCards = cacheGet<CardCategory[]>(
    `v3:${selectedCountry?.name || 'all'}`,
    60_000  // matches CACHE_TTL in cards.ts
  )
  const [cards, setCards]                     = useState<CardCategory[]>(cachedCards ?? [])
  const [cardsLoading, setCardsLoading]       = useState(!cachedCards)

  // ── Unread notification count — only poll when logged in ──────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadCount(0)
      return
    }
    const fetchUnread = () => {
      client.get('/tuka/user/notifications/unread')
        .then(res => setUnreadCount(res.data?.data || 0))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 60_000)
    return () => clearInterval(interval)
  }, [isLoggedIn])

  const cardAnims = useRef<Animated.Value[]>([]).current
  // Pre-set to true if we have cached cards — prevents skeleton flash and stagger re-animation
  const hasCardsRef = useRef((cachedCards?.length ?? 0) > 0)
  // Pre-fill animation values for cached cards so they render at full opacity immediately
  if (cardAnims.length === 0 && cachedCards && cachedCards.length > 0) {
    cachedCards.forEach(() => cardAnims.push(new Animated.Value(1)))
  }
  const prevRatesRef = useRef<Record<number, number>>({})
  const { show: showCheckIn, points: checkInPts, streak: checkInStreak, check: checkDailyIn, dismiss: dismissCheckIn } = useDailyCheckIn()

  // Trigger daily check-in check when user is logged in
  useEffect(() => {
    if (!isLoggedIn) return
    const t = setTimeout(() => checkDailyIn(), 1500)
    return () => clearTimeout(t)
  }, [isLoggedIn])

  // ── Wallet + Cards — fetched in parallel when logged in ──────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      setWallet(null)
      setWalletLoading(false)
      // Reset card ref so the next login shows skeleton + stagger animation
      hasCardsRef.current = false
      return
    }
    setWalletLoading(true)
    fetchWalletInfo(selectedCountry?.name, fresh => {
      setWallet(fresh)
      setWalletLoading(false)
    })
      .then(w => { setWallet(w); setWalletLoading(false) })
      .catch(() => setWalletLoading(false))
  }, [isLoggedIn, selectedCountry?.name])

  const loadCards = useCallback(async (force = false, silent = false) => {
    try {
      const alreadyHasCards = hasCardsRef.current
      // Only clear on explicit country switch — never on silent focus refresh
      if (force && !silent && !alreadyHasCards) setCards([])
      const data = await fetchCardCategories(force, selectedCountry?.name || '')
      // Build new rate map and compare with previous to detect changes
      const newRates: Record<number, number> = {}
      data.forEach(c => { newRates[c.id] = c.displayRate ?? c.rate ?? 0 })
      // prevRatesRef holds the rates from the last render — update after setting state
      setCards(data)
      // Defer snapshot update so the current render can still diff against old values
      setTimeout(() => { prevRatesRef.current = newRates }, 0)
      hasCardsRef.current = data.length > 0

      // Never animate when cards already exist — causes the blink
      if (alreadyHasCards) {
        if (cardAnims.length !== data.length) {
          cardAnims.length = 0
          data.forEach(() => cardAnims.push(new Animated.Value(1)))
        }
        return
      }

      // First load only — stagger cards in smoothly
      cardAnims.length = 0
      data.forEach(() => cardAnims.push(new Animated.Value(0)))
      requestAnimationFrame(() => {
        Animated.stagger(
          40,
          cardAnims.map(anim =>
            Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true })
          )
        ).start()
      })
    } catch {
      // On error keep existing cards — don't show empty state
    } finally {
      setCardsLoading(false)
      setRefreshing(false)
    }
  }, [selectedCountry])

  useEffect(() => {
    // Only show skeleton if no cache for this country
    const hasCached = (cacheGet<CardCategory[]>(`v3:${selectedCountry?.name || 'all'}`, 60_000)?.length ?? 0) > 0
    if (!hasCached) {
      setCardsLoading(true)
      hasCardsRef.current = false
      setCards([])
    }
    const country = selectedCountry?.name || ''
    const fetches: Promise<any>[] = [loadCards(true, false)]
    if (isLoggedIn) {
      setWalletLoading(true)
      fetches.push(
        fetchWalletInfo(country)
          .then(w => setWallet(w))
          .catch(() => {})
          .finally(() => setWalletLoading(false))
      )
    }
    Promise.all(fetches).catch(() => {})
  }, [selectedCountry])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Parallel: cards + wallet on pull-to-refresh (not silent — user explicitly requested)
    const country = selectedCountry?.name || ''
    const fetches: Promise<any>[] = [loadCards(true, false)]
    if (isLoggedIn) {
      fetches.push(
        fetchWalletInfo(country).then(w => setWallet(w)).catch(() => {})
      )
    }
    Promise.all(fetches).catch(() => {})
  }, [loadCards, isLoggedIn, selectedCountry?.name])

  // Reset drawer state + refresh balance + cards when screen regains focus
  useEffect(() => {
    const unsub = (props.navigation as any).addListener?.('focus', () => {
      // Only reset if drawer is not currently open (avoids hard-reset mid-animation)
      if (!drawerVisible) {
        drawerAnim.setValue(-DRAWER_WIDTH)
        overlayAnim.setValue(0)
        ctxClose()
      }
      if (isLoggedIn) {
        // Refresh wallet silently in background on focus
        fetchWalletInfo(selectedCountry?.name).then(w => setWallet(w)).catch(() => {})
        // Refresh cards silently — existing cards stay visible, no flash
        loadCards(true, true)
      }
    })
    return unsub
  }, [isLoggedIn, drawerVisible, selectedCountry?.name])

  const userName       = isLoggedIn ? user.getOrThrow().name : 'Guest'
  const currencySymbol = selectedCountry?.currencySymbol || '₦'
  const rawBalance     = wallet?.balance ?? 0
  // Balance is now country-scoped from backend — no conversion needed
  const balance        = rawBalance

  function requireAuth(action: () => void) {
    if (isLoggedIn) action()
    else props.navigation.navigate('Login')
  }

  function openDrawer() { ctxOpen() }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <FadeScreen>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Platform.OS === 'android' ? 'rgba(250,250,250,0.95)' : colors.background}
          translucent={Platform.OS === 'android'}
        />
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

            {/* Status bar is always translucent — pad content below it on both platforms */}
            <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={{ paddingBottom: tabBarClearance(insets.bottom) }}
              >

                {/* ── Header ── */}
                <View style={s.header}>
                  <TouchableOpacity style={s.headerBtn} onPress={openDrawer} activeOpacity={0.7}
                    accessible accessibilityLabel="Open menu" accessibilityRole="button">
                    <Feather name="menu" size={19} color={colors.dark} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <Text style={s.greetingTxt}>{greeting()}</Text>
                    <Text style={s.userNameTxt} numberOfLines={1}>{userName}</Text>
                  </View>

                  {/* Country switcher — flag only pill in header */}
                  {countries.length > 0 && (
                    <TouchableOpacity
                      style={s.countryPill}
                      onPress={() => setCountryPickerOpen(true)}
                      activeOpacity={0.8}
                      accessible
                      accessibilityLabel={`Selected country: ${selectedCountry?.name ?? 'Select country'}`}
                      accessibilityRole="button"
                    >
                      {selectedCountry?.flag ? (
                        <Text style={s.countryFlag}>{selectedCountry.flag}</Text>
                      ) : (
                        <Feather name="globe" size={15} color={colors.dark} />
                      )}
                      <Feather name="chevron-down" size={12} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                  <View style={{ width: spacing[2] }} />

                  {/* Daily Bonus */}
                  <TouchableOpacity
                    style={s.headerBtn}
                    onPress={() => props.navigation.navigate('DailyBonus' as any)}
                    activeOpacity={0.7}
                    accessible accessibilityLabel="Daily bonus" accessibilityRole="button"
                  >
                    <Feather name="gift" size={19} color={colors.dark} />
                  </TouchableOpacity>
                  <View style={{ width: spacing[2] }} />
                  {/* Bell with unread badge */}
                  <TouchableOpacity
                    style={s.headerBtn}
                    onPress={() => { props.navigation.navigate('Alerts' as any); setUnreadCount(0) }}
                    activeOpacity={0.7}
                    accessible
                    accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                    accessibilityRole="button"
                  >
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
                  <TouchableOpacity
                    onPress={() => isLoggedIn ? setBalanceVisible(v => !v) : props.navigation.navigate('Login')}
                    activeOpacity={0.8}
                    accessible
                    accessibilityLabel={isLoggedIn ? (balanceVisible ? 'Hide balance' : 'Show balance') : 'Login to view balance'}
                    accessibilityRole="button"
                  >
                    {!isLoggedIn ? (
                      <>
                        <Text style={s.balanceLbl}>Total Balance</Text>
                        <TouchableOpacity onPress={() => props.navigation.navigate('Login')} activeOpacity={0.8}>
                          <Text style={[s.balanceAmt, { fontSize: ms(16), color: colors.muted }]}>
                            Login to view balance
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : walletLoading ? (
                      <HomeBalanceSkeleton />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    {/* Withdraw button */}
                    <TouchableOpacity
                      style={s.withdrawBtn}
                      onPress={() => { hapticMedium(); requireAuth(() => props.navigation.navigate('Withdraw' as any)) }}
                      activeOpacity={0.8}
                      accessible accessibilityLabel="Withdraw funds" accessibilityRole="button"
                    >
                      <Feather name="arrow-up-circle" size={14} color={colors.dark} style={{ marginRight: 5 }} />
                      <Text style={s.withdrawBtnTxt}>Withdraw</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Sell Gift Cards ── */}
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Sell Gift Card</Text>
                    <TouchableOpacity
                      onPress={() => props.navigation.navigate('RateCalculator' as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.rateCalcLink}>Rate Calculator</Text>
                    </TouchableOpacity>
                  </View>

                  {cardsLoading && cards.length === 0 ? (
                    // Animated skeleton rows — shimmer effect
                    <View>
                      {[1,2,3,4,5].map(k => (
                        <View key={k}>
                          {k > 1 && <View style={s.divider} />}
                          <View style={[s.cardRow]}>
                            <SkeletonBlock circle size={ms(50)} />
                            <View style={{ flex: 1, marginLeft: spacing[3], gap: spacing[2] }}>
                              <SkeletonBlock width="55%" height={14} />
                              <SkeletonBlock width="35%" height={11} />
                            </View>
                            <SkeletonBlock width={52} height={34} radius={radius.md} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : cards.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Feather name="inbox" size={36} color={colors.border} />
                      <Text style={s.emptyTxt}>No cards available</Text>
                    </View>
                  ) : (
                    <View>
                      {cards.map((card, i) => {
                        const imgUrl  = resolveImageUrl(card.icon)
                        // Homepage: displayRate × todayRate (Nigeria) or displayRate ÷ todayRate (Ghana)
                        const baseDisplayRate = card.displayRate ?? card.rate ?? 0
                        const todayRate = selectedCountry?.todayRate ?? 1
                        const rate = selectedCountry?.rateMode === 'divide'
                          ? (todayRate > 0 ? baseDisplayRate / todayRate : baseDisplayRate)
                          : baseDisplayRate * todayRate
                        const bgColor = CARD_BG_COLORS[i % CARD_BG_COLORS.length]
                        // Use existing anim or a static Value(1) for cards beyond the anim array
                        const anim = cardAnims[i] ?? new Animated.Value(1)
                        // Rate change indicator
                        const prevBase = prevRatesRef.current[card.id]
                        const rateUp   = prevBase !== undefined && baseDisplayRate > prevBase
                        const rateDown = prevBase !== undefined && baseDisplayRate < prevBase
                        return (
                          <Animated.View
                            key={card.id}
                            style={{
                              opacity: anim,
                              transform: [{
                                translateY: anim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [12, 0],
                                }),
                              }],
                            }}
                          >
                            {i > 0 && <View style={s.divider} />}
                            <View style={s.cardRow}>
                              {/* Circle icon with unique bg */}
                              <View style={[s.cardIconCircle, { backgroundColor: bgColor }]}>
                                {imgUrl ? (
                                  <Image
                                    source={{ uri: imgUrl }}
                                    style={s.cardIcon}
                                    resizeMode="cover"
                                  />
                                ) : getLocalCardImage(card.name) ? (
                                  <Image source={getLocalCardImage(card.name)} style={s.cardIcon} resizeMode="contain" />
                                ) : (
                                  <Feather name="credit-card" size={22} color={colors.muted} />
                                )}
                              </View>

                              {/* Name + rate + change indicator */}
                              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                                <Text style={s.cardName}>{card.name}</Text>
                                <View style={s.rateRow}>
                                  <Text style={s.cardRate}>{fmt(rate, currencySymbol)}</Text>
                                  {rateUp && (
                                    <View style={[s.rateChip, { backgroundColor: colors.success + '18' }]}>
                                      <Feather name="trending-up" size={ms(10)} color={colors.success} />
                                      <Text style={[s.rateChipTxt, { color: colors.success }]}>Up</Text>
                                    </View>
                                  )}
                                  {rateDown && (
                                    <View style={[s.rateChip, { backgroundColor: colors.error + '18' }]}>
                                      <Feather name="trending-down" size={ms(10)} color={colors.error} />
                                      <Text style={[s.rateChipTxt, { color: colors.error }]}>Down</Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              {/* Sell button */}
                              <TouchableOpacity
                                style={s.sellBtn}
                                onPress={() => { hapticMedium(); requireAuth(() => props.navigation.navigate('SellCard' as any, { cardId: card.id })) }}
                                activeOpacity={0.8}
                                accessible
                                accessibilityLabel={`Sell ${card.name}`}
                                accessibilityRole="button"
                              >
                                <Text style={s.sellBtnTxt}>Sell</Text>
                              </TouchableOpacity>
                            </View>
                          </Animated.View>
                        )
                      })}
                    </View>
                  )}
                </View>

              </ScrollView>
            </View>
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

        {/* ── Country Picker Modal ── */}
        <Modal
          visible={countryPickerOpen}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setCountryPickerOpen(false)}
        >
          <View style={cp.overlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setCountryPickerOpen(false)} />
            <View style={cp.sheet}>
              <View style={cp.handle} />
              <View style={cp.header}>
                <Text style={cp.title}>Select Country</Text>
                <TouchableOpacity
                  onPress={() => setCountryPickerOpen(false)}
                  style={cp.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={colors.dark} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[4], paddingTop: spacing[2] }}>
                {countries.map((country, idx) => {
                  const isSelected = selectedCountry?.id === country.id
                  return (
                    <TouchableOpacity
                      key={country.id}
                      style={[cp.row, isSelected && cp.rowSelected]}
                      onPress={() => {
                        hapticLight()
                        setSelectedCountry(country)
                        setCountryPickerOpen(false)
                      }}
                      activeOpacity={0.75}
                    >
                      {/* Flag */}
                      <View style={cp.flagWrap}>
                        {country.flag ? (
                          <Text style={cp.flagTxt}>{country.flag}</Text>
                        ) : (
                          <Feather name="globe" size={22} color={colors.muted} />
                        )}
                      </View>

                      {/* Name + currency */}
                      <View style={{ flex: 1 }}>
                        <Text style={[cp.rowName, isSelected && cp.rowNameSelected]}>
                          {country.name}
                        </Text>
                        <Text style={[cp.rowCurrency, isSelected && cp.rowCurrencySelected]}>
                          {country.currencySymbol} · {country.currencyName}
                          {country.todayRate ? `  ·  Rate: ${country.todayRate}` : ''}
                        </Text>
                      </View>

                      {/* Selected check */}
                      {isSelected && (
                        <View style={cp.checkCircle}>
                          <Feather name="check" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  balanceRegionNote: {
    fontSize: ms(typography.size.xs), color: colors.muted,
    marginTop: 2,
  },
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
  rateCalcLink:  { fontSize: ms(typography.size.base), fontWeight: typography.weight.semibold, color: colors.secondary },
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
  },
  cardIcon:     { width: ms(50), height: ms(50) },
  cardName:     { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: 2 },
  cardRate:     { fontSize: ms(typography.size.base), color: colors.muted, fontWeight: typography.weight.semibold },
  rateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
  },
  rateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    borderRadius: radius.full, paddingHorizontal: spacing[1] + 2, paddingVertical: 2,
  },
  rateChipTxt: {
    fontSize: ms(typography.size.xs - 1), fontWeight: typography.weight.bold,
  },
  sellBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: spacing[5], paddingVertical: spacing[2] + 3,
    minHeight: ms(36), justifyContent: 'center',
  },
  sellBtnTxt: { fontSize: ms(typography.size.sm), fontWeight: typography.weight.bold, color: '#FFFFFF' },

  // Country pill
  countryPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    ...shadow.sm,
  },
  countryFlag: { fontSize: ms(18), lineHeight: ms(22) },

  // Guest
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8], gap: spacing[4] },
  guestIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontSize: ms(typography.size.xl), fontWeight: typography.weight.extrabold, color: colors.dark, textAlign: 'center' },
  guestSub:   { fontSize: ms(typography.size.base), color: colors.muted, textAlign: 'center' },
  loginBtn:   { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing[8], paddingVertical: spacing[3] },
  loginBtnTxt:{ fontSize: ms(typography.size.base), fontWeight: typography.weight.bold, color: '#fff' },
})

const cp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
    maxHeight: '65%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  title: {
    fontSize: ms(typography.size.xl),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  // List row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  rowSelected: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    marginHorizontal: spacing[3],
    paddingHorizontal: spacing[3],
  },
  flagWrap: {
    width: ms(48), height: ms(48),
    borderRadius: ms(14),
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  flagTxt: { fontSize: ms(26) },
  rowName: {
    fontSize: ms(typography.size.base),
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    marginBottom: 2,
  },
  rowNameSelected: { color: colors.primary },
  rowCurrency: {
    fontSize: ms(typography.size.sm),
    color: colors.muted,
  },
  rowCurrencySelected: { color: colors.primary },
  checkCircle: {
    width: ms(26), height: ms(26), borderRadius: ms(13),
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
})
