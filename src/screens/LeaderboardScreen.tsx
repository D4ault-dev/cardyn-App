import { RF, TAB_BAR_HEIGHT, tabBarClearance, ms } from '../util/responsive'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, FlatList,
  TouchableOpacity, RefreshControl, Image, Dimensions,
  StatusBar, Modal, ScrollView, Share, Animated,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ExpoClipboard from 'expo-clipboard'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import client from '../api/client'
import {
  fetchLeaderboard, fetchMyRank, fetchInvitationLeaderboard, fetchCycles,
  LeaderboardEntry, InvitationEntry, CycleInfo,
} from '../api/leaderboard'

const { width: W } = Dimensions.get('window')

// ── Helpers ───────────────────────────────────────────────────────────────────
function maskPhone(name: string, phone?: string) {
  const src = phone && phone.length >= 6 ? phone : name
  if (src.length >= 6) return src.slice(0, 3) + '**' + src.slice(-3)
  return src
}
function fmtNgn(n: number) {
  if (!n) return '₦0'
  if (n >= 1000000) return '₦' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '₦' + Math.round(n / 1000) + 'K'
  return '₦' + Math.round(n).toLocaleString()
}

function fmtPts(n: number) {
  return (n || 0).toLocaleString() + ' pts'
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size, avatarUrl, isMe, border }: {
  name: string; size: number; avatarUrl?: string | null; isMe?: boolean; border?: boolean
}) {
  const uri = avatarUrl ? resolveImageUrl(avatarUrl) : null
  return (
    <View style={[
      av.wrap, { width: size, height: size, borderRadius: size / 2 },
      isMe && av.me,
      border && { borderWidth: 3, borderColor: '#fff' },
    ]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />
        : <Text style={[av.ini, { fontSize: size * 0.36 }]}>{(name || 'U')[0].toUpperCase()}</Text>
      }
    </View>
  )
}
const av = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  me:   { backgroundColor: colors.primary },
  ini:  { fontWeight: '800', color: '#fff' },
})

