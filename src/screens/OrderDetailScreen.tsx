import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Modal, Dimensions, Animated,
} from 'react-native'
import * as ExpoClipboard from 'expo-clipboard'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'

const { width: W } = Dimensions.get('window')

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = ['Pending', 'Processing', 'Success']

function getStepIndex(status: string): number {
  const s = status?.toLowerCase()
  if (s === 'paid' || s === 'completed') return 2
  if (s === 'processing') return 1
  if (s === 'rejected') return 1  // failed shows at step 1 (Processing/Failed)
  return 0
}
function isFailed(status: string) { return status?.toLowerCase() === 'rejected' }

function stepLabel(step: string, failed: boolean, i: number) {
  if (failed && i === 1) return 'Failed'
  return step
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    pending: colors.warning, processing: colors.info,
    paid: colors.success, completed: colors.success, rejected: colors.error,
  }
  return map[s?.toLowerCase()] || colors.muted
}

function formatDateTime(str: string) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function currSymbol(code: string) {
  const map: Record<string, string> = { AUD: 'A$', GBP: '£', EUR: '€', CAD: 'C$', USD: '$' }
  return map[code] || '$'
}

export default function OrderDetailScreen(props: StackScreenProps<RootStackParams, 'OrderDetail'>) {
  const insets = useSafeAreaInsets()
  const o = JSON.parse(props.route.params.order)

  const [imgViewerOpen, setImgViewerOpen] = useState(false)
  const [imgViewerIdx, setImgViewerIdx]   = useState(0)
  const [imgViewerUrls, setImgViewerUrls] = useState<string[]>([])
  const [copied, setCopied]               = useState(false)
  const stepIdx = getStepIndex(o.status)
  const failed  = isFailed(o.status)
  const imgUrl  = resolveImageUrl(o.categoryIcon ?? null)
  const cardImgUrls = o.cardImage
    ? o.cardImage.split(',').map((u: string) => resolveImageUrl(u.trim())).filter(Boolean) as string[]
    : []
  const verifyImgUrl = o.verifyImage ? resolveImageUrl(o.verifyImage) : null
  const sym = currSymbol(o.cardCurrency)
  const typeLabel = [
    o.inputType && o.inputType !== 'All' ? o.inputType : null,
    o.speed ? o.speed.charAt(0).toUpperCase() + o.speed.slice(1) : null,
  ].filter(Boolean).join(' ')

  // Pulse animation for current in-progress step
  const pulseAnim = useRef(new Animated.Value(1)).current
  const ringAnim  = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const inProgress = !failed && stepIdx < 2
    if (!inProgress) return
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]))
    const ring = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]))
    pulse.start(); ring.start()
    return () => { pulse.stop(); ring.stop() }
  }, [o.status])

  function copyId() {
    ExpoClipboard.setStringAsync(o.orderNo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openViewer(urls: string[], idx = 0) {
    setImgViewerUrls(urls)
    setImgViewerIdx(idx)
    setImgViewerOpen(true)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      <AppHeader title="Order tracking" onBack={() => props.navigation.goBack()} />

      {/* ── Timeline ── */}
      <View style={s.timeline}>
        {STEPS.map((step, i) => {
          const isFailStep = failed && i === 1
          const active     = i <= stepIdx
          const isCurrent  = i === stepIdx && !failed && stepIdx < 2
          const dotBg      = isFailStep ? colors.error : active ? colors.primary : '#D1D5DB'
          const lblColor   = isFailStep ? colors.error : active ? colors.dark : colors.muted
          const isLast     = i === STEPS.length - 1
          // Timestamp: show under active steps
          const ts = i === 0 ? formatDateTime(o.createTime)
            : i === stepIdx && o.finishTime ? formatDateTime(o.finishTime)
            : ''
          return (
            <React.Fragment key={step}>
              <View style={s.stepItem}>
                {/* Ring + dot */}
                <View style={s.stepDotWrap}>
                  {isCurrent && (
                    <Animated.View style={[s.stepRing, {
                      opacity: ringAnim,
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [1, 1.18], outputRange: [1, 1.7] }) }],
                      backgroundColor: colors.primary + '28',
                    }]} />
                  )}
                  <Animated.View style={[
                    s.stepDot, { backgroundColor: dotBg },
                    isCurrent && { transform: [{ scale: pulseAnim }] },
                  ]}>
                    {active
                      ? <Feather name={isFailStep ? 'x' : 'check'} size={14} color="#fff" />
                      : null
                    }
                  </Animated.View>
                </View>
                <Text style={[s.stepLabel, { color: lblColor }]}>{stepLabel(step, failed, i)}</Text>
                {ts ? <Text style={s.stepTime}>{ts}</Text> : null}
              </View>
              {!isLast && (
                <View style={[s.stepLine, { backgroundColor: i < stepIdx ? colors.primary : '#D1D5DB' }]} />
              )}
            </React.Fragment>
          )
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Main card ── */}
        <View style={s.card}>

          {/* Card logo + name */}
          <View style={s.cardHeader}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={s.cardLogo} resizeMode="cover" />
            ) : (
              <View style={[s.cardLogo, { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="credit-card" size={20} color={colors.primary} />
              </View>
            )}
            <Text style={s.cardName}>{o.categoryName}</Text>
          </View>

          <View style={s.divider} />

          {/* Order ID — tap to copy, inline feedback */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Order Id</Text>
            <TouchableOpacity onPress={copyId} activeOpacity={0.6} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1, justifyContent: 'flex-end' }}>
              <Text style={s.rowVal} numberOfLines={1} ellipsizeMode="middle">{o.orderNo}</Text>
              {copied && <Text style={s.copiedTxt}>Copied!</Text>}
            </TouchableOpacity>
          </View>

          {/* Sales Price */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Sales Price</Text>
            <Text style={[s.rowVal, s.green]}>₦{fmt(o.ngnAmount)}</Text>
          </View>

          {/* Coupon Discount — show only if applied */}
          {o.couponDiscount ? (
            <View style={s.row}>
              <Text style={s.rowLbl}>Coupon Discount</Text>
              <Text style={[s.rowVal, s.green]}>+₦{fmt(o.couponDiscount)}</Text>
            </View>
          ) : null}

          {/* Settlement */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Settlement Amount</Text>
            <Text style={[s.rowVal, s.green]}>
              ₦{fmt((o.ngnAmount || 0) + (o.couponDiscount || 0))}
            </Text>
          </View>

          {/* Fail reason */}
          {failed && o.rejectReason ? (
            <View style={s.row}>
              <Text style={s.rowLbl}>Fail Reason</Text>
              <Text style={[s.rowVal, { color: colors.error }]}>{o.rejectReason}</Text>
            </View>
          ) : null}

          <View style={s.divider} />

          {/* Card Info */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Card Info</Text>
            <Text style={s.rowVal}>{sym}{fmt(o.cardAmount)} {o.cardCurrency} {typeLabel}</Text>
          </View>

          {/* Card Detail (code) */}
          {o.cardCode ? (
            <View style={s.row}>
              <Text style={s.rowLbl}>Card Detail</Text>
              <Text style={s.rowVal}>{o.cardCode}</Text>
            </View>
          ) : null}

          {/* Create Time */}
          <View style={s.row}>
            <Text style={s.rowLbl}>Create Time</Text>
            <Text style={s.rowVal}>{formatDateTime(o.createTime)}</Text>
          </View>

          {/* Card Images */}
          <View style={s.imgSection}>
            <Text style={s.rowLbl}>Card Images</Text>
            {cardImgUrls.length > 0 ? (
              <View style={s.thumbRow}>
                {cardImgUrls.map((uri, i) => (
                  <TouchableOpacity key={i} onPress={() => openViewer(cardImgUrls, i)} activeOpacity={0.85}>
                    <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={s.noContent}>—</Text>
            )}
          </View>

          {/* Fail Images (admin verify image) */}
          {verifyImgUrl ? (
            <View style={s.imgSection}>
              <Text style={[s.rowLbl, { color: colors.error }]}>Fail Images</Text>
              <View style={s.thumbRow}>
                <TouchableOpacity onPress={() => openViewer([verifyImgUrl])} activeOpacity={0.85}>
                  <Image source={{ uri: verifyImgUrl }} style={s.thumb} resizeMode="cover" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Admin comment */}
          {o.verifyRemark ? (
            <View style={s.row}>
              <Text style={s.rowLbl}>Comment</Text>
              <Text style={[s.rowVal, { color: failed ? colors.error : colors.primary, flex: 1, textAlign: 'right' }]}>
                {o.verifyRemark}
              </Text>
            </View>
          ) : null}

        </View>
      </ScrollView>

      {/* ── Chat button ── */}
      <View style={[s.chatWrap, { paddingBottom: Math.max(insets.bottom, 16) + spacing[4] }]}>
        <TouchableOpacity style={s.chatBtn} activeOpacity={0.85}
          onPress={() => props.navigation.navigate('Chat', { orderId: o.id, orderNo: o.orderNo })}>
          <Text style={s.chatBtnTxt}>Chat with Support</Text>
        </TouchableOpacity>
      </View>

      {/* ── Image viewer ── */}
      {imgViewerOpen && imgViewerUrls.length > 0 && (
        <Modal visible animationType="fade" transparent={false}>
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 56, right: spacing[5], zIndex: 10 }}
              onPress={() => setImgViewerOpen(false)}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
            <Image
              source={{ uri: imgViewerUrls[imgViewerIdx] }}
              style={{ width: W, height: W * 1.3, maxHeight: '80%' as any }}
              resizeMode="contain"
            />
            {imgViewerUrls.length > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6], marginTop: spacing[6] }}>
                <TouchableOpacity
                  onPress={() => setImgViewerIdx(i => Math.max(0, i - 1))}
                  disabled={imgViewerIdx === 0}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="chevron-left" size={26} color={imgViewerIdx === 0 ? 'rgba(255,255,255,0.25)' : '#fff'} />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: typography.size.lg, fontWeight: typography.weight.semibold }}>
                  {imgViewerIdx + 1} / {imgViewerUrls.length}
                </Text>
                <TouchableOpacity
                  onPress={() => setImgViewerIdx(i => Math.min(imgViewerUrls.length - 1, i + 1))}
                  disabled={imgViewerIdx === imgViewerUrls.length - 1}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="chevron-right" size={26} color={imgViewerIdx === imgViewerUrls.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },

  // Timeline
  timeline: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing[6], paddingBottom: spacing[4],
  },
  stepItem: { alignItems: 'center', minWidth: 72 },
  stepDotWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] + 2 },
  stepRing: { position: 'absolute', width: 46, height: 46, borderRadius: 23 },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  stepLabel: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, textAlign: 'center' },
  stepTime: { fontSize: typography.size.xs, color: colors.muted, textAlign: 'center', marginTop: 2, lineHeight: 16 },
  stepLine: { flex: 1, height: 2, marginTop: 14 },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    padding: spacing[4], ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingBottom: spacing[3] },
  cardLogo: { width: 44, height: 44, borderRadius: radius.md },
  cardName: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3],
  },
  rowLbl: { fontSize: typography.size.base, color: colors.muted, flex: 1 },
  rowVal: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark, textAlign: 'right', maxWidth: '65%' },
  green: { color: colors.primary },

  // Copy button
  copyBtn: {
    backgroundColor: colors.dark, borderRadius: radius.sm,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  copyBtnTxt: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: '#fff' },

  // Images
  imgSection: { paddingVertical: spacing[2] + 2 },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  thumb: { width: 80, height: 80, borderRadius: radius.md },
  noContent: { fontSize: typography.size.sm, color: colors.subtle, marginTop: spacing[1] },

  // Copy feedback
  copiedTxt: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.bold },

  // Chat button
  chatWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[5], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  chatBtn: {
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  chatBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})
