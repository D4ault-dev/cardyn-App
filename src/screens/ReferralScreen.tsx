import { RF } from '../util/responsive'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Share, Modal,
  Animated, Image, Alert, StatusBar, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import * as ExpoClipboard from 'expo-clipboard'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { GenericListSkeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import client from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type ReferredUser = {
  userId: number
  name: string
  avatar: string | null
  tradeCount: number
  status: 'pending' | 'traded'
  claimable: boolean
  claimed: boolean
  joinedAt: string
}

type ReferralData = {
  inviteCode: string
  referralLink: string
  totalInvites: number
  pendingCount: number
  tradedCount: number
  referralBonus: number
  referredUsers: ReferredUser[]
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size, avatarUrl }: { name: string; size: number; avatarUrl?: string | null }) {
  const imgUri = avatarUrl ? resolveImageUrl(avatarUrl) : null
  const ini = name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {imgUri
        ? <Image source={{ uri: imgUri }} style={{ width: size, height: size }} resizeMode="cover" />
        : <Text style={{ fontSize: size * 0.36, fontWeight: typography.weight.extrabold, color: colors.primary }}>{ini}</Text>
      }
    </View>
  )
}

// ── QR Modal ──────────────────────────────────────────────────────────────────
function QRModal({ visible, link, code, onClose }: { visible: boolean; link: string; code: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <TouchableOpacity style={qr.overlay} activeOpacity={1} onPress={onClose} />
      <View style={qr.sheet}>
        <View style={qr.handle} />
        <Text style={qr.title}>Your Referral QR</Text>
        <Text style={qr.sub}>Anyone who scans this joins with your code</Text>
        {/* QR placeholder */}
        <View style={qr.qrBox}>
          <Feather name="grid" size={100} color={colors.primary} />
          <Text style={qr.qrLink} numberOfLines={2}>{link}</Text>
        </View>
        <View style={qr.codeRow}>
          <Text style={qr.codeLabel}>Code: </Text>
          <Text style={qr.code}>{code}</Text>
        </View>
        <TouchableOpacity style={qr.btn} onPress={onClose} activeOpacity={0.85}>
          <Text style={qr.btnTxt}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const qr = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], paddingHorizontal: spacing[5], paddingBottom: spacing[10], alignItems: 'center' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.full, alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[4] },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  sub: { fontSize: typography.size.sm, color: colors.muted, textAlign: 'center', marginBottom: spacing[5] },
  qrBox: { backgroundColor: colors.background, padding: spacing[6], borderRadius: radius.xl, alignItems: 'center', marginBottom: spacing[4], width: '100%' },
  qrLink: { fontSize: typography.size.xs, color: colors.muted, textAlign: 'center', marginTop: spacing[3] },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[5] },
  codeLabel: { fontSize: typography.size.base, color: colors.muted },
  code: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary, letterSpacing: 3 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: spacing[4], paddingHorizontal: spacing[10] },
  btnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primaryText },
})

// ── Claim toast ───────────────────────────────────────────────────────────────
function useClaimToast() {
  const opacity = useRef(new Animated.Value(0)).current
  const [visible, setVisible] = useState(false)
  const [pts, setPts] = useState(30)

  function show(points: number) {
    setPts(points); setVisible(true)
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setVisible(false))
  }

  const Toast = visible ? (
    <Animated.View style={[ct.toast, { opacity }]}>
      <View style={ct.circle}><Feather name="check" size={16} color="#fff" /></View>
      <Text style={ct.txt}>+{pts} pts earned!</Text>
    </Animated.View>
  ) : null

  return { show, Toast }
}

