import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal,
  Dimensions,
} from 'react-native'
import * as ExpoClipboard from 'expo-clipboard'
const { width: W } = Dimensions.get('window')
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import { fetchMyWithdrawals, fetchTransactions, Transaction } from '../api/wallet'
import client from '../api/client'
import { useDrawerSwipe } from '../hooks/useDrawerSwipe'

type Order = {
  id: number
  orderNo: string
  categoryName: string
  categoryIcon?: string
  cardCurrency: string
  inputType: string
  speed?: string
  cardAmount: number
  quantity: number
  rate: number
  ngnAmount: number
  newAmount?: number
  vipReward?: number
  totalSettlement?: number
  countryRate?: number
  cardCode?: string
  cardImage?: string
  verifyRemark?: string
  verifyImage?: string
  status: string
  rejectReason?: string
  createTime: string
  finishTime?: string
}

// Steps: pending → processing → paid/rejected
const STEPS = ['Pending', 'Processing', 'Finished']
function getStepIndex(status: string): number {
  const s = status?.toLowerCase()
  if (s === 'paid' || s === 'completed') return 2
  if (s === 'processing') return 1
  if (s === 'rejected') return 2  // failed is at step 3
  return 0
}
function isFailed(status: string) {
  return status?.toLowerCase() === 'rejected'
}

const STATUS_COLOR: Record<string, string> = {
  pending:    colors.warning,
  processing: colors.info,
  paid:       colors.success,
  completed:  colors.success,
  rejected:   colors.error,
}
function statusColor(s: string) { return STATUS_COLOR[s?.toLowerCase()] || colors.muted }
function statusLabel(s: string) {
  const map: Record<string, string> = { paid: 'Finished', completed: 'Finished', rejected: 'Failed' }
  return map[s?.toLowerCase()] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Pending')
}

