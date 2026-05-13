/**
 * Skeleton — animated shimmer placeholder for loading states.
 *
 * Uses a horizontal sweep shimmer (like Facebook/LinkedIn) — more professional
 * than a simple opacity pulse. The shimmer moves left→right continuously.
 *
 * Usage:
 *   <Skeleton width={200} height={16} />
 *   <Skeleton width="100%" height={16} radius={8} />
 *   <Skeleton circle size={44} />
 *
 * Pre-built screen skeletons (content-shaped, match actual layout):
 *   <HomeBalanceSkeleton />      — balance card on HomeScreen
 *   <WalletBalanceSkeleton />    — balance card on WalletScreen
 *   <NotificationSkeleton />     — notification cards (matches AlertsScreen)
 *   <CardListSkeleton />         — card rate list
 *   <OrderListSkeleton />        — order list rows
 *   <ProfileSkeleton />          — account settings
 *   <LeaderboardSkeleton />          — leaderboard
 *   <GenericListSkeleton />          — generic list rows
 *   <SellCardSkeleton />             — sell card form
 *   <ReferralSkeleton />             — referral screen (dark hero + white sheet)
 *   <CouponSkeleton />               — coupon cards
 *   <DiscoverySkeleton />            — discovery article cards
 *   <WithdrawalHistorySkeleton />    — withdrawal history rows
 *   <WalletTransactionSkeleton />    — wallet transaction rows
 */

import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ViewStyle, DimensionValue } from 'react-native'
import { colors, spacing, radius } from '../theme'
import { ms } from '../util/responsive'

// ── Shimmer color constants ───────────────────────────────────────────────────
const BASE  = '#E8ECF0'
const SHINE = '#F4F6F8'

// ── Base shimmer block ────────────────────────────────────────────────────────
interface SkeletonProps {
  width?:   DimensionValue
  height?:  number
  radius?:  number
  circle?:  boolean
  size?:    number
  style?:   ViewStyle
}

export function Skeleton({ width = '100%', height = 16, radius: r = 8, circle, size, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    )
    anim.start()
    return () => anim.stop()
  }, [])

  // Translate shimmer across the block
  const translateX = shimmer.interpolate({
    inputRange:  [0, 1],
    outputRange: [-300, 300],
  })

  const w  = circle && size ? size : width
  const h  = circle && size ? size : height
  const br = circle && size ? size / 2 : r

  return (
    <View style={[{ width: w, height: h, borderRadius: br, backgroundColor: BASE, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: SHINE,
          opacity: 0.6,
          transform: [{ translateX }, { skewX: '-20deg' }],
          width: '40%',
        }}
      />
    </View>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────
function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>
}

// ── HomeScreen balance skeleton ───────────────────────────────────────────────
// Matches the balance row in HomeScreen exactly
export function HomeBalanceSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[4] }}>
      <Skeleton width={80} height={11} radius={5} style={{ marginBottom: spacing[2] }} />
      <Skeleton width={180} height={38} radius={10} />
    </View>
  )
}

// ── WithdrawScreen balance skeleton ──────────────────────────────────────────
// Matches the white balance card in WithdrawScreen exactly
export function WithdrawBalanceSkeleton() {
  return (
    <View style={{
      marginHorizontal: spacing[4], marginTop: spacing[3], marginBottom: spacing[5],
      borderRadius: radius.xl, padding: spacing[5],
      backgroundColor: colors.surface,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }}>
      {/* Top row: label + history button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] }}>
        <Skeleton width={90} height={11} radius={5} />
        <Skeleton width={70} height={26} radius={radius.full} />
      </View>
      {/* Balance amount */}
      <Skeleton width={200} height={40} radius={10} />
    </View>
  )
}

