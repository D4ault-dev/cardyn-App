import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { BottomSheet } from '../../components/BottomSheet'
import { colors, typography, spacing, radius } from '../../theme'
import { RF } from '../../util/responsive'
import type { Coupon } from '../../api/coupon'

function fmt(n: number, sym = '₦') {
  const v = typeof n === 'number' && !isNaN(n) ? n : 0
  return `${sym}${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

interface Props {
  visible: boolean
  submitting: boolean
  cardName: string
  salesPrice: number
  settlement: number
  currencySymbol: string
  appliedCoupon: Coupon | null
  couponDiscount: number
  onClose: () => void
  onSubmit: () => void
  onOpenCoupon: () => void
}

export function ConfirmSheet({
  visible, submitting, cardName, salesPrice, settlement,
  currencySymbol, appliedCoupon, couponDiscount,
  onClose, onSubmit, onOpenCoupon,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Confirm Trade</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Settlement hero */}
        <View style={s.amtWrap}>
          <Text style={s.amtLabel}>You will receive</Text>
          <Text style={s.amt}>{fmt(settlement, currencySymbol)}</Text>
          {couponDiscount > 0 && (
            <View style={s.couponBadge}>
              <Feather name="tag" size={12} color={colors.success} />
              <Text style={s.couponBadgeTxt}>
                +{fmt(couponDiscount, currencySymbol)} coupon applied
              </Text>
            </View>
          )}
        </View>

        {/* Details grid */}
        <View style={s.rows}>
          {[
            { label: 'Category',         value: cardName || '—' },
            { label: 'Sales Price',       value: fmt(salesPrice, currencySymbol) },
            { label: 'Settlement Amount', value: fmt(settlement, currencySymbol), green: true },
          ].map((item, i, arr) => (
            <View key={item.label} style={[s.row, i < arr.length - 1 && s.rowBorder]}>
              <Text style={s.rowLbl}>{item.label}</Text>
              <Text style={[s.rowVal, item.green && s.rowValGreen]}>{item.value}</Text>
            </View>
          ))}

          {/* Coupon row */}
          <TouchableOpacity style={[s.row, s.couponRow]} onPress={onOpenCoupon} activeOpacity={0.8}>
            <View style={s.couponIcon}>
              <Feather name="tag" size={14} color={colors.accent} />
            </View>
            <Text style={s.couponLbl}>Coupon</Text>
            <Text style={s.couponVal}>
              {appliedCoupon
                ? `+${fmt(couponDiscount, currencySymbol)} applied`
                : 'Select coupon'}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={onSubmit}
          activeOpacity={0.85}>
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.submitTxt}>Submit</Text>
          }
        </TouchableOpacity>

      </View>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark,
  },
  amtWrap: {
    backgroundColor: colors.primaryLight, borderRadius: radius.xl,
    paddingVertical: spacing[4], paddingHorizontal: spacing[5],
    alignItems: 'center', marginBottom: spacing[3],
  },
  amtLabel: {
    fontSize: typography.size.sm, color: colors.primary,
    fontWeight: typography.weight.semibold, marginBottom: spacing[1], letterSpacing: 0.3,
  },
  amt: {
    fontSize: RF(40), fontWeight: typography.weight.extrabold,
    color: colors.primary, letterSpacing: -1.5,
  },
  couponBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.successLight, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1], marginTop: spacing[2],
  },
  couponBadgeTxt: {
    fontSize: typography.size.xs, color: colors.success, fontWeight: typography.weight.semibold,
  },
  rows: {
    backgroundColor: colors.background, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3],
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowLbl: { fontSize: typography.size.base, color: colors.muted },
  rowVal: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.dark, maxWidth: '60%', textAlign: 'right',
  },
  rowValGreen: { color: '#22C55E' },
  couponRow: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingVertical: spacing[4],
  },
  couponIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
    marginRight: spacing[2],
  },
  couponLbl: { fontSize: typography.size.base, color: colors.dark, flex: 1 },
  couponVal: {
    fontSize: typography.size.sm, color: colors.accent,
    fontWeight: typography.weight.semibold, marginRight: spacing[1],
  },
  submitBtn: {
    backgroundColor: '#1A191E', borderRadius: 100,
    paddingVertical: spacing[4] + 2, alignItems: 'center', marginTop: spacing[2],
  },
  submitTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
})