function formatDateTime(str: string) {
  if (!str) return '—'
  const d = new Date(str)
  const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

function fmt(n: number | undefined | null) {
  return (typeof n === 'number' && !isNaN(n) ? n : 0)
    .toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function currSymbol(code: string) {
  const map: Record<string, string> = { AUD: 'A$', GBP: '£', EUR: '€', CAD: 'C$', USD: '$' }
  return map[code] || '$'
}

async function fetchMyOrders(): Promise<Order[]> {
  try {
    const res = await client.get('/tuka/order/my', { params: { pageNum: 1, pageSize: 100 } })
    return res.data.rows || []
  } catch { return [] }
}

type Tab = 'giftcards' | 'withdraw' | 'commission'

// ── Scroll-wheel date picker ──────────────────────────────────────────────────
const ITEM_H  = 36
const VISIBLE = 3   // rows shown (selected is middle = index 1)

function WheelColumn({ items, selectedIndex, onSelect }: {
  items: string[]
  selectedIndex: number
  onSelect: (i: number) => void
}) {
  const ref = useRef<ScrollView>(null)

  useEffect(() => {
    // With paddingVertical = ITEM_H * 2, item[i] sits at y = i * ITEM_H
    // Scrolling to y = i * ITEM_H centers it in the middle row
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false })
  }, [])

  return (
    <ScrollView
      ref={ref}
      style={{ height: ITEM_H * VISIBLE, flex: 1 }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={e => {
        // offset / ITEM_H gives the index directly (padding is symmetric)
        const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
        onSelect(Math.max(0, Math.min(i, items.length - 1)))
      }}
      contentContainerStyle={{ paddingVertical: ITEM_H }}
    >
      {items.map((item, i) => {
        const dist = Math.abs(i - selectedIndex)
        const size = dist === 0 ? typography.size.xl : typography.size.sm
        const color = dist === 0 ? colors.dark : colors.subtle
        const weight = dist === 0 ? typography.weight.extrabold : typography.weight.regular
        return (
          <TouchableOpacity key={item} style={wp.item} onPress={() => {
            onSelect(i)
            ref.current?.scrollTo({ y: i * ITEM_H, animated: true })
          }} activeOpacity={0.7}>
            <Text style={{ fontSize: size, color, fontWeight: weight }}>{item}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const wp = StyleSheet.create({
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
})

// Single shared wheel — shows year/month/day for whichever date is active
function SharedDateWheel({ activeDate, onChange }: {
  activeDate: string
  onChange: (v: string) => void
}) {
  const now    = new Date()
  const parsed = activeDate ? new Date(activeDate + 'T00:00:00') : now

  const years  = Array.from({ length: 10 }, (_, i) => String(now.getFullYear() - 4 + i))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

  const [yi, setYi] = useState(() => Math.max(0, years.indexOf(String(parsed.getFullYear()))))
  const [mi, setMi] = useState(parsed.getMonth())
  const [di, setDi] = useState(parsed.getDate() - 1)

  const daysInMonth = new Date(parseInt(years[yi]), mi + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'))

  function emit(y: number, m: number, d: number) {
    const yr   = parseInt(years[y])
    const mo   = m + 1
    const maxD = new Date(yr, mo, 0).getDate()
    const day  = Math.min(d + 1, maxD)
    onChange(`${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
  }

  return (
    <View style={dw.wheel}>
      {/* Selection highlight bar */}
      <View style={dw.highlight} pointerEvents="none" />
      <WheelColumn items={years}  selectedIndex={yi} onSelect={i => { setYi(i); emit(i, mi, di) }} />
      <WheelColumn items={months} selectedIndex={mi} onSelect={i => { setMi(i); emit(yi, i, di) }} />
      <WheelColumn items={days}   selectedIndex={Math.min(di, daysInMonth - 1)} onSelect={i => { setDi(i); emit(yi, mi, i) }} />
    </View>
  )
}

const dw = StyleSheet.create({
  wheel: {
    flexDirection: 'row', position: 'relative',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    marginBottom: spacing[4],
  },
  highlight: {
    position: 'absolute',
    top: ITEM_H, left: 0, right: 0, height: ITEM_H,
    backgroundColor: colors.background,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
})

export default function OrdersScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const { user } = useAuth()
  const [orders, setOrders]         = useState<Order[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab]               = useState<Tab>('giftcards')
  const [selected, setSelected]     = useState<Order | null>(null)
  const [selectedComm, setSelectedComm] = useState<Transaction | null>(null)
  const [imgViewerOpen, setImgViewerOpen] = useState(false)
  const [imgViewerIdx, setImgViewerIdx]   = useState(0)

  // Commission tab
  const [commission, setCommission]       = useState<Transaction[]>([])
  const [commLoading, setCommLoading]     = useState(false)

  const [filterOpen, setFilterOpen]       = useState(false)
  // Unified filter state (applies to giftcards + withdraw tabs)
  const [filterStatus, setFilterStatus]   = useState<string>('')   // '' = all
  const [filterType,   setFilterType]     = useState<string>('')   // '' = all
  const [filterStart,  setFilterStart]    = useState<string>('')
  const [filterEnd,    setFilterEnd]      = useState<string>('')
  // Pending (not yet confirmed)
  const [pendingStatus, setPendingStatus] = useState<string>('')
  const [pendingType,   setPendingType]   = useState<string>('')
  const [pendingStart,  setPendingStart]  = useState<string>('')
  const [pendingEnd,    setPendingEnd]    = useState<string>('')
  const [activeDateField, setActiveDateField] = useState<'start' | 'end'>('start')
  const swipeHandlers = useDrawerSwipe()

  const load = useCallback(async () => {
    try {
      const [o, w] = await Promise.all([fetchMyOrders(), fetchMyWithdrawals()])
      setOrders(o)
      setWithdrawals(w)
    }
    catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { if (user.isPresent()) load() }, [user])
  const onRefresh = () => { setRefreshing(true); load() }

  // Load commission when tab switches to commission
  useEffect(() => {
    if (tab !== 'commission') return
    setCommLoading(true)
    fetchTransactions({ pageSize: 50, category: 'commission' })
      .then(r => {
        // Extra safety: only keep commission-type rows
        const allowed = ['leaderboard_reward', 'Registration Bonus', '注册奖励', 'coupon_reward']
        setCommission(r.list.filter(tx => allowed.includes(tx.type)))
      })
      .catch(() => {})
      .finally(() => setCommLoading(false))
  }, [tab])


  // Filtered lists
  const filteredGift = orders.filter(o => {
    if (filterStatus && o.status?.toLowerCase() !== filterStatus) return false
    if (filterStart && o.createTime < filterStart) return false
    if (filterEnd   && o.createTime > filterEnd + ' 23:59:59') return false
    return true
  })
  const filteredWithdraw = withdrawals.filter((w: any) => {
    if (filterStatus && w.status?.toLowerCase() !== filterStatus) return false
    if (filterStart && w.createTime < filterStart) return false
    if (filterEnd   && w.createTime > filterEnd + ' 23:59:59') return false
    return true
  })

  function openFilter() {
    setPendingStatus(filterStatus)
    setPendingType(filterType)
    setPendingStart(filterStart)
    setPendingEnd(filterEnd)
    setActiveDateField('start')
    setFilterOpen(true)
  }
  function confirmFilter() {
    setFilterStatus(pendingStatus)
    setFilterType(pendingType)
    setFilterStart(pendingStart)
    setFilterEnd(pendingEnd)
    setFilterOpen(false)
  }
  function resetFilter() {
    setPendingStatus(''); setPendingType(''); setPendingStart(''); setPendingEnd('')
  }
  const hasActiveFilter = !!(filterStatus || filterType || filterStart || filterEnd)

  function copyId(id: string) {
    ExpoClipboard.setStringAsync(id)
    Alert.alert('Copied', 'Order ID copied to clipboard')
  }

  // ── Commission detail screen ──────────────────────────────────────────────
  if (selectedComm) {
    const tx = selectedComm
    const orderId = tx.orderNo || `COMM${tx.id}`
    const rewardSource = tx.rewardSource || (tx.type === 'leaderboard_reward' ? 'Leaderboard Reward' : 'New User Bonus')

    return (
      <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={d.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={d.headerBg}>
          <AppHeader title="Order tracking" onBack={() => setSelectedComm(null)} />

          {/* Hero row */}
          <View style={d.heroRow}>
            <View style={[d.heroLogoFallback, { backgroundColor: colors.dark }]}>
              <Feather name="gift" size={26} color="#fff" />
            </View>
            <View style={d.heroInfo}>
              <Text style={d.heroName}>Commission</Text>
              <Text style={d.heroSub}>{rewardSource}</Text>
            </View>
            <View style={d.heroAmtWrap}>
              <Text style={d.heroAmt}>
                ₦{(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
              </Text>
              <View style={[d.statusChip, { backgroundColor: colors.success + '18', borderColor: colors.success }]}>
                <Text style={[d.statusChipTxt, { color: colors.success }]}>Success</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={d.section}>
            <Text style={d.sectionTitle}>Commission Details</Text>

            {/* Order ID */}
            <View style={d.row}>
              <Text style={d.rowLbl}>Order ID</Text>
              <TouchableOpacity style={d.rowIdWrap} onPress={() => copyId(orderId)} activeOpacity={0.7}>
                <Text style={d.rowIdTxt} numberOfLines={1}>{orderId}</Text>
                <View style={d.rowCopyBtn}>
                  <Feather name="copy" size={12} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
            <View style={d.sep} />

            {[
              { lbl: 'Status',            val: 'Success',      accent: colors.success },
              { lbl: 'Settlement Amount', val: `₦${(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`, accent: colors.success },
              { lbl: 'Reward Source',     val: rewardSource,   accent: null as string | null },
              { lbl: 'Create Time',       val: tx.createTime,  accent: null as string | null },
            ].map((item, i, arr) => (
              <View key={item.lbl}>
                <View style={d.row}>
                  <Text style={d.rowLbl}>{item.lbl}</Text>
                  <Text style={[d.rowVal, item.accent ? { color: item.accent, fontWeight: typography.weight.bold } : {}]}>
                    {item.val}
                  </Text>
                </View>
                {i < arr.length - 1 && <View style={d.sep} />}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Chat button */}
        <View style={{ paddingHorizontal: spacing[5], paddingVertical: spacing[4] }}>
          <TouchableOpacity
            style={{ backgroundColor: colors.dark, borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center' }}
            onPress={() => props.navigation.navigate('Chat' as any)}
            activeOpacity={0.85}>
            <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' }}>
              Chat with Support
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
      </Modal>
    )
  }

  // ── Detail screen ──────────────────────────────────────────────────────────
  if (selected) {
    const o = selected
    const stepIdx = getStepIndex(o.status)
    const failed  = isFailed(o.status)
    const imgUrl  = resolveImageUrl(o.categoryIcon ?? null)
    const verifyImgUrl = o.verifyImage ? resolveImageUrl(o.verifyImage) : null
    const cardImgUrls  = o.cardImage
      ? o.cardImage.split(',').map(u => resolveImageUrl(u.trim())).filter(Boolean) as string[]
      : []
    const sc  = statusColor(o.status)
    const sl  = statusLabel(o.status)
    const sym = currSymbol(o.cardCurrency)
    const typeLabel = [
      o.inputType && o.inputType !== 'All' ? o.inputType : null,
      o.speed ? o.speed.charAt(0).toUpperCase() + o.speed.slice(1) : null,
    ].filter(Boolean).join(' · ')

    return (
      <SafeAreaView style={d.safe} edges={['top']}>
        {/* ── Header — white, clean ── */}
        <View style={d.headerBg}>
          <View style={d.headerRow}>
            <TouchableOpacity onPress={() => setSelected(null)} style={d.backBtn} activeOpacity={0.8}>
              <Feather name="chevron-left" size={22} color={colors.dark} />
            </TouchableOpacity>
            <Text style={d.headerTitle}>Order Detail</Text>
            <TouchableOpacity style={d.copyTopBtn} onPress={() => copyId(o.orderNo)} activeOpacity={0.8}>
              <Feather name="copy" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Card info row */}
          <View style={d.heroRow}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={d.heroLogo} resizeMode="cover" />
            ) : (
              <View style={d.heroLogoFallback}>
                <Feather name="credit-card" size={26} color={colors.primary} />
              </View>
            )}
            <View style={d.heroInfo}>
              <Text style={d.heroName}>{o.categoryName}</Text>
              <Text style={d.heroSub}>{o.cardCurrency} · {typeLabel || 'Gift Card'}</Text>
            </View>
            <View style={d.heroAmtWrap}>
              <Text style={d.heroAmt}>₦{fmt(o.ngnAmount)}</Text>
              <View style={[d.statusChip, { backgroundColor: sc + '18', borderColor: sc }]}>
                <Text style={[d.statusChipTxt, { color: sc }]}>{sl}</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>

          {/* ── Timeline — horizontal ── */}
          <View style={d.timelineCard}>
            {STEPS.map((step, i) => {
              const isFailStep = failed && i === 2
              const active     = i <= stepIdx
              const dotBg      = isFailStep ? colors.error : active ? colors.primary : colors.border
              const lblColor   = isFailStep ? colors.error : active ? colors.dark : colors.subtle
              const isLast     = i === STEPS.length - 1
              return (
                <React.Fragment key={step}>
                  <View style={d.timelineItem}>
                    <View style={[d.timelineDot, { backgroundColor: dotBg }]}>
                      {active
                        ? <Feather name={isFailStep ? 'x' : 'check'} size={13} color="#fff" />
                        : <View style={d.timelineDotInner} />
                      }
                    </View>
                    <Text style={[d.timelineLabel, { color: lblColor }]}>
                      {isFailStep ? 'Failed' : step}
                    </Text>
                  </View>
                  {!isLast && (
                    <View style={[d.timelineConnector, { backgroundColor: i < stepIdx ? colors.primary : colors.border }]} />
                  )}
                </React.Fragment>
              )
            })}
          </View>

          {/* ── Error banner — removed, shown in Admin Comment section below ── */}

          {/* ── Order details ── */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>Order Details</Text>

            {/* Order ID */}
            <View style={d.row}>
              <Text style={d.rowLbl}>Order ID</Text>
              <TouchableOpacity style={d.rowIdWrap} onPress={() => copyId(o.orderNo)} activeOpacity={0.7}>
                <Text style={d.rowIdTxt} numberOfLines={1}>{o.orderNo}</Text>
                <View style={d.rowCopyBtn}>
                  <Feather name="copy" size={12} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
            <View style={d.sep} />

            {[
              { lbl: 'Gift Card',    val: o.categoryName },
              { lbl: 'Card Type',    val: typeLabel || '—' },
              { lbl: 'Card Value',   val: `${sym}${fmt(o.cardAmount)} ${o.cardCurrency}` },
              { lbl: 'Quantity',     val: `${o.quantity ?? 1}` },
              { lbl: 'Rate',         val: `₦${fmt(o.rate)} / $1` },
              { lbl: 'Sales Price',  val: `₦${fmt(o.ngnAmount)}`,  accent: true },
              { lbl: 'VIP Bonus',    val: `₦${fmt(o.vipReward)}` },
              { lbl: 'Settlement',   val: `₦${fmt(o.totalSettlement)}` },
              { lbl: 'Submitted',    val: formatDateTime(o.createTime) },
              { lbl: 'Completed',    val: o.finishTime ? formatDateTime(o.finishTime) : '—' },
            ].map((item, i, arr) => (
              <View key={item.lbl}>
                <View style={d.row}>
                  <Text style={d.rowLbl}>{item.lbl}</Text>
                  <Text style={[d.rowVal, item.accent && { color: colors.primary, fontWeight: typography.weight.extrabold }]}>
                    {item.val}
                  </Text>
                </View>
                {i < arr.length - 1 && <View style={d.sep} />}
              </View>
            ))}
          </View>

          {/* ── Card code ── */}
          {o.cardCode ? (
            <View style={d.section}>
              <Text style={d.sectionTitle}>Card Code</Text>
              <View style={d.codeBox}>
                <Text style={d.codeTxt}>{o.cardCode}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Card images — text link, opens full-screen viewer ── */}
          <View style={d.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={d.sectionTitle}>Card Images</Text>
              {cardImgUrls.length > 0 ? (
                <TouchableOpacity onPress={() => setImgViewerOpen(true)} activeOpacity={0.7}>
                  <Text style={d.viewImgLink}>View {cardImgUrls.length} image{cardImgUrls.length > 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={d.noContent}>None uploaded</Text>
              )}
            </View>
          </View>

          {/* ── Admin comment ── */}
          <View style={d.section}>
            <View style={d.commentHeader}>
              <Feather name="message-square" size={16} color={colors.primary} />
              <Text style={d.sectionTitle}>Admin Comment</Text>
            </View>
            {o.verifyRemark ? (
              <View style={[d.commentBox, { borderColor: failed ? colors.error : colors.primary, backgroundColor: failed ? colors.errorLight : colors.primaryLight }]}>
                <Text style={[d.commentTxt, { color: failed ? colors.error : colors.primary }]}>{o.verifyRemark}</Text>
              </View>
            ) : (
              <Text style={d.noContent}>No comment from admin yet</Text>
            )}
          </View>

        </ScrollView>

        {/* ── Full-screen image viewer ── */}
        {imgViewerOpen && cardImgUrls.length > 0 && (
          <Modal visible animationType="fade" transparent={false}>
            <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 56, right: spacing[5], zIndex: 10 }}
                onPress={() => { setImgViewerOpen(false); setImgViewerIdx(0) }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={22} color="#fff" />
                </View>
              </TouchableOpacity>
              <Image
                source={{ uri: cardImgUrls[imgViewerIdx] }}
                style={{ width: W, height: W * 1.3, maxHeight: '80%' as any }}
                resizeMode="contain"
              />
              {cardImgUrls.length > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6], marginTop: spacing[6] }}>
                  <TouchableOpacity
                    onPress={() => setImgViewerIdx(i => Math.max(0, i - 1))}
                    disabled={imgViewerIdx === 0}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="chevron-left" size={26} color={imgViewerIdx === 0 ? 'rgba(255,255,255,0.25)' : '#fff'} />
                  </TouchableOpacity>
                  <Text style={{ color: '#fff', fontSize: typography.size.lg, fontWeight: typography.weight.semibold }}>
                    {imgViewerIdx + 1} / {cardImgUrls.length}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setImgViewerIdx(i => Math.min(cardImgUrls.length - 1, i + 1))}
                    disabled={imgViewerIdx === cardImgUrls.length - 1}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="chevron-right" size={26} color={imgViewerIdx === cardImgUrls.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff'} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Modal>
        )}

      </SafeAreaView>
    )
  }

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (!user.isPresent()) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.pageTitle}>Transaction</Text>
        <View style={s.guestWrap}>
          <View style={s.guestIcon}><Feather name="clock" size={32} color={colors.primary} /></View>
          <Text style={s.guestTitle}>Sign in to view your history</Text>
          <Text style={s.guestSub}>All your gift card orders in one place</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => props.navigation.navigate('Login')}>
            <Text style={s.loginBtnTxt}>Log In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <SafeAreaView style={s.safe}>
      <Text style={s.pageTitle}>Transaction</Text>

      {/* Tab pills + filter button */}
      <View style={s.tabBarRow}>
        <View style={s.tabRow}>
          {(['giftcards', 'withdraw', 'commission'] as Tab[]).map(t => (
            <TouchableOpacity key={t}
              style={[s.tabPill, tab === t && s.tabPillOn]}
              onPress={() => { setTab(t); setFilterOpen(false) }} activeOpacity={0.8}>
              <Text style={[s.tabPillTxt, tab === t && s.tabPillTxtOn]}>
                {t === 'giftcards' ? 'Gift Cards' : t === 'withdraw' ? 'Withdraw' : 'Commission'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Filter button — only for giftcards and withdraw tabs */}
        {tab !== 'commission' && (
          <TouchableOpacity style={[s.filterBtn, hasActiveFilter && s.filterBtnActive]} onPress={openFilter} activeOpacity={0.8}>
            <Feather name="filter" size={15} color={hasActiveFilter ? colors.primary : colors.dark} />
            {hasActiveFilter && <View style={s.filterDot} />}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: spacing[4], paddingBottom: 120 }}>

        {loading && tab !== 'commission' ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[16] }} />
        ) : tab === 'commission' ? (
          // ── Commission tab ────────────────────────────────────────────────
          commLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[16] }} />
          ) : commission.length === 0 ? (
            <View style={s.emptyWrap}>
              <Feather name="award" size={48} color={colors.border} />
              <Text style={s.emptyTxt}>No commission yet</Text>
              <Text style={s.emptySub}>Trade more to earn leaderboard rewards</Text>
            </View>
          ) : (
            commission.map((tx) => (
              <TouchableOpacity key={tx.id} style={s.commCard} activeOpacity={0.85}
                onPress={() => setSelectedComm(tx)}>
                {/* Left: icon + info */}
                <View style={s.commLeft}>
                  <View style={s.commIconCircle}>
                    <Feather name="gift" size={22} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.commTitle}>Commission</Text>
                    <Text style={s.commDate}>{tx.createTime}</Text>
                    {tx.orderNo ? (
                      <TouchableOpacity style={s.commIdRow} onPress={() => copyId(tx.orderNo)} activeOpacity={0.7}>
                        <Text style={s.commId}>Order Id:{tx.orderNo}</Text>
                        <Feather name="copy" size={12} color={colors.muted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                {/* Right: amount + status */}
                <View style={s.commRight}>
                  <Text style={s.commAmt}>₦{(tx.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })}</Text>
                  <Text style={s.commStatus}>Success</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : tab === 'giftcards' && filteredGift.length === 0 ? (
          <View style={s.emptyWrap}>
            <Feather name="credit-card" size={48} color={colors.border} />
            <Text style={s.emptyTxt}>No orders found</Text>
            <Text style={s.emptySub}>{filterStatus || filterStart ? 'Try a different filter' : 'Sell a gift card to get started'}</Text>
          </View>
        ) : tab === 'giftcards' ? (
          filteredGift.map((order: any) => {
            const sc     = statusColor(order.status)
            const sl     = statusLabel(order.status)
            const imgUrl = resolveImageUrl(order.categoryIcon ?? null)
            const sym    = currSymbol(order.cardCurrency)
            const typeLabel = [
              order.inputType && order.inputType !== 'All' ? order.inputType : null,
              order.speed ? order.speed.charAt(0).toUpperCase() + order.speed.slice(1) : null,
            ].filter(Boolean).join(' · ')
            return (
              <TouchableOpacity key={order.id} style={s.card}
                onPress={() => props.navigation.navigate('OrderDetail', { order: JSON.stringify(order) })}
                activeOpacity={0.85}>

                {/* Top row: icon + name + NGN amount */}
                <View style={s.cardTop}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={s.cardLogo} resizeMode="cover" />
                  ) : (
                    <View style={[s.cardLogo, s.cardLogoFallback]}>
                      <Feather name="credit-card" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={s.cardInfo}>
                    <Text style={s.cardName} numberOfLines={1}>{order.categoryName}</Text>
                    <Text style={s.cardMeta}>
                      {sym}{fmt(order.cardAmount)} {order.cardCurrency}
                      {typeLabel ? `  ·  ${typeLabel}` : ''}
                    </Text>
                  </View>
                  <View style={s.cardAmtWrap}>
                    <Text style={s.cardNgn}>₦{fmt(order.ngnAmount)}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={s.cardDivider} />

                {/* Bottom row: order ID + status + date */}
                <View style={s.cardBottom}>
                  <TouchableOpacity style={s.idRow} onPress={() => copyId(order.orderNo)} activeOpacity={0.7}>
                    <Text style={s.idTxt} numberOfLines={1}>{order.orderNo}</Text>
                    <Feather name="copy" size={12} color={colors.muted} style={{ marginLeft: spacing[1] }} />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                    <View style={[s.statusDot, { backgroundColor: sc }]} />
                    <Text style={[s.statusTxt, { color: sc }]}>{sl}</Text>
                  </View>
                </View>
                <Text style={s.cardDate}>{formatDateTime(order.createTime)}</Text>
              </TouchableOpacity>
            )
          })
        ) : filteredWithdraw.length === 0 ? (
          <View style={s.emptyWrap}>
            <Feather name="arrow-up-right" size={48} color={colors.border} />
            <Text style={s.emptyTxt}>No withdrawals found</Text>
            <Text style={s.emptySub}>{filterStatus || filterStart ? 'Try a different filter' : 'Withdraw your balance to your bank'}</Text>
          </View>
        ) : (
          // Withdrawals tab
          filteredWithdraw.map((w: any) => {
            const stColor = w.status === 'completed' ? colors.success : w.status === 'rejected' ? colors.error : colors.warning
            const stLabel = w.status === 'completed' ? 'Completed' : w.status === 'rejected' ? 'Rejected' : 'Pending'
            return (
              <TouchableOpacity key={w.id} style={s.card}
                onPress={() => props.navigation.navigate('WithdrawDetail' as any, { withdrawal: JSON.stringify(w) })}
                activeOpacity={0.85}>
                <View style={s.cardTop}>
                  <Text style={s.idTxt} numberOfLines={1}>ID:{w.withdrawNo}</Text>
                  <View style={[s.typeBadge, { backgroundColor: colors.errorLight }]}>
                    <Text style={[s.typeBadgeTxt, { color: colors.error }]}>withdrawal</Text>
                  </View>
                </View>
                <View style={s.cardMid}>
                  <View style={[s.cardLogo, s.cardLogoFallback, { backgroundColor: colors.errorLight }]}>
                    <Feather name="arrow-up-right" size={22} color={colors.error} />
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardName} numberOfLines={1}>{w.bankName}</Text>
                    <Text style={[s.cardNgn, { color: colors.error }]}>₦ {fmt(w.amount)}</Text>
                    <Text style={s.cardType}>{w.accountName} · {w.accountNo}</Text>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  <View style={[s.statusBadge, { borderColor: stColor }]}>
                    <Text style={[s.statusTxt, { color: stColor }]}>{stLabel}</Text>
                  </View>
                  <Text style={s.cardDate}>{formatDateTime(w.createTime)}</Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>

    {/* ── Filter bottom sheet ── */}
    <Modal visible={filterOpen} transparent animationType="slide" statusBarTranslucent>
      <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={() => setFilterOpen(false)} />
        <View style={fs.sheet}>
        <View style={fs.handle} />
        <Text style={fs.title}>Filter</Text>

        {/* Status */}
        <Text style={fs.sectionLbl}>Status</Text>
        <View style={fs.chipRow}>
          {(tab === 'giftcards'
            ? [['processing','Processing'],['rejected','Failed'],['paid','Success']]
            : [['pending','Pending'],['processing','Processing'],['completed','Success'],['rejected','Failed']]
          ).map(([val, label]) => (
            <TouchableOpacity key={val}
              style={[fs.chip, pendingStatus === val && fs.chipOn]}
              onPress={() => setPendingStatus(pendingStatus === val ? '' : val)}
              activeOpacity={0.8}>
              <Text style={[fs.chipTxt, pendingStatus === val && fs.chipTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type — only for giftcards */}
        {tab === 'giftcards' && (
          <>
            <Text style={fs.sectionLbl}>Type</Text>
            <View style={fs.chipRow}>
              {[['gift_card_sale','Sales'],['leaderboard_reward','Reward'],['Registration Bonus','Commission']].map(([val, label]) => (
                <TouchableOpacity key={val}
                  style={[fs.chip, pendingType === val && fs.chipOn]}
                  onPress={() => setPendingType(pendingType === val ? '' : val)}
                  activeOpacity={0.8}>
                  <Text style={[fs.chipTxt, pendingType === val && fs.chipTxtOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Date range */}
        <Text style={fs.sectionLbl}>Date</Text>
        <View style={fs.dateDisplayRow}>
          <TouchableOpacity
            style={[fs.dateDisplay, pendingStart && fs.dateDisplayFilled, activeDateField === 'start' && fs.dateDisplayActive]}
            onPress={() => setActiveDateField('start')} activeOpacity={0.8}>
            <Text style={[fs.dateDisplayTxt, pendingStart && fs.dateDisplayTxtFilled]}>
              {pendingStart || 'Select startTime'}
            </Text>
          </TouchableOpacity>
          <Text style={fs.dateSep}>—</Text>
          <TouchableOpacity
            style={[fs.dateDisplay, pendingEnd && fs.dateDisplayFilled, activeDateField === 'end' && fs.dateDisplayActive]}
            onPress={() => setActiveDateField('end')} activeOpacity={0.8}>
            <Text style={[fs.dateDisplayTxt, pendingEnd && fs.dateDisplayTxtFilled]}>
              {pendingEnd || 'Select endTime'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Single shared wheel */}
        <SharedDateWheel
          key={activeDateField}
          activeDate={activeDateField === 'start' ? (pendingStart || new Date().toISOString().slice(0,10)) : (pendingEnd || new Date().toISOString().slice(0,10))}
          onChange={v => activeDateField === 'start' ? setPendingStart(v) : setPendingEnd(v)}
        />

        {/* Buttons */}
        <View style={fs.btnRow}>
          <TouchableOpacity style={fs.resetBtn} onPress={resetFilter} activeOpacity={0.8}>
            <Text style={fs.resetTxt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fs.confirmBtn} onPress={confirmFilter} activeOpacity={0.85}>
            <Text style={fs.confirmTxt}>Confirm</Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    </Modal>

    </View>
  )
}

// ── List styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F2F5' },
  pageTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, textAlign: 'center', paddingVertical: spacing[4] },
  tabBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[2] },
  tabRow: { flexDirection: 'row', gap: spacing[2], flex: 1 },
  tabPill: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  tabPillOn: { borderColor: colors.dark, backgroundColor: colors.dark },
  tabPillTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },
  tabPillTxtOn: { color: '#fff' },
  filterBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { borderColor: colors.primary },
  filterDot: {
    position: 'absolute', top: 6, right: 6,
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], ...shadow.sm, marginBottom: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  cardLogo: { width: 48, height: 48, borderRadius: radius.lg, flexShrink: 0 },
  cardLogoFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, marginBottom: 3 },
  cardMeta: { fontSize: typography.size.sm, color: colors.muted },
  cardAmtWrap: { alignItems: 'flex-end' },
  cardNgn: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  cardDivider: { height: 1, backgroundColor: colors.border, marginBottom: spacing[3] },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  idRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing[3] },
  idTxt: { fontSize: typography.size.xs, color: colors.muted, flexShrink: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  cardDate: { fontSize: typography.size.xs, color: colors.subtle },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing[16], gap: spacing[3] },
  emptyTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.muted },
  emptySub: { fontSize: typography.size.sm, color: colors.subtle, textAlign: 'center', paddingHorizontal: spacing[8] },

  // Commission tab
  commCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[4], marginBottom: spacing[3], ...shadow.sm,
  },
  commLeft:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], flex: 1 },
  commIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  commTitle:  { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  commDate:   { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  commIdRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  commId:     { fontSize: typography.size.xs, color: colors.muted },
  commRight:  { alignItems: 'flex-end', gap: 4 },
  commAmt:    { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  commStatus: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.success },
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[8], gap: spacing[3] },
  guestIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark, textAlign: 'center' },
  guestSub: { fontSize: typography.size.base, color: colors.muted, textAlign: 'center' },
  loginBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing[8], paddingVertical: spacing[4], marginTop: spacing[3] },
  loginBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primaryText },
})

// ── Detail screen styles ──────────────────────────────────────────────────────
const d = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // White header
  headerBg: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: spacing[4],
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  copyTopBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero row inside header
  heroRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], gap: spacing[3],
  },
  heroLogo: { width: 56, height: 56, borderRadius: radius.lg },
  heroLogoFallback: {
    width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  heroInfo: { flex: 1 },
  heroName: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: 3 },
  heroSub: { fontSize: typography.size.sm, color: colors.muted },
  heroAmtWrap: { alignItems: 'flex-end', gap: spacing[2] },
  heroAmt: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  statusChip: {
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: 3,
  },
  statusChipTxt: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },

  // Horizontal timeline
  timelineCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginTop: spacing[4], marginBottom: spacing[4],
    paddingVertical: spacing[5], paddingHorizontal: spacing[4],
    flexDirection: 'row', alignItems: 'center',
    ...shadow.sm,
  },
  timelineItem: { alignItems: 'center', gap: spacing[1] + 2 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' },
  timelineConnector: { flex: 1, height: 2, marginBottom: spacing[4] },
  timelineLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, textAlign: 'center' },

  // Error banner
  errorBanner: {
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    backgroundColor: colors.errorLight, borderRadius: radius.xl,
    padding: spacing[4],
  },
  errorBannerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  errorBannerTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.error },
  errorBannerMsg: { fontSize: typography.size.sm, color: colors.error, lineHeight: 20 },
  errorBannerImg: { width: '100%', height: 120, borderRadius: radius.md, marginTop: spacing[3] },

  // Section card
  section: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    padding: spacing[5], ...shadow.sm,
  },
  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[4],
  },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3] + 2,
  },
  rowLbl: { fontSize: typography.size.base, color: colors.muted, flex: 1 },
  rowVal: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark, textAlign: 'right', maxWidth: '60%' },
  sep: { height: 1, backgroundColor: colors.border },

  // Order ID with copy
  rowIdWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1, justifyContent: 'flex-end' },
  rowIdTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, flexShrink: 1 },
  rowCopyBtn: {
    width: 26, height: 26, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // Code
  codeBox: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing[4],
  },
  codeTxt: { fontSize: typography.size.base, color: colors.dark, lineHeight: 24 },

  // Photos — replaced with text link
  viewImgLink: { fontSize: typography.size.base, color: colors.secondary, fontWeight: typography.weight.bold },
  noContent: { fontSize: typography.size.base, color: colors.subtle, paddingVertical: spacing[2] },

  // Admin comment
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  commentBox: {
    borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing[4],
  },
  commentTxt: { fontSize: typography.size.base, lineHeight: 24, fontWeight: typography.weight.medium },
})

// ── Filter bottom sheet styles ────────────────────────────────────────────────
const fs = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[5], paddingBottom: spacing[10],
  },
  handle:   {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[4],
  },
  title:    {
    fontSize: typography.size.xl, fontWeight: typography.weight.bold,
    color: colors.dark, textAlign: 'center', marginBottom: spacing[5],
  },
  sectionLbl: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.dark, marginBottom: spacing[3],
  },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[5] },
  chip:     {
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderRadius: radius.lg, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  chipOn:   { backgroundColor: colors.dark, borderColor: colors.dark },
  chipTxt:  { fontSize: typography.size.base, color: colors.muted, fontWeight: typography.weight.medium },
  chipTxtOn:{ color: '#fff', fontWeight: typography.weight.semibold },

  dateDisplayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  dateDisplay:    {
    flex: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing[3],
    paddingHorizontal: spacing[4], alignItems: 'center',
  },
  dateDisplayFilled:    { borderColor: colors.dark },
  dateDisplayActive:    { borderColor: colors.dark, borderWidth: 2 },
  dateDisplayTxt:       { fontSize: typography.size.sm, color: colors.subtle },
  dateDisplayTxtFilled: { color: colors.dark, fontWeight: typography.weight.semibold },
  dateSep:  { fontSize: typography.size.lg, color: colors.muted },

  btnRow:   { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  resetBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.dark,
    borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center',
  },
  resetTxt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  confirmBtn: {
    flex: 1, backgroundColor: colors.dark,
    borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center',
  },
  confirmTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})