// ── WalletScreen balance skeleton ─────────────────────────────────────────────
// Matches the gradient balance card in WalletScreen
export function WalletBalanceSkeleton() {
  return (
    <View style={[sk.card, { backgroundColor: '#1A3040', padding: spacing[5], marginBottom: spacing[4] }]}>
      <Skeleton width={120} height={11} radius={5} style={{ marginBottom: spacing[3], backgroundColor: 'rgba(255,255,255,0.15)' }} />
      <Skeleton width={200} height={40} radius={10} style={{ marginBottom: spacing[4], backgroundColor: 'rgba(255,255,255,0.2)' }} />
      <Row style={{ gap: spacing[8] }}>
        <View style={{ gap: spacing[1] }}>
          <Skeleton width={70} height={10} radius={4} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          <Skeleton width={90} height={14} radius={5} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>
        <View style={{ gap: spacing[1] }}>
          <Skeleton width={70} height={10} radius={4} style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          <Skeleton width={90} height={14} radius={5} style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>
      </Row>
    </View>
  )
}

// ── Notification skeleton — matches AlertsScreen NotifCard exactly ────────────
export function NotificationSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ padding: spacing[4], gap: spacing[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[sk.card, { padding: spacing[4], opacity: 1 - i * 0.15 }]}>
          {/* Top row: icon + title + trash */}
          <Row style={{ gap: spacing[3], marginBottom: spacing[3] }}>
            <Skeleton circle size={ms(34)} />
            <Skeleton width="60%" height={14} radius={6} style={{ flex: 1 }} />
            <Skeleton circle size={18} />
          </Row>
          {/* Body lines */}
          <Skeleton width="90%" height={11} radius={5} style={{ marginBottom: spacing[2], marginLeft: ms(34) + spacing[3] }} />
          <Skeleton width="70%" height={11} radius={5} style={{ marginBottom: spacing[3], marginLeft: ms(34) + spacing[3] }} />
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing[3] }} />
          {/* Bottom row: time + view details */}
          <Row style={{ justifyContent: 'space-between' }}>
            <Skeleton width={80} height={10} radius={4} />
            <Skeleton width={90} height={10} radius={4} />
          </Row>
        </View>
      ))}
    </View>
  )
}

// ── Card list skeleton ────────────────────────────────────────────────────────
export function CardListSkeleton() {
  return (
    <View style={sk.container}>
      <Row style={{ marginHorizontal: spacing[4], marginBottom: spacing[3], gap: spacing[3] }}>
        <Skeleton width="70%" height={52} radius={radius.xl} />
        <Skeleton width="28%" height={52} radius={radius.xl} />
      </Row>
      <View style={{ paddingHorizontal: spacing[4] }}>
        <Row style={{ marginBottom: spacing[3], gap: spacing[2] }}>
          {[80, 60, 80].map((w, i) => <Skeleton key={i} width={w} height={32} radius={radius.full} />)}
        </Row>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[sk.card, { marginBottom: spacing[3], padding: spacing[4] }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ gap: spacing[2] }}>
                <Skeleton width={80} height={14} radius={6} />
                <Skeleton width={50} height={11} radius={5} />
              </View>
              <Skeleton width={60} height={14} radius={6} />
              <Skeleton width={80} height={14} radius={6} />
            </Row>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Order list skeleton ───────────────────────────────────────────────────────
export function OrderListSkeleton() {
  return (
    <View style={sk.container}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[sk.card, { marginBottom: spacing[3], padding: spacing[4] }]}>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing[3] }}>
            <Skeleton width={120} height={14} radius={6} />
            <Skeleton width={60} height={22} radius={radius.full} />
          </Row>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing[2] }}>
            <Skeleton width={80} height={11} radius={5} />
            <Skeleton width={80} height={14} radius={6} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Skeleton width={100} height={11} radius={5} />
            <Skeleton width={60} height={11} radius={5} />
          </Row>
        </View>
      ))}
    </View>
  )
}

