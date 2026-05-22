import { RF, TAB_BAR_HEIGHT, tabBarClearance, ms } from '../util/responsive'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, Dimensions,
  StatusBar, Modal, ScrollView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { AppRefreshControl } from '../components/Spinner'
import { LeaderboardSkeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import {
  fetchLeaderboard, fetchMyRank, fetchCycles,
  LeaderboardEntry, CycleInfo,
} from '../api/leaderboard'

const { width: W } = Dimensions.get('window')

// ── Helpers ───────────────────────────────────────────────────────────────────
function maskName(name: string, phone?: string) {
  const src = phone && phone.length >= 6 ? phone : name
  if (!src) return '—'
  if (src.length >= 6) return src.slice(0, 3) + '**' + src.slice(-3)
  return src
}

function fmtPts(n: number) {
  if (!n) return '0pts'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'Mpts'
  if (n >= 1_000) return Math.round(n / 1_000) + 'Kpts'
  return n.toLocaleString() + 'pts'
}

function useCountdown(endsAt: string | null) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!endsAt) return
    function tick() {
      const diff = new Date(endsAt!).getTime() - Date.now()
      if (diff <= 0) { setLabel('Ended'); return }
      const d = Math.floor(diff / 86_400_000)
      const h = Math.floor((diff % 86_400_000) / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      if (d > 0) setLabel(`${d}d ${h}h left`)
      else if (h > 0) setLabel(`${h}h ${m}m left`)
      else setLabel(`${m}m left`)
    }
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [endsAt])
  return label
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size, avatarUrl, ringColor }: {
  name: string; size: number; avatarUrl?: string | null; ringColor?: string
}) {
  const uri = avatarUrl ? resolveImageUrl(avatarUrl) : null
  const [imgError, setImgError] = React.useState(false)

  return (
    <View style={[
      av.ring,
      {
        width: size + 6, height: size + 6,
        borderRadius: (size + 6) / 2,
        borderColor: ringColor || 'transparent',
        borderWidth: ringColor ? 3 : 0,
      },
    ]}>
      <View style={[av.inner, { width: size, height: size, borderRadius: size / 2 }]}>
        {uri && !imgError
          ? <Image
              source={{ uri }}
              style={{ width: size, height: size, borderRadius: size / 2 }}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          : <Image
              source={require('../../assets/default-avatar.png')}
              style={{ width: size, height: size, borderRadius: size / 2 }}
              resizeMode="cover"
            />
        }
      </View>
    </View>
  )
}
const av = StyleSheet.create({
  ring:  { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  inner: { overflow: 'hidden', backgroundColor: '#C8D0D8', alignItems: 'center', justifyContent: 'center' },
})

// ── Top 3 Podium ──────────────────────────────────────────────────────────────
// Layout: [3rd] [1st — center, larger] [2nd]
const RING_COLORS = ['#FFD700', '#1A1A1A', '#1A1A1A']  // gold for 1st, dark for 2nd/3rd
const AVATAR_SIZES = [64, 80, 64]  // 1st is bigger

function TopThree({ entries, myUserId }: { entries: LeaderboardEntry[]; myUserId: number | null }) {
  // Display order: 3rd (left), 1st (center), 2nd (right)
  const slots  = [entries[2], entries[0], entries[1]]
  const ranks  = [3, 1, 2]
  const sizes  = [AVATAR_SIZES[2], AVATAR_SIZES[0], AVATAR_SIZES[1]]
  const rings  = [RING_COLORS[2], RING_COLORS[0], RING_COLORS[1]]

  return (
    <View style={t3.wrap}>
      {slots.map((e, i) => {
        const rank = ranks[i]
        const size = sizes[i]
        const ring = rings[i]
        const isMe = e?.userId === myUserId
        const phone = (e as any)?.phone || ''
        const isCenter = rank === 1

        return (
          <View key={rank} style={[t3.slot, isCenter && t3.slotCenter]}>
            {e ? (
              <>
                {/* Rank badge */}
                <View style={[t3.rankBadge, isCenter && t3.rankBadgeCenter]}>
                  <Text style={[t3.rankBadgeTxt, isCenter && t3.rankBadgeTxtCenter]}>{rank}</Text>
                </View>

                {/* Avatar */}
                <Avatar name={e.displayName} size={size} avatarUrl={e.avatar} ringColor={ring} />

                {/* Name */}
                <Text style={[t3.name, isMe && t3.nameMe]} numberOfLines={1}>
                  {maskName(e.displayName, phone)}
                </Text>

                {/* Points */}
                <Text style={[t3.pts, isCenter && t3.ptsCenter]}>
                  {fmtPts(e.totalPoints)}
                </Text>
              </>
            ) : (
              <View style={[t3.emptyAvatar, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const t3 = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[5],
    gap: spacing[4],
  },
  slot: {
    flex: 1, alignItems: 'center', gap: spacing[2],
  },
  slotCenter: {
    marginBottom: spacing[2],  // lift center slot slightly
  },
  rankBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: -spacing[1],
    zIndex: 1,
  },
  rankBadgeCenter: {
    backgroundColor: '#FFD700',
  },
  rankBadgeTxt: {
    fontSize: RF(11), fontWeight: '900', color: '#fff',
  },
  rankBadgeTxtCenter: {
    color: '#1A1A1A',
  },
  name: {
    fontSize: RF(12), fontWeight: '600', color: '#1A1A1A',
    textAlign: 'center', maxWidth: 90,
  },
  nameMe: { color: colors.accent },
  pts: {
    fontSize: RF(13), fontWeight: '800', color: '#1A1A1A',
    textAlign: 'center',
  },
  ptsCenter: {
    fontSize: RF(15),
  },
  emptyAvatar: {
    backgroundColor: '#E8E8E8',
  },
})

// ── List Row (pill card style) ────────────────────────────────────────────────
function ListRow({ item, isMe }: { item: LeaderboardEntry; isMe: boolean }) {
  const phone = (item as any).phone || ''
  // Trend: use rewardLabel as a proxy — if null assume neutral, otherwise random for demo
  // In production the backend should return a `trend` field
  const trend = (item as any).trend as 'up' | 'down' | null ?? null

  return (
    <View style={[lr.card, isMe && lr.cardMe]}>
      {/* Rank */}
      <Text style={[lr.rank, isMe && lr.rankMe]}>{item.rank}</Text>

      {/* Avatar */}
      <Avatar name={item.displayName} size={40} avatarUrl={item.avatar} />

      {/* Name */}
      <Text style={[lr.name, isMe && lr.nameMe]} numberOfLines={1}>
        {isMe ? 'You' : maskName(item.displayName, phone)}
      </Text>

      {/* Points + trend */}
      <View style={lr.right}>
        <Text style={[lr.pts, isMe && lr.ptsMe]}>{fmtPts(item.totalPoints)}</Text>
        {trend === 'up' && <Feather name="arrow-up" size={16} color="#22C55E" />}
        {trend === 'down' && <Feather name="arrow-down" size={16} color="#EF4444" />}
      </View>
    </View>
  )
}

const lr = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 50,  // full pill
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
    ...shadow.sm,
  },
  cardMe: {
    backgroundColor: '#E8EAF6',  // light purple tint — matches reference
  },
  rank: {
    width: 24, fontSize: RF(14), fontWeight: '700',
    color: '#9CA3AF', textAlign: 'center',
  },
  rankMe: { color: colors.primary },
  name: {
    flex: 1, fontSize: RF(14), fontWeight: '600', color: '#1A1A1A',
  },
  nameMe: { color: colors.primary, fontWeight: '700' },
  right: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  pts: {
    fontSize: RF(14), fontWeight: '800', color: '#1A1A1A',
  },
  ptsMe: { color: colors.primary },
})

// ── Cycle Picker ──────────────────────────────────────────────────────────────
function CyclePicker({ visible, cycles, selectedId, onSelect, onClose }: {
  visible: boolean; cycles: CycleInfo[]; selectedId: number | null
  onSelect: (c: CycleInfo) => void; onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={cp.sheet}>
          <View style={cp.handle} />
          <Text style={cp.title}>Select Period</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {cycles.map(c => (
              <TouchableOpacity key={c.id} style={[cp.row, c.id === selectedId && cp.rowActive]}
                onPress={() => { onSelect(c); onClose() }} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={[cp.rowName, c.id === selectedId && cp.rowNameActive]}>{c.name}</Text>
                  <Text style={cp.rowDate}>{c.startDate?.slice(0, 10)} → {c.endDate?.slice(0, 10)}</Text>
                </View>
                {c.isActive && <View style={cp.activeBadge}><Text style={cp.activeTxt}>Active</Text></View>}
                {c.id === selectedId && <Feather name="check" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
const cp = StyleSheet.create({
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing[5], paddingBottom: spacing[10], maxHeight: '65%' },
  handle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[4] },
  title: { fontSize: RF(17), fontWeight: '700', color: '#1A1A1A', marginBottom: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowActive: { backgroundColor: colors.primaryLight + '30' },
  rowName: { fontSize: RF(15), fontWeight: '600', color: '#333' },
  rowNameActive: { color: colors.accent },
  rowDate: { fontSize: RF(12), color: '#999', marginTop: 2 },
  activeBadge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: spacing[2] },
  activeTxt: { fontSize: RF(11), fontWeight: '700', color: colors.accent },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LeaderboardScreen(props: StackScreenProps<RootStackParams, 'Leaderboard'>) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const myUserId = user.isPresent() ? parseInt(user.getOrThrow().uid) : null

  const [entries,       setEntries]       = useState<LeaderboardEntry[]>([])
  const [myRank,        setMyRank]        = useState<{ rank: number | null; totalPoints: number; cycleEndsAt: string | null } | null>(null)
  const [cycles,        setCycles]        = useState<CycleInfo[]>([])
  const [selectedCycle, setSelectedCycle] = useState<CycleInfo | null>(null)
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)

  const countdown = useCountdown(myRank?.cycleEndsAt ?? selectedCycle?.endDate ?? null)

  const load = useCallback(async (isRefresh = false, cycleId?: number) => {
    if (!isRefresh) setLoading(true)
    try {
      const [lb, rank, cyc] = await Promise.all([
        fetchLeaderboard(cycleId), fetchMyRank(), fetchCycles(),
      ])
      setEntries(lb.leaderboard)
      setMyRank(rank)
      setCycles(cyc)
      if (!selectedCycle && lb.cycle) setSelectedCycle(lb.cycle as CycleInfo)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  const myEntry = entries.find(e => e.userId === myUserId)
  const myPosition = myEntry?.rank ?? myRank?.rank ?? null
  const myPoints   = myEntry?.totalPoints ?? myRank?.totalPoints ?? 0
  const cycleLabel = selectedCycle?.name || 'This Cycle'

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: getStatusBarHeight() + spacing[2] }]}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topTitle}>Leaderboard</Text>
        <TouchableOpacity style={s.cyclePill} onPress={() => setPickerOpen(true)}>
          <Feather name="calendar" size={13} color="#666" />
          <Text style={s.cyclePillTxt}>{cycleLabel}</Text>
          <Feather name="chevron-down" size={13} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Countdown */}
      {!!countdown && (
        <View style={s.countdownRow}>
          <Feather name="clock" size={12} color={colors.accent} />
          <Text style={s.countdownTxt}>{countdown}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, backgroundColor: '#F3F4F8' }}>
          <LeaderboardSkeleton />
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={e => String(e.userId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: tabBarClearance(insets.bottom) + 80,
          }}
          style={s.list}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true) }}
            />
          }
          ListHeaderComponent={
            <>
              {/* Top 3 — white background section */}
              <View style={s.top3Section}>
                {top3.length > 0
                  ? <TopThree entries={top3} myUserId={myUserId} />
                  : <View style={{ height: 140 }} />
                }
              </View>

              {/* Transition to list section */}
              <View style={s.listSection}>
                {rest.length > 0 && (
                  <View style={s.listSectionPad} />
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            top3.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: RF(40), marginBottom: spacing[3] }}>📭</Text>
                <Text style={s.emptyTitle}>No rankings yet</Text>
                <Text style={s.emptySub}>Complete trades to earn points and climb the board</Text>
                <TouchableOpacity style={s.startBtn} onPress={() => props.navigation.navigate('SellCard' as any)}>
                  <Text style={s.startBtnTxt}>Start Trading</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ListRow item={item} isMe={item.userId === myUserId} />
          )}
        />
      )}

      {/* ── Sticky my-rank bar ── */}
      {!loading && myUserId && (
        <View style={[s.myRankBar, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
          <Text style={s.myRankPos}>
            {myPosition ? (myPosition > 999 ? '999+' : `#${myPosition}`) : '—'}
          </Text>
          <Avatar
            name={user.isPresent() ? user.getOrThrow().name : 'Me'}
            size={32}
            ringColor={colors.accent}
          />
          <View style={{ flex: 1, marginLeft: spacing[2] }}>
            <Text style={s.myRankName} numberOfLines={1}>
              {user.isPresent() ? user.getOrThrow().name : 'You'}
            </Text>
            <Text style={s.myRankPts}>{fmtPts(myPoints)}</Text>
          </View>
          <TouchableOpacity
            style={s.earnBtn}
            onPress={() => props.navigation.navigate('SellCard' as any)}
            activeOpacity={0.85}>
            <Text style={s.earnBtnTxt}>+ Earn Points</Text>
          </TouchableOpacity>
        </View>
      )}

      <CyclePicker
        visible={pickerOpen}
        cycles={cycles}
        selectedId={selectedCycle?.id ?? null}
        onSelect={c => { setSelectedCycle(c); load(true, c.id) }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F8' },

  // Top bar — white
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  topTitle: {
    flex: 1, fontSize: RF(18), fontWeight: '800', color: '#1A1A1A', textAlign: 'center',
  },
  cyclePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F8', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  cyclePillTxt: { fontSize: RF(11), fontWeight: '600', color: '#666' },

  countdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: '#fff',
    paddingBottom: spacing[2],
  },
  countdownTxt: { fontSize: RF(11), fontWeight: '700', color: colors.accent },

  // Top 3 section — white bg
  top3Section: {
    backgroundColor: '#fff',
    paddingTop: spacing[4],
  },

  // List section — light purple/grey bg
  list: { backgroundColor: '#F3F4F8' },
  listSection: { backgroundColor: '#F3F4F8' },
  listSectionPad: { height: spacing[4] },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing[8] },
  emptyTitle: { fontSize: RF(18), fontWeight: '700', color: '#333', marginBottom: spacing[2] },
  emptySub: { fontSize: RF(13), color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: spacing[6] },
  startBtn: { backgroundColor: '#1A1A1A', borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14 },
  startBtnTxt: { fontSize: RF(15), fontWeight: '700', color: '#fff' },

  // My rank bar
  myRankBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8',
    gap: spacing[2],
    ...shadow.sm,
  },
  myRankPos: {
    fontSize: RF(13), fontWeight: '800', color: colors.accent,
    width: 36, textAlign: 'center',
  },
  myRankName: { fontSize: RF(13), fontWeight: '700', color: '#1A1A1A' },
  myRankPts:  { fontSize: RF(11), color: '#999', marginTop: 1 },
  earnBtn: {
    backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: ms(16), paddingVertical: ms(9),
  },
  earnBtnTxt: { fontSize: RF(13), fontWeight: '800', color: '#fff' },
})
