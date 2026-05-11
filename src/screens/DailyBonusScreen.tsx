/**
 * DailyBonusScreen — Daily check-in, streak tracker & coin history
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Switch, Animated, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { AppHeader } from '../components/AppHeader'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import {
  fetchStreakInfo, fetchBonusHistory, postCheckIn,
  StreakInfo, BonusTransaction,
} from '../api/dailyBonus'
import storage from '../util/storage'
import { clearBadge, registerPushToken, clearPushToken, requestNotificationPermission } from '../util/pushNotifications'
import { RF, ms } from '../util/responsive'

const GREEN       = colors.primary
const GREEN_LIGHT = colors.primaryLight

// ── Day dot ───────────────────────────────────────────────────────────────────
function DayDot({ day, points, claimed, isToday }: {
  day: number; points: number; claimed: boolean; isToday: boolean
}) {
  return (
    <View style={dot.wrap}>
      <View style={[
        dot.circle,
        claimed             && dot.claimed,
        isToday && !claimed && dot.today,
        !claimed && !isToday && dot.future,
      ]}>
        {claimed
          ? <Feather name="check" size={13} color="#fff" />
          : <Text style={[dot.pts, isToday && dot.ptsToday]}>{points}</Text>
        }
      </View>
      <Text style={[dot.label, claimed && dot.labelClaimed]}>Day {day}</Text>
    </View>
  )
}

const dot = StyleSheet.create({
  wrap:         { alignItems: 'center', gap: 4 },
  circle: {
    width: ms(32), height: ms(32), borderRadius: ms(16),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff',
  },
  claimed:      { backgroundColor: GREEN, borderColor: GREEN },
  today:        { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  future:       { borderColor: colors.border, backgroundColor: colors.background },
  pts:          { fontSize: RF(10), fontWeight: typography.weight.bold, color: colors.muted },
  ptsToday:     { color: GREEN },
  label:        { fontSize: RF(9), color: colors.muted, fontWeight: typography.weight.medium },
  labelClaimed: { color: GREEN },
})

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: BonusTransaction }) {
  const isPos = tx.amount >= 0
  return (
    <View style={tx_.row}>
      <View style={[tx_.iconWrap, { backgroundColor: isPos ? colors.successLight : colors.errorLight }]}>
        <Feather
          name={isPos ? 'arrow-down-left' : 'arrow-up-right'}
          size={16}
          color={isPos ? colors.success : colors.error}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tx_.title}>{tx.title}</Text>
        <Text style={tx_.sub}>{tx.subtitle}</Text>
      </View>
      <Text style={[tx_.amt, isPos ? tx_.pos : tx_.neg]}>
        {isPos ? '+' : ''}{tx.amount} 🪙
      </Text>
    </View>
  )
}

const tx_ = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconWrap: {
    width: ms(36), height: ms(36), borderRadius: ms(18),
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: ms(typography.size.base), fontWeight: typography.weight.semibold, color: colors.dark },
  sub:   { fontSize: ms(typography.size.xs), color: colors.muted, marginTop: 2 },
  amt:   { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold },
  pos:   { color: colors.success },
  neg:   { color: colors.error },
})

type Filter = 'all' | 'earned' | 'used'

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DailyBonusScreen(props: StackScreenProps<RootStackParams, 'DailyBonus'>) {
  const insets = useSafeAreaInsets()

  const [streak,       setStreak]       = useState<StreakInfo | null>(null)
  const [history,      setHistory]      = useState<BonusTransaction[]>([])
  const [totalCoins,   setTotalCoins]   = useState(0)
  const [earnedNgn,    setEarnedNgn]    = useState(0)
  const [filter,       setFilter]       = useState<Filter>('all')

  // Separate loading flags: initial page load vs filter-tab switch
  const [loading,      setLoading]      = useState(true)
  const [filterLoading, setFilterLoading] = useState(false)

  const [refreshing,   setRefreshing]   = useState(false)
  const [notifOn,      setNotifOn]      = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [checking,     setChecking]     = useState(false)
  const [checkInMsg,   setCheckInMsg]   = useState<string | null>(null)

  // Animations
  const coinScale    = useRef(new Animated.Value(1)).current
  const flashOpacity = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  // Crossfade for history list on filter change
  const listOpacity  = useRef(new Animated.Value(1)).current

  // ── Clear badge on focus ──────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => { clearBadge().catch(() => {}) }, [])
  )

  // ── Initial load — streak + history together ──────────────────────────────
  const loadAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const [s, h] = await Promise.all([
        fetchStreakInfo(),
        fetchBonusHistory(filter),
      ])
      setStreak(s)
      setHistory(h.transactions)
      setTotalCoins(h.totalCoins)
      setEarnedNgn(h.earnedNgn)

      const pct = s.weekCap > 0 ? Math.min(s.weekPtsEarned / s.weekCap, 1) : 0
      Animated.timing(progressAnim, {
        toValue: pct, duration: 600, useNativeDriver: false,
      }).start()
    } catch { /* silently fail */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, []) // intentionally no `filter` dep — initial load always uses 'all'

  useEffect(() => { loadAll() }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadAll(true)
  }, [loadAll])

  // ── Filter change — only re-fetch history, crossfade the list ────────────
  const loadHistory = useCallback(async (f: Filter) => {
    setFilterLoading(true)
    // Fade out current list
    Animated.timing(listOpacity, {
      toValue: 0, duration: 120, useNativeDriver: true,
    }).start(async () => {
      try {
        const h = await fetchBonusHistory(f)
        setHistory(h.transactions)
      } catch { /* keep existing */ }
      finally {
        setFilterLoading(false)
        // Fade new list in
        Animated.timing(listOpacity, {
          toValue: 1, duration: 180, useNativeDriver: true,
        }).start()
      }
    })
  }, [])

  function handleFilterChange(f: Filter) {
    if (f === filter || filterLoading) return
    setFilter(f)
    loadHistory(f)
  }

  // ── Notification preference — default OFF ────────────────────────────────
  useEffect(() => {
    storage.getItem('@tuka_daily_notif').then(v => {
      // Default is OFF — only on if user explicitly enabled it
      setNotifOn(v === 'true')
    })
  }, [])

  async function handleNotifToggle(val: boolean) {
    if (notifLoading) return
    setNotifLoading(true)
    try {
      if (val) {
        // Enabling — request permission then register token with backend
        const granted = await requestNotificationPermission()
        if (!granted) {
          Alert.alert(
            'Notifications Blocked',
            'Please enable notifications for Tuka in your device Settings to receive daily bonus reminders.',
            [{ text: 'OK' }]
          )
          return
        }
        const token = await registerPushToken()
        if (!token) {
          // Physical device in Expo Go — can't get token, but still save preference
          // so it works when they switch to a dev/prod build
          await storage.setItem('@tuka_daily_notif', 'true')
          setNotifOn(true)
          return
        }
        setNotifOn(true)
        await storage.setItem('@tuka_daily_notif', 'true')
      } else {
        // Disabling — clear token from backend so daily reminders stop
        await clearPushToken()
        setNotifOn(false)
        await storage.setItem('@tuka_daily_notif', 'false')
      }
    } catch {
      // Revert on unexpected error
      setNotifOn(!val)
    } finally {
      setNotifLoading(false)
    }
  }

  // ── Check-in ──────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    if (!streak || streak.todayClaimed || checking) return
    setChecking(true)
    try {
      // PUT /tuka/user/updateLogin — awards streak points, idempotent
      const { pointsAwarded } = await postCheckIn()

      // Refresh streak + history
      await loadAll(true)

      // Show result — if 0 it means already claimed (race condition)
      const msg = pointsAwarded > 0
        ? `+${pointsAwarded} coins earned!`
        : 'Already checked in today'
      setCheckInMsg(msg)

      if (pointsAwarded > 0) {
        Animated.sequence([
          Animated.spring(coinScale, { toValue: 1.5, useNativeDriver: true, tension: 250, friction: 5 }),
          Animated.spring(coinScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 6 }),
        ]).start()
      }

      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setCheckInMsg(null))

    } catch (e: any) {
      Alert.alert('Check-in Failed', e?.message || 'Please try again.')
    } finally {
      setChecking(false)
    }
  }

  const todayDow       = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const days           = streak?.days || []
  const alreadyClaimed = streak?.todayClaimed ?? false
  const currentStreak  = streak?.currentStreak ?? 0

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <AppHeader title="Daily Bonus" onBack={() => props.navigation.goBack()} light />
        <View style={s.centered}><Spinner size="large" color="#fff" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader title="Daily Bonus" onBack={() => props.navigation.goBack()} light />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* ── Coin balance card ── */}
        <View style={s.balanceCard}>
          <View style={s.balanceLeft}>
            <Animated.Text style={[s.coinEmoji, { transform: [{ scale: coinScale }] }]}>
              🪙
            </Animated.Text>
            <Text style={s.coinCount}>{totalCoins}</Text>
          </View>
          <View style={s.balanceRight}>
            <Text style={s.coinRateLabel}>Coin Value</Text>
            <Text style={s.coinRate}>1 Coin = ₦1</Text>
            <Text style={s.earnedNgn}>
              ≈ ₦{earnedNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })} earned
            </Text>
          </View>
        </View>

        {/* ── Streak / check-in card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Daily Check-in</Text>
              {currentStreak > 0 && (
                <View style={s.streakBadge}>
                  <Text style={s.streakBadgeEmoji}>🔥</Text>
                  <Text style={s.streakBadgeTxt}>{currentStreak}-day streak</Text>
                </View>
              )}
            </View>
            <View style={s.notifRow}>
              <Feather name="bell" size={14} color={notifOn ? GREEN : colors.muted} />
              <Text style={s.notifLabel}>Reminders</Text>
              {notifLoading
                ? <ActivityIndicator size="small" color={GREEN} style={{ marginLeft: 4 }} />
                : (
                  <Switch
                    value={notifOn}
                    onValueChange={handleNotifToggle}
                    trackColor={{ false: colors.border, true: GREEN }}
                    thumbColor="#fff"
                    ios_backgroundColor={colors.border}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                )
              }
            </View>
          </View>

          {/* 7-day dots */}
          <View style={s.daysRow}>
            {days.map((d, i) => (
              <React.Fragment key={d.day}>
                <DayDot
                  day={d.day}
                  points={d.points}
                  claimed={d.claimed}
                  isToday={d.day === todayDow}
                />
                {i < days.length - 1 && (
                  <View style={[s.connector, d.claimed && s.connectorClaimed]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Weekly progress */}
          {streak && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <Animated.View
                  style={[s.progressFill, {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1], outputRange: ['0%', '100%'],
                    }),
                  }]}
                />
              </View>
              <Text style={s.progressTxt}>
                {streak.weekPtsEarned} / {streak.weekCap} pts this week
              </Text>
            </View>
          )}

          {/* Check-in button */}
          <TouchableOpacity
            style={[s.checkBtn, alreadyClaimed && s.checkBtnDone]}
            onPress={handleCheckIn}
            activeOpacity={0.85}
            disabled={alreadyClaimed || checking}
          >
            {checking
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <Text style={s.checkBtnTxt}>
                  {alreadyClaimed
                    ? `✓  Checked In  (+${streak?.todayPoints ?? 2} coins)`
                    : `🎁  Claim ${streak?.todayPoints ?? 2} Coins`}
                </Text>
              )
            }
          </TouchableOpacity>

          {/* Success flash */}
          {checkInMsg && (
            <Animated.View style={[s.flashBanner, { opacity: flashOpacity }]} pointerEvents="none">
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={s.flashTxt}>{checkInMsg}</Text>
            </Animated.View>
          )}

          {!alreadyClaimed && streak && (
            <Text style={s.hintTxt}>
              Come back tomorrow for +{Math.min(streak.todayPoints + 2, 10)} coins
            </Text>
          )}
        </View>

        {/* ── Coin history ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Coin History</Text>

          {/* Filter tabs */}
          <View style={s.tabs}>
            {(['all', 'earned', 'used'] as Filter[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.tab, filter === f && s.tabActive]}
                onPress={() => handleFilterChange(f)}
                activeOpacity={0.75}
              >
                <Text style={[s.tabTxt, filter === f && s.tabTxtActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* History list — crossfades on filter change, never blanks */}
          <Animated.View style={{ opacity: listOpacity }}>
            {history.length === 0 ? (
              <View style={s.emptyWrap}>
                <Feather name="inbox" size={32} color={colors.border} />
                <Text style={s.emptyTxt}>No transactions yet</Text>
                <Text style={s.emptySubTxt}>Check in daily to start earning coins</Text>
              </View>
            ) : (
              history.map(tx => <TxRow key={tx.id} tx={tx} />)
            )}
          </Animated.View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: GREEN },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginTop: spacing[3], marginBottom: spacing[3],
    borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.md,
  },
  balanceLeft: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: GREEN, borderRadius: radius.xl,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    marginRight: spacing[4],
  },
  coinEmoji:     { fontSize: RF(26) },
  coinCount:     { fontSize: RF(36), fontWeight: typography.weight.extrabold, color: '#fff' },
  balanceRight:  { flex: 1 },
  coinRateLabel: { fontSize: ms(typography.size.xs), color: colors.muted, marginBottom: 2 },
  coinRate:      { fontSize: ms(typography.size.base), fontWeight: typography.weight.bold, color: colors.dark },
  earnedNgn:     { fontSize: ms(typography.size.sm), color: GREEN, fontWeight: typography.weight.semibold, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: spacing[5],
  },
  cardTitle: {
    fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[1],
  },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF3E0', borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: spacing[1],
  },
  streakBadgeEmoji: { fontSize: RF(12) },
  streakBadgeTxt:   { fontSize: RF(11), color: '#E65100', fontWeight: typography.weight.semibold },

  notifRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  notifLabel: { fontSize: ms(typography.size.xs), color: colors.muted },

  daysRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing[5],
  },
  connector:        { flex: 1, height: 2, backgroundColor: colors.border, marginBottom: ms(16) },
  connectorClaimed: { backgroundColor: GREEN },

  progressWrap:  { marginBottom: spacing[4] },
  progressTrack: {
    height: 6, backgroundColor: colors.border,
    borderRadius: 3, overflow: 'hidden', marginBottom: spacing[1],
  },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 3 },
  progressTxt:  { fontSize: ms(typography.size.xs), color: colors.muted, textAlign: 'right' },

  checkBtn:     {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2],
  },
  checkBtnDone: { backgroundColor: GREEN },
  checkBtnTxt:  { fontSize: ms(typography.size.base), fontWeight: typography.weight.bold, color: '#fff' },

  flashBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], marginTop: spacing[3],
    backgroundColor: colors.successLight, borderRadius: radius.full,
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
  },
  flashTxt: { fontSize: ms(typography.size.sm), fontWeight: typography.weight.bold, color: colors.success },

  hintTxt: {
    fontSize: ms(typography.size.xs), color: colors.muted,
    textAlign: 'center', marginTop: spacing[3],
  },

  tabs: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4], marginTop: spacing[2] },
  tab: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full, backgroundColor: GREEN_LIGHT,
  },
  tabActive:    { backgroundColor: GREEN },
  tabTxt:       { fontSize: ms(typography.size.sm), fontWeight: typography.weight.semibold, color: GREEN },
  tabTxtActive: { color: '#fff' },

  emptyWrap:   { paddingVertical: spacing[8], alignItems: 'center', gap: spacing[2] },
  emptyTxt:    { fontSize: ms(typography.size.base), color: colors.muted, fontWeight: typography.weight.semibold },
  emptySubTxt: { fontSize: ms(typography.size.sm), color: colors.subtle },
})