// ── Profile skeleton ──────────────────────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <View style={sk.container}>
      <View style={[sk.card, { padding: spacing[5], alignItems: 'center', gap: spacing[3] }]}>
        <Skeleton circle size={80} />
        <Skeleton width={140} height={18} radius={8} />
        <Skeleton width={100} height={12} radius={6} />
      </View>
      <View style={[sk.card, { marginTop: spacing[4] }]}>
        {[1, 2, 3, 4].map(i => (
          <View key={i}>
            {i > 1 && <View style={sk.divider} />}
            <Row style={sk.infoRow}>
              <Skeleton width={100} height={14} radius={6} style={{ flex: 1 }} />
              <Skeleton width={80} height={12} radius={5} />
              <Skeleton width={16} height={16} radius={8} style={{ marginLeft: spacing[2] }} />
            </Row>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Leaderboard skeleton ──────────────────────────────────────────────────────
export function LeaderboardSkeleton() {
  return (
    <View style={sk.container}>
      <Row style={{ justifyContent: 'center', gap: spacing[4], marginBottom: spacing[6], paddingTop: spacing[4] }}>
        {[60, 80, 60].map((h, i) => (
          <View key={i} style={{ alignItems: 'center', gap: spacing[2] }}>
            <Skeleton circle size={i === 1 ? 64 : 52} />
            <Skeleton width={60} height={h} radius={8} />
            <Skeleton width={50} height={11} radius={5} />
          </View>
        ))}
      </Row>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <View key={i}>
          {i > 1 && <View style={sk.divider} />}
          <Row style={sk.cardRow}>
            <Skeleton width={24} height={14} radius={5} style={{ marginRight: spacing[3] }} />
            <Skeleton circle size={40} style={{ marginRight: spacing[3] }} />
            <View style={{ flex: 1, gap: spacing[2] }}>
              <Skeleton width="50%" height={14} radius={6} />
              <Skeleton width="30%" height={11} radius={5} />
            </View>
            <Skeleton width={60} height={14} radius={6} />
          </Row>
        </View>
      ))}
    </View>
  )
}

// ── Generic list skeleton ─────────────────────────────────────────────────────
export function GenericListSkeleton({ rows = 5, hasAvatar = false }: { rows?: number; hasAvatar?: boolean }) {
  return (
    <View style={sk.container}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[sk.card, { marginBottom: spacing[3], padding: spacing[4] }]}>
          <Row style={{ gap: spacing[3] }}>
            {hasAvatar && <Skeleton circle size={44} />}
            <View style={{ flex: 1, gap: spacing[2] }}>
              <Skeleton width="70%" height={14} radius={6} />
              <Skeleton width="45%" height={11} radius={5} />
            </View>
            <Skeleton width={50} height={12} radius={5} />
          </Row>
        </View>
      ))}
    </View>
  )
}