// ── Top 3 Podium ──────────────────────────────────────────────────────────────
function Podium({ entries, myUserId }: { entries: LeaderboardEntry[]; myUserId: number | null }) {
  const order = [entries[1], entries[0], entries[2]]
  const ranks = [2, 1, 3]
  const sizes = [52, 64, 52]   // smaller avatars
  const heights = [0, 16, 0]   // less elevation difference

  return (
    <View style={pod.wrap}>
      {order.map((e, i) => {
        const rank = ranks[i]
        const size = sizes[i]
        const isMe = e?.userId === myUserId
        const sales = (e as any)?.totalSales || 0
        const trades = (e as any)?.tradeCount || 0
        const phone = (e as any)?.phone || e?.displayName || ''
        return (
          <View key={rank} style={[pod.slot, { marginBottom: heights[i] }]}>
            {e ? (
              <>
                {rank === 1 && <Text style={pod.crown}>👑</Text>}
                <View style={[pod.avatarRing, rank === 1 && pod.avatarRingGold, rank === 2 && pod.avatarRingSilver, rank === 3 && pod.avatarRingBronze]}>
                  <Avatar name={e.displayName} size={size} avatarUrl={e.avatar} isMe={isMe} border />
                </View>
                <View style={[pod.badge, rank === 1 && pod.badgeGold, rank === 2 && pod.badgeSilver, rank === 3 && pod.badgeBronze]}>
                  <Text style={pod.badgeTxt}>{rank}</Text>
                </View>
                <Text style={pod.name} numberOfLines={1}>{maskPhone(e.displayName, phone)}</Text>
                <Text style={pod.sales}>{fmtPts(e.totalPoints)}</Text>
              </>
            ) : (
              <View style={[pod.avatarRing, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
            )}
          </View>
        )
      })}
    </View>
  )
}
const pod = StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3], gap: spacing[3] },
  slot:            { flex: 1, alignItems: 'center', gap: 3 },
  crown:           { fontSize: RF(16), marginBottom: -2 },
  avatarRing:      { borderRadius: 999, padding: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  avatarRingGold:  { backgroundColor: 'rgba(255,215,0,0.25)' },
  avatarRingSilver:{ backgroundColor: 'rgba(192,192,192,0.25)' },
  avatarRingBronze:{ backgroundColor: 'rgba(205,127,50,0.25)' },
  badge:           { width: 18, height: 18, borderRadius: 9, backgroundColor: '#888', alignItems: 'center', justifyContent: 'center', marginTop: -6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  badgeGold:       { backgroundColor: '#FFD700' },
  badgeSilver:     { backgroundColor: '#C0C0C0' },
  badgeBronze:     { backgroundColor: '#CD7F32' },
  badgeTxt:        { fontSize: RF(9), fontWeight: '800', color: '#fff' },
  name:            { fontSize: RF(11), fontWeight: '700', color: '#fff', textAlign: 'center', maxWidth: 80 },
  sales:           { fontSize: RF(12), fontWeight: '800', color: '#FFD700', textAlign: 'center' },
  trades:          { fontSize: RF(9), color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
})

// ── List Row ──────────────────────────────────────────────────────────────────
function ListRow({ item, isMe }: { item: LeaderboardEntry; isMe: boolean }) {
  const sales = (item as any).totalSales || 0
  const trades = (item as any).tradeCount || 0
  const phone = (item as any).phone || item.displayName
  return (
    <View style={[lr.row, isMe && lr.rowMe]}>
      <Text style={[lr.rank, isMe && lr.rankMe]}>{item.rank}</Text>
      <Avatar name={item.displayName} size={42} avatarUrl={item.avatar} isMe={isMe} />
      <View style={lr.info}>
        <Text style={[lr.name, isMe && lr.nameMe]}>{maskPhone(item.displayName, phone)}</Text>
        <Text style={[lr.sub, isMe && lr.subMe]}>{fmtPts(item.totalPoints)}</Text>
      </View>
      <Text style={[lr.amt, isMe && lr.amtMe]}>{fmtPts(item.totalPoints)}</Text>
    </View>
  )
}
const lr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: spacing[3], backgroundColor: '#fff' },
  rowMe:  { backgroundColor: '#F0FFF8' },
  rank:   { width: 28, fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#bbb', textAlign: 'center' },
  rankMe: { color: colors.primary },
  info:   { flex: 1 },
  name:   { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#1A1A1A' },
  nameMe: { color: colors.primary },
  sub:    { fontSize: typography.size.sm, color: '#999', marginTop: 1 },
  subMe:  { color: colors.primary + '99' },
  amt:    { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#1A1A1A' },
  amtMe:  { color: colors.primary },
})

// ── Invitation Row ────────────────────────────────────────────────────────────
function InvRow({ item, isMe }: { item: InvitationEntry; isMe: boolean }) {
  const phone = item.phone || item.displayName
  return (
    <View style={[lr.row, isMe && lr.rowMe]}>
      <Text style={[lr.rank, isMe && lr.rankMe]}>{item.rank}</Text>
      <Avatar name={item.displayName} size={42} avatarUrl={item.avatar} isMe={isMe} />
      <View style={lr.info}>
        <Text style={[lr.name, isMe && lr.nameMe]}>{maskPhone(item.displayName, phone)}</Text>
        <Text style={[lr.sub, isMe && lr.subMe]}>{item.totalInvites} invites</Text>
      </View>
      <Text style={[lr.amt, isMe && lr.amtMe]}>{item.totalInvites} 👥</Text>
    </View>
  )
}

// ── Cycle Picker ──────────────────────────────────────────────────────────────
function CyclePicker({ visible, cycles, selectedId, onSelect, onClose }: {
  visible: boolean; cycles: CycleInfo[]; selectedId: number | null
  onSelect: (c: CycleInfo) => void; onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' }}>
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
                {c.id === selectedId && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
const cp = StyleSheet.create({
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing[5], paddingBottom: spacing[10], maxHeight: '65%' },
  handle:        { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[4] },
  title:         { fontSize: RF(17), fontWeight: '700', color: '#1A1A1A', marginBottom: spacing[3] },
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowActive:     { backgroundColor: colors.primaryLight + '30' },
  rowName:       { fontSize: RF(15), fontWeight: '600', color: '#333' },
  rowNameActive: { color: colors.primary },
  rowDate:       { fontSize: RF(12), color: '#999', marginTop: 2 },
  activeBadge:   { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: spacing[2] },
  activeTxt:     { fontSize: RF(11), fontWeight: '700', color: colors.primary },
})

// ── Invitation Tab Content ────────────────────────────────────────────────────
function InvitationTab({ myUserId, invEntries, refreshing, onRefresh, navigation }: {
  myUserId: number | null; invEntries: InvitationEntry[]
  refreshing: boolean; onRefresh: () => void; navigation: any
}) {
  const [inviteCode,   setInviteCode]   = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [totalInvites, setTotalInvites] = useState(0)
  const [tradedCount,  setTradedCount]  = useState(0)
  const [bonus,        setBonus]        = useState(30)
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    client.get('/tuka/user/referrals').then(res => {
      const d = res.data?.data
      if (d) {
        setInviteCode(d.inviteCode || '')
        setReferralLink(d.referralLink || `https://fufucards.app/ref/${d.inviteCode}`)
        setTotalInvites(d.totalInvites || 0)
        setTradedCount(d.tradedCount || 0)
        setBonus(d.referralBonus || 30)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const shareUrl = referralLink || `https://fufucards.app/ref/${inviteCode}`

  async function handleCopy() {
    await ExpoClipboard.setStringAsync(shareUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join FUFU CARDS — sell gift cards instantly!\n\nUse my invite code: ${inviteCode}\n\n${shareUrl}`,
        url: shareUrl,
        title: 'Join FUFU CARDS',
      })
    } catch {}
  }

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )

  return (
    <FlatList
      data={invEntries}
      keyExtractor={e => String(e.userId)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarClearance(insets.bottom) + 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View style={it.container}>

          {/* ── Stats ── */}
          <View style={it.statsRow}>
            <View style={it.statItem}>
              <Text style={it.statNum}>{totalInvites}</Text>
              <Text style={it.statLbl}>Invited</Text>
            </View>
            <View style={it.statDivider} />
            <View style={it.statItem}>
              <Text style={it.statNum}>{tradedCount}</Text>
              <Text style={it.statLbl}>Traded</Text>
            </View>
            <View style={it.statDivider} />
            <View style={it.statItem}>
              <Text style={[it.statNum, { color: colors.primary }]}>+{bonus} pts</Text>
              <Text style={it.statLbl}>Per invite</Text>
            </View>
          </View>

          {/* ── Invite code ── */}
          <View style={it.card}>
            <Text style={it.cardTitle}>Your Invite Code</Text>
            <View style={it.codeRow}>
              <Text style={it.code}>{inviteCode || '——'}</Text>
              <TouchableOpacity
                style={it.copyCodeBtn}
                onPress={async () => {
                  await ExpoClipboard.setStringAsync(inviteCode)
                  setCopied(true); setTimeout(() => setCopied(false), 2500)
                }}
                activeOpacity={0.8}>
                <Feather name="copy" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Link */}
            <View style={it.linkRow}>
              <Text style={it.linkText} numberOfLines={1}>{shareUrl}</Text>
              <TouchableOpacity
                style={[it.copyLinkBtn, copied && it.copyLinkBtnDone]}
                onPress={handleCopy}
                activeOpacity={0.8}>
                <Text style={it.copyLinkTxt}>{copied ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>

            {/* Share button */}
            <TouchableOpacity style={it.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Feather name="share-2" size={16} color="#fff" style={{ marginRight: spacing[2] }} />
              <Text style={it.shareBtnTxt}>Share Invite Link</Text>
            </TouchableOpacity>
          </View>

          {/* ── How it works ── */}
          <View style={it.card}>
            <Text style={it.cardTitle}>How it works</Text>
            {[
              { step: '1', text: 'Share your invite code or link with friends' },
              { step: '2', text: 'They sign up using your code' },
              { step: `3`, text: `You earn +${bonus} pts when they complete their first trade` },
            ].map((item) => (
              <View key={item.step} style={it.stepRow}>
                <View style={it.stepBadge}>
                  <Text style={it.stepNum}>{item.step}</Text>
                </View>
                <Text style={it.stepText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {invEntries.length > 0 && (
            <Text style={it.sectionTitle}>Invitation Leaderboard</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <Feather name="users" size={48} color={colors.border} />
          <Text style={s.emptyTitle}>No invitations yet</Text>
          <TouchableOpacity style={s.unlockBtn} onPress={handleShare}>
            <Text style={s.unlockBtnTxt}>Invite Friends</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => <InvRow item={item} isMe={item.userId === myUserId} />}
    />
  )
}

const it = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[4] },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[5], ...shadow.sm,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  statNum:     { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: 3 },
  statLbl:     { fontSize: typography.size.sm, color: colors.muted },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[5], ...shadow.sm,
  },
  cardTitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[4],
  },

  // Code
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primaryLight, borderRadius: radius.lg,
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    marginBottom: spacing[3],
  },
  code: {
    fontSize: RF(26), fontWeight: typography.weight.extrabold,
    color: colors.primary, letterSpacing: 6,
  },
  copyCodeBtn: {
    width: 36, height: 36, borderRadius: radius.lg,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },

  // Link
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.background, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[4],
  },
  linkText:        { flex: 1, fontSize: typography.size.sm, color: colors.muted },
  copyLinkBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  copyLinkBtnDone: { backgroundColor: colors.success },
  copyLinkTxt:     { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#fff' },

  // Share
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[4],
  },
  shareBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#fff' },

  // Steps
  stepRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4], marginBottom: spacing[3] },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNum:  { fontSize: typography.size.sm, fontWeight: typography.weight.extrabold, color: colors.primary },
  stepText: { flex: 1, fontSize: typography.size.base, color: colors.body, lineHeight: 22, paddingTop: 3 },

  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginTop: spacing[2],
  },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LeaderboardScreen(props: StackScreenProps<RootStackParams, 'Leaderboard'>) {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const myUserId = user.isPresent() ? parseInt(user.getOrThrow().uid) : null

  const [tab,           setTab]           = useState<'Leaderboard' | 'Invitation'>('Leaderboard')

  // Tab animation — sliding underline indicator + content fade
  const tabIndicatorX = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(1)).current

  function switchTab(newTab: 'Leaderboard' | 'Invitation') {
    if (newTab === tab) return
    // Fade out → switch → fade in
    Animated.timing(contentOpacity, {
      toValue: 0, duration: 120, useNativeDriver: true,
    }).start(() => {
      setTab(newTab)
      // Slide indicator
      Animated.spring(tabIndicatorX, {
        toValue: newTab === 'Leaderboard' ? 0 : 1,
        useNativeDriver: true,
        tension: 120, friction: 14,
      }).start()
      // Fade content back in
      Animated.timing(contentOpacity, {
        toValue: 1, duration: 180, useNativeDriver: true,
      }).start()
    })
  }
  const [entries,       setEntries]       = useState<LeaderboardEntry[]>([])
  const [invEntries,    setInvEntries]    = useState<InvitationEntry[]>([])
  const [myRank,        setMyRank]        = useState<{ rank: number | null; totalPoints: number; cycleEndsAt: string | null } | null>(null)
  const [cycles,        setCycles]        = useState<CycleInfo[]>([])
  const [selectedCycle, setSelectedCycle] = useState<CycleInfo | null>(null)
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)

  const load = useCallback(async (isRefresh = false, cycleId?: number) => {
    if (!isRefresh) setLoading(true)
    try {
      const [lb, rank, inv, cyc] = await Promise.all([
        fetchLeaderboard(cycleId), fetchMyRank(), fetchInvitationLeaderboard(), fetchCycles(),
      ])
      setEntries(lb.leaderboard); setMyRank(rank); setInvEntries(inv); setCycles(cyc)
      if (!selectedCycle && lb.cycle) setSelectedCycle(lb.cycle as CycleInfo)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  const myEntry = entries.find(e => e.userId === myUserId)
  const myPosition = myEntry?.rank ?? myRank?.rank ?? null
  const cycleLabel = selectedCycle?.name || 'Current Cycle'

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Dark gradient header ── */}
      <LinearGradient colors={['#0D1B2A', '#1B2838', '#1A3A4A']} style={s.headerGrad}>
        <SafeAreaView edges={['top']}>
          {/* Nav */}
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
              <Feather name="chevron-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={s.tabRow}>
              {(['Leaderboard', 'Invitation'] as const).map((t, i) => (
                <TouchableOpacity key={t} onPress={() => switchTab(t)} style={s.tabBtn} activeOpacity={0.7}>
                  <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
              {/* Animated sliding underline */}
              <Animated.View style={[
                s.tabUnderline,
                {
                  transform: [{
                    translateX: tabIndicatorX.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (W - 36 - 36) / 2],
                    }),
                  }],
                },
              ]} />
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* Header content */}
          {tab === 'Leaderboard' ? (
            <>
              <View style={s.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroTitle}>Top Traders</Text>
                  <TouchableOpacity style={s.cyclePill} onPress={() => setPickerOpen(true)}>
                    <Feather name="calendar" size={13} color="rgba(255,255,255,0.8)" style={{ marginRight: 5 }} />
                    <Text style={s.cyclePillTxt}>{cycleLabel}</Text>
                    <Feather name="chevron-down" size={13} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
                <View style={s.medalEmoji}>
                  <Text style={{ fontSize: RF(52) }}>🏅</Text>
                </View>
              </View>
              {/* Top 3 podium inside header */}
              {!loading && top3.length > 0 && <Podium entries={top3} myUserId={myUserId} />}
            </>
          ) : (
            <View style={s.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>Invite & Earn</Text>
                <Text style={s.heroSub}>Refer friends and climb the ranks</Text>
              </View>
              <Text style={{ fontSize: RF(52) }}>🤝</Text>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* ── Content — fades when switching tabs ── */}
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      {loading ? (
        <View style={s.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : tab === 'Leaderboard' ? (
        <FlatList
          data={rest}
          keyExtractor={e => String(e.userId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarClearance(insets.bottom) + 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            entries.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: RF(48), marginBottom: spacing[3] }}>📭</Text>
                <Text style={s.emptyTitle}>No results yet</Text>
                <TouchableOpacity style={s.unlockBtn} onPress={() => props.navigation.navigate('Sell' as any)}>
                  <Text style={s.unlockBtnTxt}>Start Trading</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => <ListRow item={item} isMe={item.userId === myUserId} />}
        />
      ) : (
        <InvitationTab
          myUserId={myUserId}
          invEntries={invEntries}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true) }}
          navigation={props.navigation}
        />
      )}
      </Animated.View>

      {/* ── Sticky bottom: my rank (leaderboard tab only) ── */}
      {tab === 'Leaderboard' && myUserId && (
        <View style={[s.myRankBar, {
          bottom: tabBarClearance(insets.bottom) - TAB_BAR_HEIGHT + 8,
          paddingBottom: spacing[3],
        }]}>
          <Text style={s.myRankPos}>{myPosition ? (myPosition > 999 ? '999+' : myPosition) : '999+'}</Text>
          <Avatar name={user.isPresent() ? user.getOrThrow().name : 'Me'} size={34} isMe />
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text style={s.myRankName} numberOfLines={1}>{user.isPresent() ? user.getOrThrow().name : 'You'}</Text>
            <Text style={s.myRankSub}>{fmtPts(myRank?.totalPoints || 0)}</Text>
          </View>
          <TouchableOpacity style={s.inviteBtn} onPress={() => switchTab('Invitation')}>
            <Text style={s.inviteBtnTxt}>Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      <CyclePicker visible={pickerOpen} cycles={cycles} selectedId={selectedCycle?.id ?? null}
        onSelect={c => { setSelectedCycle(c); load(true, c.id) }} onClose={() => setPickerOpen(false)} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  headerGrad: { paddingBottom: 0 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: spacing[8], position: 'relative' },
  tabBtn: { alignItems: 'center', paddingBottom: spacing[2], paddingHorizontal: spacing[3], flex: 1 },
  tabTxt: { fontSize: typography.size.md, fontWeight: typography.weight.medium, color: 'rgba(255,255,255,0.6)' },
  tabTxtActive: { color: '#fff', fontWeight: typography.weight.extrabold },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0,
    width: '50%', height: 3, backgroundColor: '#fff', borderRadius: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2] },
  heroTitle: { fontSize: RF(24), fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: RF(13), color: 'rgba(255,255,255,0.6)' },
  cyclePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  cyclePillTxt: { fontSize: RF(12), fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  medalEmoji: { alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: RF(16), color: '#999', marginBottom: spacing[6] },
  unlockBtn: { backgroundColor: '#1A1A1A', borderRadius: 30, paddingHorizontal: 32, paddingVertical: 14 },
  unlockBtnTxt: { fontSize: RF(15), fontWeight: '700', color: '#fff' },
  myRankBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: spacing[2] },
  myRankPos: { fontSize: RF(14), fontWeight: '700', color: '#999', width: 36, textAlign: 'center' },
  myRankName: { fontSize: RF(14), fontWeight: '600', color: '#1A1A1A' },
  myRankSub: { fontSize: RF(11), color: '#999' },
  inviteBtn: { backgroundColor: '#1A1A1A', borderRadius: 24, paddingHorizontal: ms(20), paddingVertical: ms(10), minHeight: ms(40), justifyContent: 'center' },
  inviteBtnTxt: { fontSize: RF(14), fontWeight: '700', color: '#fff' },
})
