import { RF } from '../util/responsive'
import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, ActivityIndicator, ScrollView, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { Coupon, fetchAllCoupons, fetchCoupon, claimCoupon } from '../api/coupon'

const { height: H } = Dimensions.get('window')
const GREEN = colors.primary

interface Props {
  visible: boolean
  code?: string | null
  onClose: () => void
  onClaimed?: (coupon: Coupon, amount: number) => void
}

// ── Coupon ticket card ────────────────────────────────────────────────────────
function CouponTicket({ coupon, onClaim, claiming, claimed }: {
  coupon: Coupon
  onClaim: () => void
  claiming: boolean
  claimed: boolean
}) {
  const amount = coupon.discountType === 'percent'
    ? `${coupon.discountValue}%`
    : `₦${coupon.discountValue.toLocaleString()}`

  const minOrder = coupon.minOrderAmount > 0
    ? `Available for ₦${coupon.minOrderAmount.toLocaleString()} order`
    : 'No minimum order'

  return (
    <View style={t.wrap}>
      {/* Ticket */}
      <View style={t.card}>
        <View style={t.left}>
          <Text style={t.amount}>{amount}</Text>
          <Text style={t.off}>OFF</Text>
        </View>
        <View style={t.notchTop} />
        <View style={t.notchBottom} />
        <View style={t.right}>
          <Text style={t.title} numberOfLines={1}>{coupon.title}</Text>
          <Text style={t.detail}>{minOrder}</Text>
          {coupon.description ? (
            <Text style={t.desc} numberOfLines={2}>{coupon.description}</Text>
          ) : null}
          {coupon.expired ? (
            <View style={t.expiredBadge}>
              <Text style={t.expiredTxt}>Expired</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Claim button */}
      {!coupon.expired && (
        <TouchableOpacity
          style={[t.btn, claimed && t.btnClaimed]}
          onPress={onClaim}
          disabled={claiming || claimed}
          activeOpacity={0.85}
        >
          {claiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : claimed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={t.btnTxt}>Reward Claimed!</Text>
            </View>
          ) : (
            <Text style={t.btnTxt}>Claim Reward</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const t = StyleSheet.create({
  wrap: { marginBottom: spacing[5] },
  card: {
    flexDirection: 'row', backgroundColor: GREEN,
    borderRadius: radius.xl, overflow: 'visible', position: 'relative',
    ...shadow.md,
  },
  left: {
    width: 110, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[6],
    borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  notchTop: {
    position: 'absolute', left: 101, top: -10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.background,
  },
  notchBottom: {
    position: 'absolute', left: 101, bottom: -10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.background,
  },
  amount: {
    fontSize: RF(30), fontWeight: typography.weight.extrabold,
    color: '#fff', textAlign: 'center', lineHeight: 34,
  },
  off: {
    fontSize: RF(11), fontWeight: typography.weight.bold,
    color: 'rgba(255,255,255,0.7)', letterSpacing: 1,
  },
  right: {
    flex: 1, paddingVertical: spacing[4],
    paddingLeft: spacing[6], paddingRight: spacing[4],
    justifyContent: 'center', gap: spacing[1] + 2,
  },
  title: {
    fontSize: typography.size.base, fontWeight: typography.weight.extrabold,
    color: '#fff',
  },
  detail: {
    fontSize: typography.size.sm, color: 'rgba(255,255,255,0.85)',
    fontWeight: typography.weight.medium,
  },
  desc: {
    fontSize: typography.size.xs, color: 'rgba(255,255,255,0.65)',
    lineHeight: 16,
  },
  expiredBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 2,
    marginTop: spacing[1],
  },
  expiredTxt: { fontSize: RF(10), color: 'rgba(255,255,255,0.6)', fontWeight: typography.weight.semibold },
  btn: {
    backgroundColor: GREEN, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center', justifyContent: 'center',
    marginTop: spacing[3],
    borderWidth: 2, borderColor: GREEN,
  },
  btnClaimed: { backgroundColor: colors.success, borderColor: colors.success },
  btnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
})

// ── Main modal ────────────────────────────────────────────────────────────────
export function CouponClaimModal({ visible, code, onClose, onClaimed }: Props) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(H)).current
  const [coupons,    setCoupons]    = useState<Coupon[]>([])
  const [loading,    setLoading]    = useState(false)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSuccessMsg(null)
      setError(null)
      setClaimedIds(new Set())
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
      setLoading(true)
      const fetch = code ? fetchCoupon(code).then(c => c ? [c] : []) : fetchAllCoupons()
      fetch.then(setCoupons).catch(() => setCoupons([])).finally(() => setLoading(false))
    } else {
      slideAnim.setValue(H)
    }
  }, [visible, code])

  function close() {
    Animated.timing(slideAnim, { toValue: H, duration: 220, useNativeDriver: true }).start(onClose)
  }

  async function handleClaim(coupon: Coupon) {
    if (claimingId || coupon.expired) return
    setClaimingId(coupon.id)
    setError(null)
    setSuccessMsg(null)
    try {
      const result = await claimCoupon(coupon.code)
      setClaimedIds(prev => new Set([...prev, coupon.id]))
      setSuccessMsg(`🎉 ₦${result.creditAmount.toLocaleString()} has been added to your wallet!`)
      onClaimed?.(coupon, result.creditAmount)
    } catch (e: any) {
      setError(e.message || 'Failed to claim coupon')
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>🎟  Coupon</Text>
          <TouchableOpacity onPress={close} style={s.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={20} color={colors.dark} />
          </TouchableOpacity>
        </View>

        {/* Banners */}
        {successMsg ? (
          <View style={s.successBanner}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={s.successTxt}>{successMsg}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={16} color={colors.error} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* Content */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={s.loadingTxt}>Loading coupon...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[8] }}
            showsVerticalScrollIndicator={false}
          >
            {coupons.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize: RF(40) }}>🎟</Text>
                <Text style={s.emptyTitle}>No coupon available</Text>
                <Text style={s.emptyDesc}>This coupon may have expired or been removed</Text>
              </View>
            ) : (
              coupons.map(c => (
                <CouponTicket
                  key={c.id}
                  coupon={c}
                  onClaim={() => handleClaim(c)}
                  claiming={claimingId === c.id}
                  claimed={claimedIds.has(c.id)}
                />
              ))
            )}
          </ScrollView>
        )}

      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    maxHeight: H * 0.78,
    ...shadow.lg,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title:    { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.successLight,
    marginHorizontal: spacing[5], marginTop: spacing[4],
    borderRadius: radius.lg, padding: spacing[3],
  },
  successTxt: { fontSize: typography.size.sm, color: colors.success, fontWeight: typography.weight.semibold, flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.errorLight,
    marginHorizontal: spacing[5], marginTop: spacing[4],
    borderRadius: radius.lg, padding: spacing[3],
  },
  errorTxt: { fontSize: typography.size.sm, color: colors.error, flex: 1 },
  loadingWrap: { padding: spacing[10], alignItems: 'center', gap: spacing[3] },
  loadingTxt:  { fontSize: typography.size.base, color: colors.muted },
  emptyWrap:   { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  emptyTitle:  { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  emptyDesc:   { fontSize: typography.size.sm, color: colors.muted, textAlign: 'center' },
})