const ct = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', bottom: '40%', backgroundColor: 'rgba(30,30,30,0.92)', borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[4], flexDirection: 'column', alignItems: 'center', gap: spacing[2], minWidth: 160, zIndex: 999, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  circle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  txt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: '#fff' },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReferralScreen(props: StackScreenProps<RootStackParams, 'Referral'>) {
  const [data, setData]         = useState<ReferralData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [qrOpen, setQrOpen]     = useState(false)
  const [claiming, setClaiming] = useState<number | null>(null)
  const { show: showToast, Toast } = useClaimToast()

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      // Use the new referral API endpoint
      const res = await client.get('/tuka/referral/my')
      const d = res.data?.data || {}

      // Map new API response to existing ReferralData shape
      setData({
        inviteCode:    d.inviteCode    || '',
        referralLink:  d.referralLink  || `https://cardyn.net/ref/${d.inviteCode || ''}`,
        totalInvites:  d.signupCount   || 0,
        pendingCount:  d.pendingRewards || 0,
        tradedCount:   d.rewardsPaidCount || 0,
        referralBonus: 500,
        referredUsers: [], // detailed list not needed on this screen
      })
    } catch { }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCopy() {
    if (!data) return
    await ExpoClipboard.setStringAsync(data.inviteCode)
    Alert.alert('Copied!', `Code ${data.inviteCode} copied`)
  }

  async function handleShare() {
    if (!data) return
    await Share.share({
      message: `Join Cardyn — sell gift cards instantly! Use my code: ${data.inviteCode}\n${data.referralLink}`,
      url: data.referralLink,
    })
  }

  async function handleClaim(user: ReferredUser) {
    setClaiming(user.userId)
    try {
      const res = await client.post(`/tuka/user/referrals/claim/${user.userId}`)
      const pts = res.data?.data?.pointsAwarded || 30
      showToast(pts)
      setData(prev => prev ? {
        ...prev,
        referredUsers: prev.referredUsers.map(u =>
          u.userId === user.userId ? { ...u, claimable: false, claimed: true } : u
        ),
      } : prev)
      setTimeout(() => props.navigation.navigate('Leaderboard', { newPoints: pts }), 2300)
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.msg || 'Could not claim points')
    } finally { setClaiming(null) }
  }

  const renderUser = ({ item }: { item: ReferredUser }) => (
    <View style={s.userRow}>
      <Avatar name={item.name} size={46} avatarUrl={item.avatar} />
      <View style={{ flex: 1, marginLeft: spacing[3] }}>
        <Text style={s.userName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.userSub}>
          {item.status === 'pending' ? 'Waiting for first trade' : `${item.tradeCount} trade${item.tradeCount > 1 ? 's' : ''} completed`}
        </Text>
      </View>
      {item.claimed ? (
        <View style={s.acceptedBadge}><Text style={s.acceptedTxt}>Accepted</Text></View>
      ) : item.claimable ? (
        <TouchableOpacity style={s.claimBtn} onPress={() => handleClaim(item)} disabled={claiming === item.userId} activeOpacity={0.85}>
          {claiming === item.userId
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={s.claimBtnTxt}>Claim</Text>
          }
        </TouchableOpacity>
      ) : (
        <View style={s.inviteBadge}><Text style={s.inviteTxt}>Pending</Text></View>
      )}
    </View>
  )

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', paddingTop: getStatusBarHeight() }}>
        <GenericListSkeleton rows={4} hasAvatar />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, paddingTop: getStatusBarHeight() }}>

        {/* ── Dark hero header ── */}
        <View style={s.heroWrap}>
          {/* Back button */}
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Illustration placeholder */}
          <View style={s.illusWrap}>
            <Text style={{ fontSize: RF(64) }}>🤝</Text>
          </View>

          {/* Title */}
          <Text style={s.heroTitle}>Earn Rewards{'\n'}By Referring</Text>
          <Text style={s.heroSub}>
            Invite friends · Earn <Text style={{ color: colors.primary, fontWeight: typography.weight.extrabold }}>₦{data?.referralBonus || 500}</Text> per referral
          </Text>

          {/* Stats row */}
          {data && (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statNum}>{data.totalInvites}</Text>
                <Text style={s.statLbl}>Invited</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statNum}>{data.tradedCount}</Text>
                <Text style={s.statLbl}>Converted</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statNum}>₦{(data.tradedCount * (data.referralBonus || 500)).toLocaleString()}</Text>
                <Text style={s.statLbl}>Earned</Text>
              </View>
            </View>
          )}

          {/* Code row */}
          <View style={s.codeRow}>
            <View style={s.codeBox}>
              <Text style={s.codeText}>{data?.inviteCode || '——'}</Text>
            </View>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
              <Text style={s.copyBtnTxt}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={s.shareBtnTxt}>SHARE</Text>
            </TouchableOpacity>
          </View>

          {/* QR link */}
          <TouchableOpacity onPress={() => setQrOpen(true)} style={s.qrLink}>
            <Feather name="grid" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={s.qrLinkTxt}>View QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* ── White bottom sheet ── */}
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Your Referrals</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.sheetCount}>{data?.totalInvites || 0} invited</Text>
              {(data?.pendingCount || 0) > 0 && (
                <Text style={{ fontSize: typography.size.xs, color: colors.warning, marginTop: 2 }}>
                  {data?.pendingCount} pending reward{(data?.pendingCount || 0) > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>

          <FlatList
            data={data?.referredUsers || []}
            keyExtractor={item => String(item.userId)}
            renderItem={renderUser}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: RF(36), marginBottom: spacing[3] }}>👥</Text>
                <Text style={s.emptyTitle}>No referrals yet</Text>
                <Text style={s.emptySub}>Share your code and earn ₦500 when friends complete their first trade</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: spacing[8] }}
            showsVerticalScrollIndicator={false}
            refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} />}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 46 + spacing[3] + spacing[5] }} />}
          />
        </View>

      </View>

      {data && (
        <QRModal visible={qrOpen} link={data.referralLink} code={data.inviteCode} onClose={() => setQrOpen(false)} />
      )}

      {Toast}
    </View>
  )
}

const s = StyleSheet.create({
  // Hero
  heroWrap: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  illusWrap: {
    marginBottom: spacing[3],
  },
  heroTitle: {
    fontSize: RF(28), fontWeight: typography.weight.extrabold,
    color: '#fff', textAlign: 'center', lineHeight: 36,
    marginBottom: spacing[2],
  },
  heroSub: {
    fontSize: typography.size.sm, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginBottom: spacing[5],
  },

  // Code row
  codeRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', gap: spacing[2],
    marginBottom: spacing[3],
  },
  codeBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  codeText: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: '#fff', letterSpacing: 2,
  },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  copyBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#fff' },
  shareBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full, paddingHorizontal: spacing[5], paddingVertical: spacing[3],
  },
  shareBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.extrabold, color: '#fff', letterSpacing: 1 },

  qrLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
  },
  qrLinkTxt: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.6)' },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.xl, paddingVertical: spacing[4],
    paddingHorizontal: spacing[5], width: '100%',
    marginBottom: spacing[4],
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: '#fff' },
  statLbl: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  // White sheet
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: spacing[5],
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], marginBottom: spacing[3],
  },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  sheetCount: { fontSize: typography.size.sm, color: colors.muted, fontWeight: typography.weight.medium },

  // User row
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  userName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  userSub: { fontSize: typography.size.xs, color: colors.muted, marginTop: 2 },

  // Badges
  inviteBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  inviteTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  acceptedBadge: { backgroundColor: '#F0F0F0', borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  acceptedTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },
  claimBtn: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2], minWidth: 70, alignItems: 'center' },
  claimBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: spacing[10], paddingHorizontal: spacing[8] },
  emptyTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark, textAlign: 'center' },
  emptySub: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: spacing[2] },
})
