/**
 * CouponPicker — standalone Modal sheet.
 * Rendered as a separate Modal above the confirm trade modal.
 */
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../theme'
import { fetchAllCoupons, Coupon } from '../api/coupon'

const { height: H } = Dimensions.get('window')
const USAGE_RULES =
  'Coupons cannot be used in combination. Only one coupon can be used at a time. ' +
  'Coupons will become invalid if they are not used before the expiration date.'

interface Props {
  visible: boolean
  salesPrice: number
  selectedCoupon: Coupon | null
  onConfirm: (coupon: Coupon | null) => void
  onClose: () => void
  currencySymbol?: string
  country?: string   // filter coupons by country
}

function CouponRow({
  coupon, selected, onSelect, salesPrice, currencySymbol = '₦',
}: {
  coupon: Coupon; selected: boolean; onSelect: () => void; salesPrice: number; currencySymbol?: string
}) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const eligible = salesPrice >= coupon.minOrderAmount

  const amountLabel = coupon.discountType === 'percent'
    ? `${coupon.discountValue}%`
    : `${currencySymbol}${coupon.discountValue.toLocaleString()}`

  const conditionText = coupon.minOrderAmount > 0
    ? `Min order: ${currencySymbol}${coupon.minOrderAmount.toLocaleString()}`
    : 'No minimum order'

  return (
    <TouchableOpacity
      style={[s.row, !eligible && s.rowDisabled]}
      onPress={eligible ? onSelect : undefined}
      activeOpacity={eligible ? 0.8 : 1}
    >
      <View style={s.rowTop}>
        <View style={s.rowLeft}>
          <Text style={s.rowAmount}>
            <Text style={s.rowAmountGreen}>{amountLabel}</Text>
            {' '}<Text style={s.rowAmountLabel}>Coupon</Text>
          </Text>
          <Text style={s.rowCondition}>{conditionText}</Text>
        </View>
        <View style={[s.radio, selected && s.radioSelected]}>
          {selected && <View style={s.radioDot} />}
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.rowBottom}>
        <View style={s.validRow}>
          <Feather name="clock" size={12} color={colors.muted} />
          <Text style={s.validTxt}>
            {coupon.endDate ? `Valid until ${coupon.endDate}` : 'No expiry'}
          </Text>
        </View>
        <TouchableOpacity style={s.rulesBtn} onPress={() => setRulesOpen(v => !v)} activeOpacity={0.7}>
          <Text style={s.rulesBtnTxt}>Usage Rules</Text>
          <Feather name={rulesOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {rulesOpen && <Text style={s.rulesText}>{USAGE_RULES}</Text>}
    </TouchableOpacity>
  )
}

export default function CouponPicker({
  visible, salesPrice, selectedCoupon, onConfirm, onClose, currencySymbol = '₦', country,
}: Props) {
  const slideAnim = useRef(new Animated.Value(H)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked]   = useState<Coupon | null>(selectedCoupon)

  useEffect(() => {
    if (visible) {
      setPicked(selectedCoupon)
      slideAnim.setValue(H)
      fadeAnim.setValue(0)
      setLoading(true)
      fetchAllCoupons(country)
        .then(data => setCoupons(data.filter(c => !c.expired)))
        .finally(() => setLoading(false))
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  function handleConfirm() {
    onConfirm(picked)
    onClose()
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Dim overlay */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet slides up */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        {/* Header row */}
        <View style={s.headerRow}>
          <Text style={s.title}>Select Coupon</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={s.closeBtn}>
              <Feather name="x" size={16} color={colors.dark} />
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : coupons.length === 0 ? (
          <View style={s.center}>
            <Feather name="tag" size={36} color={colors.muted} />
            <Text style={s.emptyTxt}>No available coupons</Text>
          </View>
        ) : (
          <ScrollView
            style={s.scroll}
            contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[4] }}
            showsVerticalScrollIndicator={false}
          >
            {coupons.map(c => (
              <CouponRow
                key={c.id}
                coupon={c}
                selected={picked?.id === c.id}
                onSelect={() => setPicked(prev => prev?.id === c.id ? null : c)}
                salesPrice={salesPrice}
                currencySymbol={currencySymbol}
              />
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Text style={s.confirmTxt}>Confirm</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    height: H * 0.88,
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.xl as any,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing[4] },
  center: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[3] },
  emptyTxt: { fontSize: typography.size.base as any, color: colors.muted },

  row: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  rowDisabled: { opacity: 0.45 },
  rowTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4], paddingBottom: spacing[3],
  },
  rowLeft:        { flex: 1, marginRight: spacing[3] },
  rowAmount:      { fontSize: 20 as any, fontWeight: '800' as any, marginBottom: spacing[1] },
  rowAmountGreen: { color: '#22C55E' },
  rowAmountLabel: { color: colors.dark },
  rowCondition:   { fontSize: typography.size.sm as any, color: colors.muted, lineHeight: 20 },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#D0D0D0',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary,
  },

  divider: { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: spacing[4] },
  rowBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  validRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  validTxt:    { fontSize: typography.size.xs as any, color: colors.muted },
  rulesBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rulesBtnTxt: { fontSize: typography.size.xs as any, color: colors.muted },
  rulesText: {
    fontSize: typography.size.xs as any, color: colors.muted,
    lineHeight: 18, paddingHorizontal: spacing[4], paddingBottom: spacing[3],
  },

  confirmBtn: {
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    backgroundColor: '#1A191E',
    borderRadius: 100,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  confirmTxt: {
    color: '#fff',
    fontSize: typography.size.base as any,
    fontWeight: typography.weight.bold,
  },
})