// ── Referral screen skeleton ──────────────────────────────────────────────────
// Matches ReferralScreen: dark #1A1A2E hero + white bottom sheet with user rows
export function ReferralSkeleton() {
  const DB = 'rgba(255,255,255,0.1)'
  const DS = 'rgba(255,255,255,0.18)'
  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
      {/* Hero area */}
      <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[6], alignItems: 'center' }}>
        {/* Back button */}
        <Skeleton width={38} height={38} radius={19} style={{ alignSelf: 'flex-start', marginBottom: spacing[3], backgroundColor: DB }} />
        {/* Illustration placeholder */}
        <Skeleton circle size={72} style={{ marginBottom: spacing[3], backgroundColor: DB }} />
        {/* Title lines */}
        <Skeleton width={200} height={22} radius={8} style={{ marginBottom: spacing[2], backgroundColor: DS }} />
        <Skeleton width={160} height={14} radius={6} style={{ marginBottom: spacing[5], backgroundColor: DB }} />
        {/* Stats row */}
        <Skeleton width="100%" height={72} radius={radius.xl} style={{ marginBottom: spacing[4], backgroundColor: DB }} />
        {/* Code row */}
        <View style={{ flexDirection: 'row', width: '100%', gap: spacing[2], marginBottom: spacing[3] }}>
          <Skeleton height={44} radius={radius.full} style={{ flex: 1, backgroundColor: DB }} />
          <Skeleton width={60} height={44} radius={radius.full} style={{ backgroundColor: DB }} />
          <Skeleton width={80} height={44} radius={radius.full} style={{ backgroundColor: DS }} />
        </View>
      </View>

      {/* White bottom sheet */}
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: spacing[5] }}>
        {/* Sheet header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
          <Skeleton width={120} height={18} radius={7} />
          <Skeleton width={70} height={14} radius={5} />
        </View>
        {/* User rows */}
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[4] }}>
            <Skeleton circle size={46} style={{ marginRight: spacing[3] }} />
            <View style={{ flex: 1, gap: spacing[2] }}>
              <Skeleton width="55%" height={14} radius={6} />
              <Skeleton width="40%" height={11} radius={5} />
            </View>
            <Skeleton width={64} height={28} radius={radius.full} />
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Coupon screen skeleton ────────────────────────────────────────────────────
// Matches CouponScreen: white cards with amount+condition on left, button on right,
// divider, then date + usage rules row at bottom
export function CouponSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5', paddingTop: spacing[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{
          backgroundColor: '#fff', borderRadius: radius.xl, marginHorizontal: spacing[4],
          marginBottom: spacing[3], overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
        }}>
          {/* Top: amount + button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[3] }}>
            <View style={{ flex: 1, marginRight: spacing[3], gap: spacing[2] }}>
              <Skeleton width={120} height={22} radius={7} />
              <Skeleton width="85%" height={12} radius={5} />
              <Skeleton width="65%" height={12} radius={5} />
            </View>
            <Skeleton width={110} height={40} radius={radius.full} />
          </View>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F0F0F0', marginHorizontal: spacing[4] }} />
          {/* Bottom: date + rules */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
            <Skeleton width={120} height={11} radius={5} />
            <Skeleton width={80} height={11} radius={5} />
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Discovery screen skeleton ─────────────────────────────────────────────────
// Matches DiscoveryScreen ArticleCard: horizontal card with 90×90 thumb + title + meta row
export function DiscoverySkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{
          flexDirection: 'row', backgroundColor: colors.surface,
          marginHorizontal: spacing[4], marginBottom: spacing[3],
          borderRadius: radius.xl, padding: spacing[3], gap: spacing[3],
        }}>
          {/* Thumbnail */}
          <Skeleton width={90} height={90} radius={radius.lg} />
          {/* Body */}
          <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: spacing[1] }}>
            <View style={{ gap: spacing[2] }}>
              <Skeleton width="90%" height={14} radius={6} />
              <Skeleton width="75%" height={14} radius={6} />
              <Skeleton width="55%" height={14} radius={6} />
            </View>
            {/* Meta row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] }}>
              <Skeleton width={14} height={14} radius={7} />
              <Skeleton width={70} height={11} radius={5} />
              <View style={{ flex: 1 }} />
              <Skeleton width={40} height={11} radius={5} />
              <Skeleton width={14} height={14} radius={7} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Withdrawal history skeleton ───────────────────────────────────────────────
// Matches WithdrawalHistoryScreen card: ID row, amount row, bank row, date+status row
export function WithdrawalHistorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing[4], gap: spacing[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{
          backgroundColor: '#fff', borderRadius: radius.xl, padding: spacing[4],
          borderWidth: 1, borderColor: colors.border,
        }}>
          {/* Top: ID + copy button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] }}>
            <Skeleton width="60%" height={14} radius={6} />
            <Skeleton width={30} height={30} radius={8} />
          </View>
          {/* Amount row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] }}>
            <Skeleton circle size={10} />
            <Skeleton width={50} height={13} radius={5} />
            <Skeleton width={100} height={13} radius={5} />
          </View>
          {/* Bank row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] }}>
            <Skeleton width={14} height={14} radius={7} />
            <Skeleton width="65%" height={12} radius={5} />
          </View>
          {/* Bottom: date + status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: '#F5F5F5', marginTop: spacing[1] }}>
            <Skeleton width={140} height={12} radius={5} />
            <Skeleton width={60} height={12} radius={5} />
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Wallet transaction list skeleton ─────────────────────────────────────────
// Matches WalletScreen txRow: icon circle + title/orderNo/date + amount
export function WalletTransactionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          {i > 0 && <View style={{ height: 1, backgroundColor: colors.background }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], gap: spacing[3] }}>
            {/* Icon */}
            <Skeleton width={44} height={44} radius={radius.md} />
            {/* Info */}
            <View style={{ flex: 1, gap: spacing[2] }}>
              <Skeleton width="55%" height={14} radius={6} />
              <Skeleton width="40%" height={11} radius={5} />
              <Skeleton width="30%" height={10} radius={4} />
            </View>
            {/* Amount */}
            <Skeleton width={80} height={14} radius={6} />
          </View>
        </View>
      ))}
    </View>
  )
}

