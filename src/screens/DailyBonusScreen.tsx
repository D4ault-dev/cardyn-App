import { RF } from '../util/responsive'
/**
 * DailyBonusScreen — Daily check-in & coin history
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Switch, Animated, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import {
  fetchStreakInfo, fetchBonusHistory,
  StreakInfo, BonusTransaction,
} from '../api/dailyBonus'
import storage from '../util/storage'
import client from '../api/client'

const GREEN       = colors.primary
const GREEN_DARK  = colors.primaryDark
const GREEN_LIGHT = colors.primaryLight

// ── Day dot in the 7-day streak row ──────────────────────────────────────────
function DayDot({ day, points, claimed, isToday }: {
  day: number; points: number; claimed: boolean; isToday: boolean
}) {
  return (
    <View style={dot.wrap}>
      <View style={[
        dot.circle,
        claimed  && dot.claimed,
        isToday  && !claimed && dot.today,
        !claimed && !isToday && dot.future,
      ]}>
        {claimed ? (
          <Feather name="check" size={14} color="#fff" />
        ) : (
          <Text style={[dot.pts, isToday && dot.ptsToday]}>{points}</Text>
        )}
      </View>
      <Text style={[dot.label, claimed && dot.labelClaimed]}>Day{day}</Text>
    </View>
  )
}

const dot = StyleSheet.create({
  wrap:   { alignItems: 'center', gap: 4 },
  circle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  claimed: { backgroundColor: GREEN, borderColor: GREEN },
  today:   { borderColor: GREEN, backgroundColor: GREEN_LIGHT },
  future:  { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  pts:     { fontSize: RF(10), fontWeight: typography.weight.bold, color: colors.muted },
  ptsToday:{ color: GREEN },
  label:   { fontSize: RF(10), color: colors.muted, fontWeight: typography.weight.medium },
  labelClaimed: { color: GREEN },
})

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: BonusTransaction }) {
  const isPos = tx.amount >= 0
  return (
    <View style={tx_.row}>
      <View style={{ flex: 1 }}>
        <Text style={tx_.title}>{tx.title}</Text>
        <Text style={tx_.sub}>{tx.subtitle}</Text>
      </View>
      <Text style={[tx_.amt, isPos ? tx_.pos : tx_.neg]}>
        {isPos ? '+' : ''}{tx.amount}
      </Text>
    </View>
  )
}

const tx_ = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  sub:   { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  amt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold },
  pos:   { color: GREEN },
  neg:   { color: colors.error },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
type Filter = 'all' | 'earned' | 'used'

export default function DailyBonusScreen(props: StackScreenProps<RootStackParams, 'DailyBonus'>) {
  const insets = useSafeAreaInsets()
  const [streak,      setStreak]      = useState<StreakInfo | null>(null)
  const [history,     setHistory]     = useState<BonusTransaction[]>([])
  const [totalCoins,  setTotalCoins]  = useState(0)
  const [earnedNgn,   setEarnedNgn]   = useState(0)
  const [filter,      setFilter]      = useState<Filter>('all')
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [notifOn,     setNotifOn]     = useState(true)
  const [checking,    setChecking]    = useState(false)
  const [justCheckedIn, setJustCheckedIn] = useState(false)

  // Coin bounce animation on check-in
  const coinScale = useRef(new Animated.Value(1)).current
  // Success flash animation
  const successOpacity = useRef(new Animated.Value(0)).current

  const load = useCallback(async (isRefresh = false) => {
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
    } catch { /* silently fail */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])
  const onRefresh = useCallback(() => { setRefreshing(true); load(true) }, [load])

  // Load notification preference from storage on mount
  useEffect(() => {
    storage.getItem('@tuka_daily_notif').then(v => {
      if (v !== null) setNotifOn(v === 'true')
    })
  }, [])

  // Save notification preference when toggled
  async function handleNotifToggle(val: boolean) {
    setNotifOn(val)
    await storage.setItem('@tuka_daily_notif', String(val))
    // Optionally sync to backend
    client.put('/tuka/user/updateLogin', { dailyNotif: val }).catch(() => {})
  }

  async function handleCheckIn() {
    if (!streak || streak.todayClaimed || checking) return
    setChecking(true)
    try {
      // Points are awarded on login — this refreshes and shows the animation
      await load(true)
      setJustCheckedIn(true)

      // Coin bounce
      Animated.sequence([
        Animated.spring(coinScale, { toValue: 1.4, useNativeDriver: true, tension: 200, friction: 5 }),
        Animated.spring(coinScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 5 }),
      ]).start()

      // Success flash
      Animated.sequence([
        Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()

      setTimeout(() => setJustCheckedIn(false), 2000)
    } finally {
      setChecking(false)
    }
  }

  // Determine today's day index (Mon=1 … Sun=7)
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay()

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <AppHeader title="Daily Bonus" onBack={() => props.navigation.goBack()} light />
        <View style={s.centered}><ActivityIndicator size="large" color={GREEN} /></View>
      </SafeAreaView>
    )
  }

  const days = streak?.days || []
  const alreadyClaimed = streak?.todayClaimed ?? false

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader title="Daily Bonus" onBack={() => props.navigation.goBack()} light />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} colors={[GREEN]} />}
      >
        {/* ── Coin balance card ── */}
        <View style={s.balanceCard}>
          <View style={s.balanceLeft}>
            <Animated.Text style={[s.coinEmoji, { transform: [{ scale: coinScale }] }]}>🪙</Animated.Text>
            <Text style={s.coinCount}>{totalCoins}</Text>
          </View>
          <View style={s.balanceRight}>
            <Text style={s.coinRate}>1Coin=₦1</Text>
            <Text style={s.earnedNgn}>You have earned ₦{earnedNgn.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── Daily streak card ── */}
        <View style={s.streakCard}>
          {/* Header row */}
          <View style={s.streakHeader}>
            <Text style={s.streakTitle}>Daily Coins</Text>
            <View style={s.notifRow}>
              <Text style={s.notifLabel}>Notifications</Text>
              <Switch
                value={notifOn}
                onValueChange={handleNotifToggle}
                trackColor={{ false: colors.border, true: GREEN }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          </View>

          {/* 7-day dots */}
          <View style={s.daysRow}>
            {days.map((d, i) => {
              const isToday = d.day === todayDow
              // Connect dots with a line
              return (
                <React.Fragment key={d.day}>
                  <DayDot
                    day={d.day}
                    points={d.points}
                    claimed={d.claimed}
                    isToday={isToday}
                  />
                  {i < days.length - 1 && (
                    <View style={[s.connector, d.claimed && s.connectorClaimed]} />
                  )}
                </React.Fragment>
              )
            })}
          </View>

          {/* Weekly progress */}
          {streak && (
            <View style={s.weekProgress}>
              <View style={s.weekProgressBar}>
                <View style={[s.weekProgressFill, {
                  width: `${Math.min((streak.weekPtsEarned / streak.weekCap) * 100, 100)}%` as any
                }]} />
              </View>
              <Text style={s.weekProgressTxt}>
                {streak.weekPtsEarned}/{streak.weekCap} pts this week
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
            {checking ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.checkBtnTxt}>
                {alreadyClaimed ? '✓  Checked In Today' : '🎁  Check-in & Earn Coins'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Success flash */}
          <Animated.View style={[s.successFlash, { opacity: successOpacity }]} pointerEvents="none">
            <Feather name="check-circle" size={20} color={GREEN} />
            <Text style={s.successTxt}>+{streak?.todayPoints || 2} coins earned!</Text>
          </Animated.View>
        </View>

        {/* ── History ── */}
        <View style={s.historyCard}>
          {/* Filter tabs */}
          <View style={s.tabs}>
            {(['all', 'earned', 'used'] as Filter[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.tab, filter === f && s.tabActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, filter === f && s.tabTxtActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Transactions */}
          {history.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTxt}>No transactions yet</Text>
            </View>
          ) : (
            history.map(tx => <TxRow key={tx.id} tx={tx} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: GREEN },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Balance card
  balanceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing[4], marginTop: spacing[4], marginBottom: spacing[3],
    borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.md,
  },
  balanceLeft: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: GREEN, borderRadius: radius.xl,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    marginRight: spacing[5],
  },
  coinEmoji: { fontSize: RF(28) },
  coinCount: { fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold, color: '#fff' },
  balanceRight: { flex: 1 },
  coinRate:  { fontSize: typography.size.base, color: colors.muted, marginBottom: spacing[1] },
  earnedNgn: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: GREEN },

  // Streak card
  streakCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.md,
  },
  streakHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[5],
  },
  streakTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  notifRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  notifLabel: { fontSize: typography.size.sm, color: colors.muted },

  daysRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[5],
  },
  connector: {
    flex: 1, height: 2, backgroundColor: colors.border, marginBottom: 16,
  },
  connectorClaimed: { backgroundColor: GREEN },

  weekProgress: { marginBottom: spacing[4] },
  weekProgressBar: {
    height: 6, backgroundColor: colors.border, borderRadius: 3,
    marginBottom: spacing[1], overflow: 'hidden',
  },
  weekProgressFill: {
    height: '100%', backgroundColor: GREEN, borderRadius: 3,
  },
  weekProgressTxt: {
    fontSize: typography.size.xs, color: colors.muted, textAlign: 'right',
  },

  checkBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
    marginTop: spacing[2],
  },
  checkBtnDone: { backgroundColor: GREEN },
  checkBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
  successFlash: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], marginTop: spacing[3],
    backgroundColor: GREEN_LIGHT, borderRadius: radius.full,
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
  },
  successTxt: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: GREEN,
  },

  // History card
  historyCard: {
    backgroundColor: '#fff',
    marginHorizontal: spacing[4],
    borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.md,
  },
  tabs: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  tab: {
    paddingHorizontal: spacing[5], paddingVertical: spacing[2],
    borderRadius: radius.full, backgroundColor: GREEN_LIGHT,
  },
  tabActive: { backgroundColor: GREEN },
  tabTxt:    { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: GREEN },
  tabTxtActive: { color: '#fff' },

  emptyWrap: { paddingVertical: spacing[8], alignItems: 'center' },
  emptyTxt:  { fontSize: typography.size.base, color: colors.muted },
})
