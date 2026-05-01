import { RF } from '../util/responsive'
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import * as Clipboard from 'expo-clipboard'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCoupon, Coupon } from '../api/coupon'

export default function CouponScreen(props: StackScreenProps<RootStackParams, 'Coupon'>) {
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [coupon, setCoupon]     = useState<Coupon | null>(null)
  const [notFound, setNotFound] = useState(false)

  async function handleCheck() {
    if (!code.trim()) {
      Alert.alert('提示', '请输入优惠码')
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const c = await fetchCoupon(code.trim().toUpperCase())
      if (c) {
        setCoupon(c)
        setNotFound(false)
      } else {
        setCoupon(null)
        setNotFound(true)
      }
    } catch {
      setCoupon(null)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  async function copyCoupon() {
    if (!coupon) return
    await Clipboard.setStringAsync(coupon.code)
    Alert.alert('已复制！', `优惠码 ${coupon.code} 已复制到剪贴板`)
  }

  const amount = coupon
    ? (coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `₦${coupon.discountValue.toLocaleString()}`)
    : ''
  const minOrder = coupon && coupon.minOrderAmount > 0
    ? `Available for ₦${coupon.minOrderAmount.toLocaleString()} order`
    : 'No minimum order'

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <AppHeader title="优惠券" onBack={() => props.navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: spacing[5], paddingBottom: 60 }}>
        {/* Input */}
        <Text style={s.label}>输入优惠码</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="例如：WELCOME2026"
            placeholderTextColor={colors.subtle}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity style={s.checkBtn} onPress={handleCheck} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.checkBtnTxt}>查询</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result */}
        {notFound && (
          <View style={s.notFoundCard}>
            <Feather name="alert-circle" size={32} color={colors.error} />
            <Text style={s.notFoundTxt}>优惠码不存在或已过期</Text>
          </View>
        )}

        {coupon && !coupon.expired && (
          <View style={s.couponCard}>
            {/* Left: amount */}
            <View style={s.couponLeft}>
              <Text style={s.couponAmount}>{amount}</Text>
            </View>
            {/* Notched divider */}
            <View style={s.divider} />
            {/* Right: details */}
            <View style={s.couponRight}>
              <Text style={s.couponDetail}>{minOrder}</Text>
              <Text style={s.couponDetail}>Code: {coupon.code}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={copyCoupon} activeOpacity={0.85}>
                <Feather name="copy" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={s.copyBtnTxt}>复制优惠码</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {coupon && coupon.expired && (
          <View style={[s.couponCard, { opacity: 0.5 }]}>
            <View style={s.expiredBanner}>
              <Text style={s.expiredTxt}>已过期</Text>
            </View>
            <View style={s.couponLeft}>
              <Text style={s.couponAmount}>{amount}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.couponRight}>
              <Text style={s.couponDetail}>{minOrder}</Text>
              <Text style={s.couponDetail}>Code: {coupon.code}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  label:       { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  inputRow:    { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[5] },
  input:       {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 52,
    fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold,
  },
  checkBtn:    {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingHorizontal: spacing[5], alignItems: 'center', justifyContent: 'center',
  },
  checkBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  notFoundCard:{
    backgroundColor: colors.errorLight, borderRadius: radius.xl,
    padding: spacing[6], alignItems: 'center', gap: spacing[3],
  },
  notFoundTxt: { fontSize: typography.size.base, color: colors.error, fontWeight: typography.weight.semibold },

  // Coupon ticket card
  couponCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
    overflow: 'visible',
    position: 'relative',
    ...shadow.lg,
  },
  couponLeft: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[6],
    borderRightWidth: 2,
    borderRightColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },
  couponAmount: {
    fontSize: RF(32),
    fontWeight: typography.weight.extrabold,
    color: '#fff',
    textAlign: 'center',
  },
  divider: {
    position: 'absolute',
    left: 120,
    top: 0,
    bottom: 0,
    width: 0,
  },
  couponRight: {
    flex: 1,
    padding: spacing[5],
    paddingLeft: spacing[6],
    justifyContent: 'center',
    gap: spacing[2],
  },
  couponDetail: {
    fontSize: typography.size.base,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: typography.weight.medium,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  copyBtnTxt: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#fff',
  },
  expiredBanner: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: colors.error,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    zIndex: 10,
  },
  expiredTxt: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: '#fff',
  },
})