// ── Withdraw screen full skeleton ─────────────────────────────────────────────
// Matches WithdrawScreen: balance card + section label + 2 bank cards + add row + withdraw btn
export function WithdrawScreenSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Balance card */}
      <View style={{
        marginHorizontal: spacing[4], marginTop: spacing[3], marginBottom: spacing[5],
        borderRadius: radius.xl, padding: spacing[5],
        backgroundColor: colors.surface,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 }, elevation: 1,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] }}>
          <Skeleton width={90} height={11} radius={5} />
          <Skeleton width={70} height={26} radius={radius.full} />
        </View>
        <Skeleton width={200} height={40} radius={10} />
      </View>

      {/* Section label */}
      <Skeleton width={100} height={12} radius={5} style={{ marginHorizontal: spacing[5], marginBottom: spacing[3] }} />

      {/* Bank card 1 */}
      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[4] }}>
        <Skeleton width="100%" height={110} radius={18} />
      </View>

      {/* Bank card 2 */}
      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[4] }}>
        <Skeleton width="100%" height={110} radius={18} />
      </View>

      {/* Add bank row */}
      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[2] }}>
        <Skeleton width="100%" height={64} radius={radius.xl} />
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Withdraw button */}
      <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[8] }}>
        <Skeleton width="100%" height={ms(52)} radius={radius.full} />
      </View>
    </View>
  )
}

// ── Sell card skeleton ────────────────────────────────────────────────────────
export function SellCardSkeleton() {
  return (
    <View style={sk.container}>
      <View style={[sk.card, { padding: spacing[4], marginBottom: spacing[3] }]}>
        <Row style={{ gap: spacing[3] }}>
          <Skeleton circle size={48} />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Skeleton width="60%" height={16} radius={6} />
            <Skeleton width="40%" height={12} radius={5} />
          </View>
          <Skeleton width={20} height={20} radius={10} />
        </Row>
      </View>
      <Row style={{ gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[4] }}>
        {[60, 50, 70, 55].map((w, i) => <Skeleton key={i} width={w} height={34} radius={radius.full} />)}
      </Row>
      <View style={[sk.card, { padding: spacing[4], marginBottom: spacing[3] }]}>
        <Skeleton width="100%" height={56} radius={radius.lg} />
      </View>
      <View style={[sk.card, { padding: spacing[4] }]}>
        {[1, 2, 3].map(i => (
          <Row key={i} style={{ justifyContent: 'space-between', marginBottom: i < 3 ? spacing[3] : 0 }}>
            <Skeleton width={80} height={12} radius={5} />
            <Skeleton width={100} height={14} radius={6} />
          </Row>
        ))}
      </View>
    </View>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  container: { flex: 1, paddingTop: spacing[4] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[5],
    overflow: 'hidden',
  },
  divider:  { height: 1, backgroundColor: colors.background, marginHorizontal: spacing[5] },
  cardRow:  { paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2, alignItems: 'center' },
  infoRow:  { paddingHorizontal: spacing[5], paddingVertical: spacing[4] + 2, alignItems: 'center' },
})
