import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { useFocusEffect } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../theme'
import { fetchAllCoupons, Coupon } from '../api/coupon'
import { AppHeader } from '../components/AppHeader'

// ── Usage rules text ─────────────────────────────────────────────────────────
const USAGE_RULES =
  'Coupons cannot be used in combination. Only one coupon can be used at a time. ' +
  'Coupons will become invalid if they are not used before the expiration date.'

// ── Single coupon card ────────────────────────────────────────────────────────
function CouponCard({ coupon, onUse }: { coupon: Coupon; onUse: () => void }) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const sym = '₦'

  const amountLabel =
    coupon.discountType === 'percent'
      ? `${coupon.discountValue}%`
      : `${sym}${coupon.discountValue.toLocaleString()}`

  const conditionText =
    coupon.minOrderAmount > 0
      ? `The face value of the card in a single transaction exceeds ${coupon.minOrderAmount.toLocaleString()}`
      : 'The face value of the card in a single transaction exceeds 0'

  return (
    <View style={[s.card, coupon.expired && s.cardExpired]}>
      {/* Top section */}
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <Text style={s.cardAmount}>
            <Text style={s.cardAmountGreen}>{amountLabel}</Text>
            {' '}
            <Text style={s.cardAmountLabel}>Coupon</Text>
          </Text>
          <Text style={s.cardCondition}>{conditionText}</Text>
        </View>

        <TouchableOpacity
          style={[s.useBtn, coupon.expired && s.useBtnDisabled]}
          activeOpacity={0.8}
          onPress={coupon.expired ? undefined : onUse}
          disabled={coupon.expired}
        >
          <Text style={s.useBtnTxt}>
            {coupon.expired ? 'Expired' : 'Use at once'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Bottom section */}
      <View style={s.cardBottom}>
        <View style={s.validRow}>
          <Feather name="clock" size={13} color={colors.muted} />
          <Text style={s.validTxt}>
            {coupon.endDate ? `Valid until ${coupon.endDate}` : 'No expiry'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.rulesBtn}
          onPress={() => setRulesOpen(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.rulesBtnTxt}>Usage Rules</Text>
          <Feather
            name={rulesOpen ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={colors.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Expanded rules */}
      {rulesOpen && (
        <Text style={s.rulesText}>{USAGE_RULES}</Text>
      )}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CouponScreen({ navigation }: any) {
  const [coupons, setCoupons]     = useState<Coupon[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await fetchAllCoupons()
      setCoupons(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const active  = coupons.filter(c => !c.expired)
  const expired = coupons.filter(c => c.expired)

  return (
    <View style={[s.root, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Coupon" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
        >
          {active.length === 0 && expired.length === 0 ? (
            <View style={s.empty}>
              <Feather name="tag" size={48} color={colors.muted} />
              <Text style={s.emptyTxt}>No coupons yet</Text>
              <Text style={s.emptySubTxt}>Claim coupons from articles or promotions</Text>
            </View>
          ) : (
            <>
              {active.map(c => (
                <CouponCard
                  key={c.id}
                  coupon={c}
                  onUse={() => navigation.navigate('SellCard', { couponId: c.id })}
                />
              ))}
              {expired.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>Expired</Text>
                  {expired.map(c => (
                    <CouponCard key={c.id} coupon={c} onUse={() => {}} />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:   { padding: spacing[4], gap: spacing[3] },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardExpired: { opacity: 0.55 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    paddingBottom: spacing[3],
  },
  cardLeft:        { flex: 1, marginRight: spacing[3] },
  cardAmount:      { fontSize: typography.size.xl as any, fontWeight: typography.weight.bold, marginBottom: spacing[1] },
  cardAmountGreen: { color: '#22C55E', fontSize: 22 as any, fontWeight: '800' as any },
  cardAmountLabel: { color: colors.dark, fontSize: 22 as any, fontWeight: '800' as any },
  cardCondition:   { fontSize: typography.size.sm as any, color: colors.muted, lineHeight: 20 },

  useBtn: {
    backgroundColor: '#1A191E',
    borderRadius: 100,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    minWidth: 110,
    alignItems: 'center',
  },
  useBtnDisabled: { backgroundColor: '#ccc' },
  useBtnTxt:      { color: '#fff', fontSize: typography.size.sm as any, fontWeight: typography.weight.semibold },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: spacing[4] },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  validRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  validTxt:    { fontSize: typography.size.xs as any, color: colors.muted },
  rulesBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rulesBtnTxt: { fontSize: typography.size.xs as any, color: colors.muted },
  rulesText: {
    fontSize: typography.size.xs as any,
    color: colors.muted,
    lineHeight: 18,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },

  sectionLabel: {
    fontSize: typography.size.sm as any,
    color: colors.muted,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },

  empty:       { alignItems: 'center', paddingTop: spacing[16], gap: spacing[3] },
  emptyTxt:    { fontSize: typography.size.lg as any, fontWeight: typography.weight.bold, color: colors.dark },
  emptySubTxt: { fontSize: typography.size.sm as any, color: colors.muted, textAlign: 'center' },
})
