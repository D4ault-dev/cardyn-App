import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
  Alert, Modal, FlatList, KeyboardAvoidingView, Platform,
  Dimensions, Animated,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { BottomSheet } from '../components/BottomSheet'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { CameraView, useCameraPermissions } from 'expo-camera'
const { width: W } = Dimensions.get('window')
import { useAuth } from '../context/AuthContext'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchCountries, Country } from '../api/country'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client, { BASE_URL } from '../api/client'
import { currSym, currLabel } from '../util/currency'
import { fetchCurrencies, buildCurrencyLogoMap } from '../api/currency'
import { Analytics } from '../util/analytics'
import { trackAdEvent } from '../util/adManager'
import { ms, RF } from '../util/responsive'
import CouponPicker from '../components/CouponPicker'
import type { Coupon } from '../api/coupon'
import { useCountry } from '../context/CountryContext'

const CARD_BG = ['#E8F5E9','#FFF3E0','#E3F2FD','#FCE4EC','#F3E5F5','#E0F7FA','#FFF8E1','#E8EAF6']

function fmt(n: number, sym = '₦') {
  const v = typeof n === 'number' && !isNaN(n) ? n : 0
  return `${sym}${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

// ── Animated hold-to-submit button ───────────────────────────────────────────
function TradeButton({ submitting, onPress }: { submitting: boolean; onPress: () => void }) {
  if (submitting) {
    return (
      <View style={hb.btn}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }
  return (
    <TouchableOpacity style={hb.btn} onPress={onPress} activeOpacity={0.85}>
      <Text style={hb.txt}>Trade</Text>
    </TouchableOpacity>
  )
}

export default function SellCardScreen(props: StackScreenProps<RootStackParams, 'SellCard'>) {
  const { user } = useAuth()
  const { countries, selectedCountry } = useCountry()
  const insets = useSafeAreaInsets()
  const incomingCardId   = props.route?.params?.cardId
  const incomingCurrency  = (props.route?.params as any)?.currency  || ''
  const incomingInputType = (props.route?.params as any)?.inputType || ''
  const incomingMode      = (props.route?.params as any)?.mode      || ''
  const incomingCouponId  = (props.route?.params as any)?.couponId  || null

  const [cards, setCards]                 = useState<CardCategory[]>([])
  const [selectedCard, setSelectedCard]   = useState<CardCategory | null>(null)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [attempted,  setAttempted]        = useState(false)
  const [confirmOpen, setConfirmOpen]     = useState(false)
  const [couponPickerOpen, setCouponPickerOpen] = useState(false)
  const [returnToConfirm, setReturnToConfirm]   = useState(false)

  // Form
  const [selectedCurrency, setSelectedCurrency]   = useState('')
  const [selectedInputType, setSelectedInputType] = useState('')
  const [selectedMode, setSelectedMode]           = useState<'Fast' | 'Slow'>('Fast')
  const [cardAmount, setCardAmount]               = useState('')
  const [cardCode, setCardCode]                   = useState('')
  const [quantity, setQuantity]                   = useState(1)
  const [cardCodes, setCardCodes]                 = useState<string[]>([''])  // array of codes
  const codeRefs = useRef<(TextInput | null)[]>([])  // refs for auto-focus
  const [inputFocusIdx, setInputFocusIdx]         = useState(-1)
  const scrollRef = useRef<ScrollView>(null)
  const [cardImages, setCardImages]               = useState<string[]>([])
  const [uploadingImage, setUploadingImage]       = useState(false)
  const [scannerOpen, setScannerOpen]             = useState(false)
  const [appliedCoupon, setAppliedCoupon]         = useState<Coupon | null>(null)
  const [amountError, setAmountError]             = useState('')
  const [orderNo, setOrderNo]                     = useState('')
  const [imageViewerOpen, setImageViewerOpen]     = useState(false)
  const [imageViewerIdx, setImageViewerIdx]       = useState(0)
  const [imageGuideOpen, setImageGuideOpen]       = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  // Currency logos — fetched once and cached
  const [currencyLogoMap, setCurrencyLogoMap] = useState<Record<string, string | null>>({})
  useEffect(() => {
    fetchCurrencies().then(list => setCurrencyLogoMap(buildCurrencyLogoMap(list))).catch(() => {})
  }, [])

  // Photo sheet
  const [photoSheetOpen, setPhotoSheetOpen]       = useState(false)
  const pendingPick    = useRef<'gallery' | 'camera' | null>(null)
  const photoSheetAnim = useRef(new Animated.Value(0)).current

  function openPhotoSheet() {
    setPhotoSheetOpen(true)
    Animated.timing(photoSheetAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }

  function closePhotoSheet(action: 'gallery' | 'camera' | null) {
    pendingPick.current = action
    Animated.timing(photoSheetAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setPhotoSheetOpen(false)
    })
  }

  function onPhotoSheetDismiss() {
    if (pendingPick.current === 'gallery') { pendingPick.current = null; pickFromLibrary() }
    if (pendingPick.current === 'camera')  { pendingPick.current = null; pickFromCamera() }
  }

  // Modals
  const [cardModalOpen, setCardModalOpen]         = useState(false)
  const [countryModalOpen, setCountryModalOpen]   = useState(false)
  const [typeModalOpen, setTypeModalOpen]         = useState(false)
  const [cardSearch, setCardSearch]               = useState('')

  useEffect(() => {
    // Use cache (force=false) — HomeScreen already fetched these, no need to re-fetch
    fetchCardCategories(false, selectedCountry?.name || '').then(c => {
      setCards(c)
      // Auto-select card only if passed from HomeScreen / CardsScreen
      if (incomingCardId) {
        const found = c.find(card => card.id === incomingCardId)
        if (found) {
          selectCard(found)
          if (incomingCurrency)  setSelectedCurrency(incomingCurrency)
          if (incomingInputType) setSelectedInputType(incomingInputType)
          if (incomingMode === 'Fast' || incomingMode === 'Slow') setSelectedMode(incomingMode)
        }
      }
      if (incomingCouponId) {
        import('../api/coupon').then(({ fetchAllCoupons }) => {
          fetchAllCoupons().then(coupons => {
            const found = coupons.find(cp => cp.id === incomingCouponId)
            if (found && !found.expired) setAppliedCoupon(found)
          }).catch(() => {})
        })
      }
    }).finally(() => setLoading(false))
  }, [incomingCardId, incomingCouponId, selectedCountry?.name])

  function selectCard(card: CardCategory) {
    setSelectedCard(card)
    setSelectedCurrency('')
    setSelectedInputType('')
    setSelectedMode(card.defaultMode === 'slow' ? 'Slow' : 'Fast')
    setCardAmount('')
    setCardCode('')
    setCardCodes([''])
    setQuantity(1)
    setCardImages([])
    setAttempted(false)
    setAmountError('')
    const country = countries.find(c => c.name === card.country) || countries[0]
    Analytics.cardViewed({
      cardId:   card.id,
      cardName: card.name,
      country:  country?.name ?? 'Nigeria',
    })
  }

  // Called when user picks a type — validates existing amount against new type's rows
  function selectInputType(type: string, card?: CardCategory | null, currency?: string, mode?: 'Fast' | 'Slow') {
    const useCard     = card     ?? selectedCard
    const useCurrency = currency ?? selectedCurrency
    const useMode     = mode     ?? selectedMode

    setSelectedInputType(type)
    setTypeModalOpen(false)

    if (!useCard || !useCurrency || !cardAmount) return

    const config = useCard.rateConfigs?.find(r => r.currency === useCurrency)
    const rows = (config?.rows || []).filter(row => {
      if (row.mode !== useMode) return false
      if (row.inputTypes?.length && !row.inputTypes.includes('All') && !row.inputTypes.includes(type)) return false
      return true
    })

    if (rows.length === 0) return

    const n = parseFloat(cardAmount) || 0
    const stillValid = rows.some(row => {
      if (row.rangeType === 'range') {
        return n >= (parseFloat(row.min) || 0) && n <= (parseFloat(row.max) || 999999)
      } else if (row.rangeType === 'multiple') {
        const base = parseFloat(row.base) || 1
        return n >= (parseFloat(row.min) || 0) && n <= (parseFloat(row.max) || 999999) && n % base === 0
      } else if (row.rangeType === 'fixed') {
        return n === parseFloat(row.value)
      }
      return true
    })

    if (!stillValid) {
      // Amount is out of range for this type — clear it
      setCardAmount('')
      setAmountError('')
    }
  }

  // Sync cardCodes array length with quantity
  useEffect(() => {
    setCardCodes(prev => {
      if (prev.length === quantity) return prev
      if (prev.length < quantity) return [...prev, ...Array(quantity - prev.length).fill('')]
      return prev.slice(0, quantity)
    })
    codeRefs.current = codeRefs.current.slice(0, quantity)
  }, [quantity])

  // Get the applicable rate config for selected currency
  const amountNum  = parseFloat(cardAmount) || 0
  const rateConfig = selectedCard?.rateConfigs?.find(r => r.currency === selectedCurrency)

  // Find ALL rows matching mode + input type (ignoring amount) for preview
  const matchingRows = (rateConfig?.rows || []).filter(row => {
    if (row.mode !== selectedMode) return false
    if (row.inputTypes?.length && !row.inputTypes.includes('All') && !row.inputTypes.includes(selectedInputType)) {
      return false
    }
    return true
  })

  // Find the specific row that matches the entered amount (for actual calculation)
  const applicableRow = matchingRows.find(row => {
    if (row.rangeType === 'range') {
      const min = parseFloat(row.min) || 0
      const max = parseFloat(row.max) || 999999
      return amountNum >= min && amountNum <= max
    } else if (row.rangeType === 'multiple') {
      const base = parseFloat(row.base) || 1
      const min  = parseFloat(row.min)  || 0
      const max  = parseFloat(row.max)  || 999999
      return amountNum >= min && amountNum <= max && amountNum % base === 0
    } else if (row.rangeType === 'fixed') {
      return amountNum === parseFloat(row.value)
    }
    return true
  })

  // Preview row — first matching row regardless of amount (for rate display before amount is entered)
  const previewRow = applicableRow || matchingRows[0] || null

  // Rate lookup: use applicable row if amount matches, otherwise use preview row for display
  const activeRow = applicableRow || previewRow
  const rowRate = activeRow?.rates?.[selectedInputType] || activeRow?.rates?.['All'] || ''
  const effectiveRate = rowRate ? parseFloat(rowRate) : (selectedCard?.rate ?? 0)

  // Use globally selected country (from header switcher) as the rate country.
  // Falls back to the card's own country, then first in list.
  const cardCountry = selectedCountry
    ?? countries.find(c => c.name === selectedCard?.country)
    ?? countries[0]
    ?? null

  const currencySymbol = cardCountry?.currencySymbol ?? '₦'
  // Apply rate mode: multiply (Nigeria) or divide (Ghana)
  const todayRate = cardCountry?.todayRate ?? 1
  const cardRate  = cardCountry?.rateMode === 'divide'
    ? (todayRate > 0 ? effectiveRate / todayRate : effectiveRate)
    : effectiveRate * todayRate
  // Only calculate settlement when amount is actually entered and a row matches
  const salesPrice     = amountNum > 0 && applicableRow ? amountNum * cardRate * quantity : 0
  const vipBonus       = 0
  const couponDiscount = appliedCoupon
    ? (appliedCoupon.discountType === 'fixed'
        ? appliedCoupon.discountValue
        : (salesPrice * appliedCoupon.discountValue) / 100)
    : 0
  const settlement     = salesPrice + vipBonus + couponDiscount

  // Derive limits from the applicable row only (for validation display)
  const rowLimits = applicableRow ? (() => {
    if (applicableRow.rangeType === 'fixed') {
      const v = parseFloat(applicableRow.value) || 0
      return { min: v, max: v, base: 0 }
    }
    return {
      min:  parseFloat(applicableRow.min)  || 0,
      max:  parseFloat(applicableRow.max)  || 999999,
      base: applicableRow.rangeType === 'multiple' ? (parseFloat(applicableRow.base) || 1) : 0,
    }
  })() : null

  // Build amount placeholder from matching rows for selected type
  const amountPlaceholder = (() => {
    if (!selectedInputType || matchingRows.length === 0) return 'Enter card amount'
    // Collect all valid ranges/values
    const parts = matchingRows.map((row: any) => {
      if (row.rangeType === 'fixed')    return `$${row.value}`
      if (row.rangeType === 'multiple') return `$${row.min}–$${row.max} (×${row.base})`
      return `$${row.min}–$${row.max}`
    })
    return `Amount: ${parts.join(' or ')}`
  })()

  function handleAmountChange(v: string) {
    setCardAmount(v)
    const n = parseFloat(v) || 0
    if (n === 0) { setAmountError(''); return }

    // Find which row this amount falls into
    const matchedRow = matchingRows.find(row => {
      if (row.rangeType === 'range') {
        const min = parseFloat(row.min) || 0
        const max = parseFloat(row.max) || 999999
        return n >= min && n <= max
      } else if (row.rangeType === 'multiple') {
        const base = parseFloat(row.base) || 1
        const min  = parseFloat(row.min)  || 0
        const max  = parseFloat(row.max)  || 999999
        return n >= min && n <= max && n % base === 0
      } else if (row.rangeType === 'fixed') {
        return n === parseFloat(row.value)
      }
      return true
    })

    if (!matchedRow && matchingRows.length > 0) {
      // Amount doesn't match any row — show what's available
      const ranges = matchingRows.map((row: any) => {
        if (row.rangeType === 'fixed')    return `$${row.value}`
        if (row.rangeType === 'multiple') return `$${row.min}–$${row.max} (×${row.base})`
        return `$${row.min}–$${row.max}`
      }).join(', ')
      setAmountError(`Amount doesn't match any rate. Available: ${ranges}`)
    } else if (matchedRow?.rangeType === 'multiple') {
      const base = parseFloat(matchedRow.base) || 1
      const n2 = parseFloat(v) || 0
      if (n2 % base !== 0) {
        setAmountError(`Must be a multiple of ${base}`)
      } else {
        setAmountError('')
      }
    } else {
      setAmountError('')
    }
  }

  // For Code type: ALL slots must be filled
  const allCodesFilled = selectedInputType === 'Code'
    ? cardCodes.every(c => c.trim().length > 0)
    : true

  const canSubmit = Boolean(
    selectedCard &&
    selectedInputType &&
    amountNum > 0 &&
    !submitting &&
    (selectedInputType === 'Code'
      ? allCodesFilled                    // all codes filled
      : cardImages.length > 0)            // at least one image
  )

  // Progress indicator
  const codesFilledCount = cardCodes.filter(c => c.trim().length > 0).length
  const allFilled = codesFilledCount === quantity

  async function handleOpenScanner() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission()
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow camera access to scan card codes.')
        return
      }
    }
    setScannerOpen(true)
  }

  function handleBarCodeScanned({ data }: { data: string }) {
    setScannerOpen(false)
    // Fix: write to the correct state depending on input type
    if (selectedInputType === 'Code') {
      // Fill the first empty slot in the codes array
      setCardCodes(prev => {
        const next = [...prev]
        const emptyIdx = next.findIndex(c => !c.trim())
        if (emptyIdx >= 0) next[emptyIdx] = data
        return next
      })
    } else {
      setCardCode(prev => prev ? `${prev}\n${data}` : data)
    }
  }

  async function pickFromLibrary() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
        base64: false,
        exif: false,
      })
      if (result.canceled || result.assets.length === 0) return
      await uploadImageAsset(result.assets[0])
    } catch {
      setUploadingImage(false)
      Alert.alert('Error', 'Failed to pick image. Please try again.')
    }
  }

  async function pickFromCamera() {
    try {
      if (!cameraPermission?.granted) {
        const { granted } = await requestCameraPermission()
        if (!granted) { Alert.alert('Permission needed', 'Please allow camera access.'); return }
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, quality: 0.8,
      })
      if (result.canceled || result.assets.length === 0) return
      await uploadImageAsset(result.assets[0])
    } catch {
      setUploadingImage(false)
      Alert.alert('Error', 'Failed to capture image. Please try again.')
    }
  }

  async function uploadImageAsset(asset: ImagePicker.ImagePickerAsset) {
    const localUri = asset.uri
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: localUri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `card_${Date.now()}.jpg`,
      } as any)
      const uploadRes = await client.post('/common/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const serverUrl = uploadRes.data?.url || uploadRes.data?.data?.url || uploadRes.data?.fileName
      if (serverUrl) {
        // Rewrite any localhost/127.0.0.1 references to the actual BASE_URL
        const resolvedUrl = serverUrl
          .replace(/https?:\/\/localhost:\d+/, BASE_URL)
          .replace(/https?:\/\/127\.0\.0\.1:\d+/, BASE_URL)
        // Only add to state AFTER server confirms — never keep broken local URIs
        setCardImages(prev => [...prev, resolvedUrl])
      } else {
        Alert.alert('Upload Failed', 'Image could not be uploaded. Please try again.')
      }
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload image. Check your connection and try again.')
    }
    setUploadingImage(false)
  }

  function openCouponPicker() {
    setCouponPickerOpen(true)
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedCard) return
    setSubmitting(true)
    try {
      const res = await client.post('/tuka/order/submit', {
        categoryId:   selectedCard.id,
        categoryName: selectedCard.name,
        country:      cardCountry?.name ?? selectedCountry?.name ?? 'Nigeria',
        cardCurrency: selectedCurrency,
        inputType:    selectedInputType,
        cardAmount:   amountNum,
        quantity:     quantity,
        rate:         cardRate,
        countryRate:  cardCountry?.todayRate ?? 1,
        cardCode:     cardCodes.filter(c => c.trim()).join('\n'),
        cardImage:    cardImages.join(','),
        couponCode:   appliedCoupon?.code || null,
        couponDiscount: couponDiscount || null,
      })
      // Backend returns AjaxResult.success(orderNo) → res.data.data = orderNo
      const no = res.data?.data || res.data?.msg || `TK${Date.now()}`
      setOrderNo(String(no))
      // Analytics — trade submitted (maps to Purchase on Facebook/TikTok/Google)
      Analytics.tradeSubmitted({
        orderId:  String(no),
        cardId:   selectedCard.id,
        cardName: selectedCard.name,
        amount:   amountNum,
        payout:   settlement,
        currency: cardCountry?.currencyName ?? selectedCountry?.currencyName ?? 'NGN',
        country:  cardCountry?.name ?? selectedCountry?.name ?? 'Nigeria',
        mode:     selectedMode,
      })
      // Ad network purchase conversion
      trackAdEvent('Purchase', {
        value:    settlement,
        currency: cardCountry?.currencyName ?? selectedCountry?.currencyName ?? 'NGN',
        orderId:  String(no),
      })
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message || 'Failed to submit order. Please try again.')
    } finally { setSubmitting(false) }
  }

  const filteredCards = cards.filter(c =>
    c.name.toLowerCase().includes(cardSearch.toLowerCase())
  )

  // Pulse animation for success screen — always declared at top level
  const pulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!orderNo) return
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [orderNo])

  // ── Success screen ────────────────────────────────────────────────────────
  if (orderNo) {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return (
      <View style={[s.safe, { backgroundColor: '#F8F9FA' }, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ── Check icon with sparkles ── */}
          <View style={ss.successTop}>
            <View style={[ss.spark, { top: 10, left: '30%' }]} />
            <View style={[ss.spark, { top: 20, right: '28%', width: 6, height: 6 }]} />
            <View style={[ss.spark, { top: 50, left: '22%', width: 5, height: 5 }]} />
            <View style={[ss.spark, { top: 55, right: '20%', width: 4, height: 4 }]} />

            <Animated.View style={[ss.checkRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={ss.checkCircle}>
                <Feather name="check" size={28} color="#fff" />
              </View>
            </Animated.View>

            {/* Processing label removed */}
          </View>

          {/* ── Title ── */}
          <Text style={ss.successTitle}>Order Submitted!</Text>
          <Text style={ss.successSub}>
            Your gift card is under review.{'\n'}You'll receive payment once verified.
          </Text>

          {/* ── Receipt card ── */}
          <View style={ss.receiptCard}>
            {[
              { label: 'Order ID',    value: orderNo },
              { label: 'Card',        value: selectedCard?.name || '—' },
              { label: 'Amount',      value: `${currSym(selectedCurrency)}${amountNum.toFixed(2)} × ${quantity}` },
              { label: 'Rate',        value: `${fmt(cardRate, currencySymbol)} / ${currSym(selectedCurrency)}1` },
              { label: 'Sales Price', value: fmt(salesPrice, currencySymbol) },
              ...(couponDiscount ? [{ label: 'Coupon Discount', value: `+${fmt(couponDiscount, currencySymbol)}`, bold: false }] : []),
              { label: 'Settlement',  value: fmt(settlement, currencySymbol), bold: true },
              { label: 'Type',        value: selectedInputType || '—' },
              { label: 'Speed',       value: selectedMode },
              { label: 'Quantity',    value: String(quantity) },
              { label: 'Date & Time', value: `${dateStr} | ${timeStr}` },
              { label: 'Status',      value: 'Pending Review', status: true },
            ].map((item, i, arr) => (
              <View key={item.label}>
                <View style={ss.receiptRow}>
                  <Text style={ss.receiptLabel}>{item.label}</Text>
                  <Text style={[
                    ss.receiptValue,
                    item.bold && { color: colors.primary, fontWeight: typography.weight.extrabold, fontSize: ms(typography.size.lg) },
                    item.status && { color: colors.warning },
                  ]}>{item.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={ss.receiptDivider} />}
              </View>
            ))}
          </View>

        </ScrollView>

        {/* ── Bottom buttons ── */}
        <View style={[ss.bottomBtns, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity style={ss.homeBtn}
            onPress={() => {
              const orderObj = {
                orderNo,
                categoryName: selectedCard?.name || '',
                categoryIcon: selectedCard?.icon || null,
                cardCurrency: selectedCurrency,
                inputType: selectedInputType,
                speed: selectedMode,
                cardAmount: amountNum,
                quantity: quantity,
                rate: cardRate,
                localAmount: salesPrice,
                couponDiscount: couponDiscount || 0,
                cardCode: cardCodes.filter(c => c.trim()).join('\n'),
                cardImage: cardImages.join(','),
                status: 'pending',
                createTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
              }
              props.navigation.navigate('OrderDetail' as any, { order: JSON.stringify(orderObj) })
            }}
            activeOpacity={0.85}>
            <Feather name="map-pin" size={16} color="#fff" style={{ marginRight: spacing[2] }} />
            <Text style={ss.homeBtnTxt}>Check Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!user.isPresent()) {
    return (
      <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sell Gift Cards</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.guestWrap}>
          <View style={s.guestIcon}>
            <Feather name="credit-card" size={40} color={colors.primary} />
          </View>
          <Text style={s.guestTitle}>Sign in to sell gift cards</Text>
          <Text style={s.guestSub}>Get the best rates, paid instantly</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => props.navigation.navigate('Login')}>
            <Text style={s.loginBtnTxt}>Log In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sell Gift Cards</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.loadingBox}>
          <Spinner size="large" />
        </View>
      </View>
    )
  }

  const imgUrl = resolveImageUrl(selectedCard?.icon ?? null)


  return (
    <>
    <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn}>
            <Feather name="chevron-left" size={26} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sell Gift Cards</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: 40 }}>

          <View style={s.form}>

            {/* Settlement amount — inline, no card */}
            <View style={s.settlementWrap}>
              <Text style={s.settlementLabel}>Settlement Amount</Text>
              <Text style={s.settlementAmt}>{fmt(settlement, currencySymbol)}</Text>
            </View>

            {/* Row 1: Category + Country side by side */}
            <View style={s.rowTwo}>
              {/* Category */}
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Category</Text>
                <TouchableOpacity style={s.rowDropdown} onPress={() => setCardModalOpen(true)} activeOpacity={0.8}>
                  {selectedCard && imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={s.rowDropdownImg} resizeMode="cover" />
                  ) : selectedCard ? (
                    <View style={[s.rowDropdownImg, { backgroundColor: CARD_BG[0], alignItems: 'center', justifyContent: 'center' }]}>
                      <Feather name="credit-card" size={16} color={colors.muted} />
                    </View>
                  ) : null}
                  <Text style={[selectedCard ? s.rowDropdownVal : s.rowDropdownPlaceholder, { flex: 1 }]} numberOfLines={1}>
                    {selectedCard?.name || 'Category'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Country */}
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Country</Text>
                <TouchableOpacity style={s.rowDropdown} onPress={() => setCountryModalOpen(true)} activeOpacity={0.8}>
                  {selectedCurrency && currencyLogoMap[selectedCurrency] ? (
                    <Image
                      source={{ uri: currencyLogoMap[selectedCurrency]! }}
                      style={s.rowDropdownImg}
                      resizeMode="cover"
                    />
                  ) : selectedCurrency ? (
                    <View style={[s.rowDropdownImg, { backgroundColor: CARD_BG[1], alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: ms(10), fontWeight: '700', color: colors.muted }}>{selectedCurrency.slice(0, 2)}</Text>
                    </View>
                  ) : null}
                  <Text style={[selectedCurrency ? s.rowDropdownVal : s.rowDropdownPlaceholder, { flex: 1 }]} numberOfLines={1}>
                    {selectedCurrency || 'Country'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Amount */}
            <View style={s.balanceField}>
              <TextInput
                style={s.balanceInput}
                placeholder={amountPlaceholder}
                placeholderTextColor={colors.subtle}
                keyboardType="decimal-pad"
                value={cardAmount}
                onChangeText={handleAmountChange}
              />
            </View>

            {/* Show matched row rate when amount is entered */}
            {applicableRow && amountNum > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: -spacing[2], marginBottom: spacing[3] }}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <Text style={{ fontSize: typography.size.sm, color: colors.success, fontWeight: typography.weight.semibold }}>
                  Rate: {currencySymbol}{cardRate.toLocaleString('en-NG', { minimumFractionDigits: 2 })} per {selectedCurrency || '$'}1
                </Text>
              </View>
            )}

            {!!amountError && (
              <Text style={{ fontSize: typography.size.sm, color: colors.error, marginTop: -spacing[2], marginBottom: spacing[3], paddingHorizontal: spacing[1] }}>
                {amountError}
              </Text>
            )}

            {/* Payout preview removed */}

            {/* 4. Speed */}
            <View style={s.speedField}>
              <Text style={s.speedLabel}>Speed</Text>
              <View style={s.speedToggle}>
                {(['Fast', 'Slow'] as const).map(m => (
                  <TouchableOpacity key={m}
                    style={[s.speedBtn, selectedMode === m && s.speedBtnOn]}
                    onPress={() => setSelectedMode(m)} activeOpacity={0.8}>
                    <Text style={[s.speedBtnTxt, selectedMode === m && s.speedBtnTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4b. Quantity — new field */}
            <View style={s.quantityField}>
              <Text style={s.quantityLabel}>Quantity</Text>
              <View style={s.quantityRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))} activeOpacity={0.7}>
                  <Feather name="minus" size={16} color={colors.dark} />
                </TouchableOpacity>
                <Text style={s.qtyValue}>{quantity}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.min(10, q + 1))} activeOpacity={0.7}>
                  <Feather name="plus" size={16} color={colors.dark} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 5. Card Type — dropdown, no label above */}
            {(selectedCard?.inputTypes?.length ?? 0) > 0 && (
              <TouchableOpacity style={s.fullDropdown} onPress={() => setTypeModalOpen(true)} activeOpacity={0.8}>
                <Text style={selectedInputType ? s.fullDropdownVal : s.fullDropdownPlaceholder}>
                  {selectedInputType || 'Type'}
                </Text>
                <Feather name="chevron-down" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}

            {/* 7. Upload Photo — show for all types except Code */}
            {selectedInputType && selectedInputType !== 'Code' && (
              <>
                <Text style={s.sectionLabel}>Upload card image</Text>
                <View style={s.imagesRow}>
                  {cardImages.map((uri, idx) => (
                    <TouchableOpacity key={uri} style={s.imageThumbnailWrap}
                      onPress={() => { setImageViewerIdx(idx); setImageViewerOpen(true) }}
                      activeOpacity={0.9}>
                      <Image
                        source={{ uri }}
                        style={{ width: 64, height: 64, borderRadius: radius.md }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={s.imageThumbnailRemove}
                        onPress={() => setCardImages(prev => prev.filter((_, i) => i !== idx))}>
                        <Feather name="x" size={10} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {/* Add button */}
                  <TouchableOpacity style={s.imageAddBtn} onPress={openPhotoSheet} activeOpacity={0.8}>
                    {uploadingImage ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <>
                        <Feather name="camera" size={18} color={colors.muted} />
                        <Text style={s.imageAddTxt}>Add</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Inline error — only after submit attempt */}
                {attempted && cardImages.length === 0 && (
                  <View style={s.inlineError}>
                    <Feather name="alert-circle" size={13} color={colors.error} />
                    <Text style={s.inlineErrorTxt}>Upload at least 1 image to continue</Text>
                  </View>
                )}

                <TouchableOpacity onPress={() => setImageGuideOpen(true)} activeOpacity={0.7}>
                  <Text style={s.uploadHelpTxt}>Need help? View sample images.</Text>
                </TouchableOpacity>
              </>
            )}

            {/* 6. Code input — multiple inputs for Code type */}
            {selectedInputType === 'Code' && (
              <View style={s.codesSection}>
                <View style={s.codesSectionHeader}>
                  <Text style={s.codesSectionTitle}>Card Codes</Text>
                  <View style={s.codesProgress}>
                    <Text style={[s.codesSectionSub, allFilled && { color: colors.success }]}>
                      {codesFilledCount}/{quantity} filled
                    </Text>
                    {allFilled && <Feather name="check-circle" size={14} color={colors.success} style={{ marginLeft: 4 }} />}
                  </View>
                </View>

                {cardCodes.map((code, idx) => (
                  <View key={idx} style={s.codeInputRow}>
                    <View style={[s.codeInputWrap, code.trim().length > 0 && s.codeInputWrapFilled, inputFocusIdx === idx && s.codeInputWrapFocused]}>
                      <View style={[s.codeInputNumWrap, code.trim().length > 0 && s.codeInputNumWrapFilled]}>
                        <Text style={[s.codeInputNum, code.trim().length > 0 && s.codeInputNumFilled]}>{idx + 1}</Text>
                      </View>
                      <TextInput
                        ref={el => { codeRefs.current[idx] = el }}
                        style={s.codeInput}
                        placeholder={`Code ${idx + 1}`}
                        placeholderTextColor={colors.subtle}
                        value={code}
                        onChangeText={v => {
                          const next = [...cardCodes]
                          next[idx] = v
                          setCardCodes(next)
                        }}
                        maxLength={30}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        spellCheck={false}
                        returnKeyType={idx < cardCodes.length - 1 ? 'next' : 'done'}
                        onFocus={() => setInputFocusIdx(idx)}
                        onBlur={() => setInputFocusIdx(-1)}
                        onSubmitEditing={() => {
                          if (idx < cardCodes.length - 1) {
                            codeRefs.current[idx + 1]?.focus()
                          }
                        }}
                        blurOnSubmit={idx === cardCodes.length - 1}
                      />
                      {code.length > 0 && (
                        <TouchableOpacity onPress={() => {
                          const next = [...cardCodes]; next[idx] = ''; setCardCodes(next)
                        }} style={s.codeClearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="x-circle" size={16} color={colors.muted} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={[s.codeCharCount, code.length >= 28 && { color: colors.warning }]}>{code.length}/30</Text>
                  </View>
                ))}

                {attempted && cardCodes.every(c => !c.trim()) && (
                  <View style={s.inlineError}>
                    <Feather name="alert-circle" size={13} color={colors.error} />
                    <Text style={s.inlineErrorTxt}>Enter at least one card code to continue</Text>
                  </View>
                )}
              </View>
            )}

            {/* Optional code for non-Code types that also accept code */}
            {selectedInputType && selectedInputType !== 'Code' && (
              <View style={[s.balanceField, { minHeight: 80, height: 'auto', paddingVertical: spacing[3] }]}>
                <TextInput
                  style={[s.balanceInput, { fontSize: typography.size.base, minHeight: 52, textAlignVertical: 'top', paddingRight: spacing[10] }]}
                  placeholder="Optional: enter card code"
                  placeholderTextColor={colors.subtle}
                  multiline
                  maxLength={200}
                  value={cardCode}
                  onChangeText={setCardCode}
                  returnKeyType="default"
                />
                <TouchableOpacity
                  style={s.scanIconBtn}
                  onPress={handleOpenScanner}
                  activeOpacity={0.7}>
                  <Feather name="maximize" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={s.charCount}>{cardCode.length}/200</Text>
              </View>
            )}

          </View>
        </ScrollView>

        {/* ── Bottom bar: Sell button ── */}
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[4] }]}>
          {/* Show progress hint when Code type and not all filled */}
          {selectedInputType === 'Code' && !allFilled && codesFilledCount > 0 && (
            <View style={s.sellHint}>
              <Feather name="info" size={13} color={colors.warning} />
              <Text style={s.sellHintTxt}>Fill all {quantity} codes to continue ({codesFilledCount}/{quantity})</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.sellBtn, !canSubmit && s.sellBtnOff]}
            onPress={() => { setAttempted(true); if (canSubmit) setConfirmOpen(true) }}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.sellBtnTxt, !canSubmit && s.sellBtnTxtOff]}>
                  {selectedInputType === 'Code' && !allFilled && codesFilledCount === 0
                    ? 'Enter codes to sell'
                    : selectedInputType === 'Code' && !allFilled
                    ? `${codesFilledCount}/${quantity} codes filled`
                    : 'Sell'}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Confirm Trade Modal — redesigned ── */}
      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
            {/* Header */}
            <View style={cm.header}>
              <Text style={cm.title}>Confirm Trade</Text>
              <TouchableOpacity onPress={() => setConfirmOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Settlement amount — hero */}
            <View style={cm.amtWrap}>
              <Text style={cm.amtLabel}>You will receive</Text>
              <Text style={cm.amt}>{fmt(settlement, currencySymbol)}</Text>
              {couponDiscount > 0 && (
                <View style={cm.couponBadge}>
                  <Feather name="tag" size={12} color={colors.success} />
                  <Text style={cm.couponBadgeTxt}>+{fmt(couponDiscount, currencySymbol)} coupon applied</Text>
                </View>
              )}
            </View>

            {/* Details grid */}
            <View style={cm.rows}>
              {[
                { label: 'Category',         value: selectedCard?.name || '—' },
                { label: 'Sales Price',       value: fmt(salesPrice, currencySymbol) },
                { label: 'Settlement Amount', value: fmt(settlement, currencySymbol), green: true },
              ].map((item, i, arr) => (
                <View key={item.label} style={[cm.row, i < arr.length - 1 && cm.rowBorder]}>
                  <Text style={cm.rowLbl}>{item.label}</Text>
                  <Text style={[cm.rowVal, (item as any).green && cm.rowValGreen]}>{item.value}</Text>
                </View>
              ))}

              {/* Coupon row */}
              <TouchableOpacity
                style={[cm.row, cm.couponRow]}
                onPress={() => {
                  // Close confirm modal first, then open coupon picker
                  // On confirm, we'll reopen confirm modal
                  setReturnToConfirm(true)
                  setConfirmOpen(false)
                  setTimeout(() => setCouponPickerOpen(true), 320)
                }}
                activeOpacity={0.8}
              >
                <View style={cm.couponIcon}>
                  <Feather name="tag" size={14} color={colors.accent} />
                </View>
                <Text style={cm.couponLbl}>Coupon</Text>
                <Text style={cm.couponVal}>
                  {appliedCoupon
                    ? `+${fmt(couponDiscount, currencySymbol)} applied`
                    : 'Select coupon'
                  }
                </Text>
                <Feather name="chevron-right" size={16} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Submit button — full width black pill */}
            <TouchableOpacity
              style={[cm.submitBtn, submitting && { opacity: 0.7 }]}
              disabled={submitting}
              onPress={async () => { setConfirmOpen(false); await handleSubmit() }}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={cm.submitTxt}>Submit</Text>
              }
            </TouchableOpacity>
        </View>

      </BottomSheet>

      {/* ── Coupon Picker Modal — separate full modal ── */}
      <Modal
        visible={couponPickerOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => {
          setCouponPickerOpen(false)
          if (returnToConfirm) {
            setReturnToConfirm(false)
            setTimeout(() => setConfirmOpen(true), 320)
          }
        }}
      >
        <CouponPicker
          visible={couponPickerOpen}
          salesPrice={salesPrice}
          selectedCoupon={appliedCoupon}
          currencySymbol={currencySymbol}
          country={cardCountry?.name || selectedCountry?.name}
          onConfirm={(coupon) => {
            setAppliedCoupon(coupon)
            setCouponPickerOpen(false)
            if (returnToConfirm) {
              setReturnToConfirm(false)
              setTimeout(() => setConfirmOpen(true), 320)
            }
          }}
          onClose={() => {
            setCouponPickerOpen(false)
            if (returnToConfirm) {
              setReturnToConfirm(false)
              setTimeout(() => setConfirmOpen(true), 320)
            }
          }}
        />
      </Modal>

      {/* ── Card Picker Modal ── */}
      <Modal visible={cardModalOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCardModalOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Category</Text>
              <TouchableOpacity onPress={() => setCardModalOpen(false)}>
                <Feather name="x" size={22} color={colors.dark} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchBox}>
              <Feather name="search" size={18} color={colors.muted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search Gift Card"
                placeholderTextColor={colors.subtle}
                value={cardSearch}
                onChangeText={setCardSearch}
              />
            </View>

            {/* Card list */}
            <FlatList
              data={filteredCards}
              keyExtractor={c => String(c.id)}
              renderItem={({ item, index }) => {
                const imgUrl = resolveImageUrl(item.icon)
                const bg = CARD_BG[index % CARD_BG.length]
                return (
                  <TouchableOpacity style={s.cardItem}
                    onPress={() => { selectCard(item); setCardModalOpen(false); setCardSearch('') }}>
                    <View style={[s.cardItemIcon, { backgroundColor: bg }]}>
                      {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={s.cardItemImg} resizeMode="cover" />
                      ) : (
                        <Feather name="credit-card" size={22} color={colors.muted} />
                      )}
                    </View>
                    <Text style={s.cardItemName}>{item.name}</Text>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Country Modal — 3-column grid ── */}
      <Modal visible={countryModalOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCountryModalOpen(false)} />
          <View style={[s.sheet, { height: '50%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Country</Text>
              <TouchableOpacity onPress={() => setCountryModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
              <View style={s.gridThree}>
                {(selectedCard?.currencies || []).map(code => (
                  <TouchableOpacity key={code}
                    style={[s.gridItem, selectedCurrency === code && s.gridItemOn]}
                    onPress={() => { setSelectedCurrency(code); setCountryModalOpen(false) }}
                    activeOpacity={0.8}>
                    {currencyLogoMap[code] ? (
                      <Image
                        source={{ uri: currencyLogoMap[code]! }}
                        style={{ width: ms(28), height: ms(28), borderRadius: ms(6), marginBottom: spacing[1] }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: ms(28), height: ms(28), borderRadius: ms(6), backgroundColor: CARD_BG[1], alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] }}>
                        <Text style={{ fontSize: ms(10), fontWeight: '700', color: colors.muted }}>{code.slice(0, 2)}</Text>
                      </View>
                    )}
                    <Text style={[s.gridItemTxt, selectedCurrency === code && s.gridItemTxtOn]}>
                      {code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Type Modal — 3-column grid ── */}
      <Modal visible={typeModalOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setTypeModalOpen(false)} />
          <View style={[s.sheet, { height: '50%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Type</Text>
              <TouchableOpacity onPress={() => setTypeModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
              <View style={s.gridThree}>
                {(selectedCard?.inputTypes || []).map(t => (
                  <TouchableOpacity key={t}
                    style={[s.gridItem, selectedInputType === t && s.gridItemOn]}
                    onPress={() => { selectInputType(t) }}
                    activeOpacity={0.8}>
                    <Text style={[s.gridItemTxt, selectedInputType === t && s.gridItemTxtOn]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Image Upload Guide Modal ── */}
      <Modal visible={imageGuideOpen} transparent animationType="fade" statusBarTranslucent>
        <View style={[s.overlay, { justifyContent: 'center', paddingHorizontal: spacing[5] }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setImageGuideOpen(false)} />
          <View style={ig.card}>
            <Text style={ig.title}>Image Upload Guide</Text>

            {/* YES example */}
            <View style={ig.yesBox}>
              <View style={ig.yesImg}>
                <Feather name="credit-card" size={32} color={colors.primary} />
              </View>
              <Text style={ig.yesLabel}>Yes</Text>
              <View style={ig.yesCheck}>
                <Feather name="check" size={12} color="#fff" />
              </View>
            </View>
            <Text style={ig.yesCaption}>Correct, complete, and clear</Text>

            {/* NO examples grid */}
            <View style={ig.noGrid}>
              {[
                { label: 'Does not match\nthe type of card ordered' },
                { label: 'Incomplete' },
                { label: 'Blurred' },
                { label: 'Stack' },
              ].map((item, i) => (
                <View key={i} style={ig.noItem}>
                  <View style={ig.noImg}>
                    <Feather name="image" size={24} color={colors.muted} />
                  </View>
                  <Text style={ig.noLabel}>No</Text>
                  <View style={ig.noCross}>
                    <Feather name="x" size={10} color="#fff" />
                  </View>
                  <Text style={ig.noCaption}>{item.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={ig.closeBtn} onPress={() => setImageGuideOpen(false)} activeOpacity={0.8}>
              <Text style={ig.closeBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Photo picker bottom sheet ── */}
      <Modal
        visible={photoSheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onDismiss={onPhotoSheetDismiss}
      >
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: photoSheetAnim }}>
          <TouchableOpacity style={ph.overlay} activeOpacity={1} onPress={() => closePhotoSheet(null)} />
          <Animated.View style={[ph.sheet, {
            position: 'absolute', bottom: 0, left: 0, right: 0,
            transform: [{ translateY: photoSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }]
          }]}>
            <View style={ph.handle} />
            <Text style={ph.title}>Upload Photo</Text>
            <TouchableOpacity style={ph.row} activeOpacity={0.7} onPress={() => closePhotoSheet('gallery')}>
              <View style={ph.iconWrap}><Feather name="image" size={20} color={colors.dark} /></View>
              <Text style={ph.rowTxt}>Upload from Gallery</Text>
            </TouchableOpacity>
            <View style={ph.divider} />
            <TouchableOpacity style={ph.row} activeOpacity={0.7} onPress={() => closePhotoSheet('camera')}>
              <View style={ph.iconWrap}><Feather name="camera" size={20} color={colors.dark} /></View>
              <Text style={ph.rowTxt}>Capture with Camera</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Barcode Scanner Modal ── */}
      <Modal visible={scannerOpen} animationType="slide">
        <View style={s.scannerWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          {/* Overlay frame */}
          <View style={s.scannerOverlay}>
            <View style={s.scannerFrame} />
            <Text style={s.scannerHint}>Point camera at the gift card code</Text>
          </View>
          {/* Close button */}
          <TouchableOpacity style={s.scannerClose} onPress={() => setScannerOpen(false)}>
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Image Viewer Modal — fullScreen so it renders above summary modal ── */}
      <Modal visible={imageViewerOpen} transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 56, right: spacing[5], zIndex: 10 }}
            onPress={() => setImageViewerOpen(false)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="x" size={22} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Full-screen image */}
          {cardImages[imageViewerIdx] ? (
            <Image
              source={{ uri: cardImages[imageViewerIdx] }}
              style={{ width: W, height: W * 1.3, maxHeight: '80%' as any }}
              resizeMode="contain"
            />
          ) : null}

          {/* Navigation arrows + counter */}
          {cardImages.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6], marginTop: spacing[6] }}>
              <TouchableOpacity
                onPress={() => setImageViewerIdx(i => Math.max(0, i - 1))}
                disabled={imageViewerIdx === 0}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="chevron-left" size={26} color={imageViewerIdx === 0 ? 'rgba(255,255,255,0.25)' : '#fff'} />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: typography.size.lg, fontWeight: typography.weight.semibold }}>
                {imageViewerIdx + 1} / {cardImages.length}
              </Text>
              <TouchableOpacity
                onPress={() => setImageViewerIdx(i => Math.min(cardImages.length - 1, i + 1))}
                disabled={imageViewerIdx === cardImages.length - 1}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="chevron-right" size={26} color={imageViewerIdx === cardImages.length - 1 ? 'rgba(255,255,255,0.25)' : '#fff'} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

    </>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3],
    backgroundColor: colors.background,
  },
  headerTitle: {
    flex: 1, fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold, color: colors.dark, textAlign: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Green gradient summary — sticky, outside ScrollView
  summaryCard: {
    marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[1],
    borderRadius: radius.lg, padding: spacing[3],
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  summaryInner: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.md,
    paddingVertical: spacing[3], alignItems: 'center', marginBottom: 0,
  },
  summaryBig:   { fontSize: RF(28), fontWeight: typography.weight.extrabold, color: colors.dark, letterSpacing: -0.5 },
  summaryLabel: { fontSize: typography.size.lg, color: colors.primary, fontWeight: typography.weight.extrabold, marginTop: 1 },
  summaryGradRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  summaryVal:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primaryText },
  summaryLbl:   { fontSize: RF(10), color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  // Form
  form: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },

  rowTwo: {
    flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3],
  },
  rowLabel: {
    fontSize: typography.size.lg, color: colors.dark,
    marginBottom: spacing[1] + 2, fontWeight: typography.weight.extrabold,
  },
  rowDropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], height: 52,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing[2],
  },
  rowDropdownVal:         { fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold, flex: 1 },
  rowDropdownPlaceholder: { fontSize: typography.size.lg, color: colors.subtle, flex: 1 },
  rowDropdownImg: {
    width: 30, height: 30, borderRadius: 15,
    overflow: 'hidden', flexShrink: 0,
  },

  fullDropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52, marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  fullDropdownVal:         { fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold, flex: 1 },
  fullDropdownPlaceholder: { fontSize: typography.size.lg, color: colors.muted, fontWeight: typography.weight.extrabold, flex: 1 },

  // Code section
  codeSection: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[3], ...shadow.sm,
  },
  codeSectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  codeSectionHint:  { fontSize: typography.size.lg, color: colors.muted, lineHeight: 20 },

  // Upload
  sectionLabel: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[2],
  },
  // Speed row — same height as other fields
  speedField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52, marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  speedLabel:  { fontSize: typography.size.lg, color: colors.muted, fontWeight: typography.weight.extrabold },
  speedToggle: { flexDirection: 'row', gap: spacing[2] },
  speedBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[1] + 2,
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  speedBtnOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  speedBtnTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.body },
  speedBtnTxtOn: { color: '#fff' },

  // Quantity field
  quantityField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52, marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  quantityLabel: { fontSize: typography.size.lg, color: colors.muted, fontWeight: typography.weight.extrabold },
  quantityRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, minWidth: 28, textAlign: 'center' },

  // Code inputs section
  codesSection: { marginBottom: spacing[3] },
  codesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[2], paddingHorizontal: spacing[1],
  },
  codesSectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  codesSectionSub:   { fontSize: typography.size.sm, color: colors.muted },
  codesProgress:     { flexDirection: 'row', alignItems: 'center' },
  codeInputRow: { marginBottom: spacing[2] },
  codeInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[3], height: 54,
  },
  codeInputWrapFilled:  { borderColor: '#10B98160', backgroundColor: '#D1FAE520' },
  codeInputWrapFocused: { borderColor: colors.primary, borderWidth: 2 },
  codeInputNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing[3], flexShrink: 0,
  },
  codeInputNumWrapFilled: { backgroundColor: colors.success, borderColor: colors.success },
  codeInputNum:       { fontSize: RF(11), fontWeight: typography.weight.bold, color: colors.muted },
  codeInputNumFilled: { color: '#fff' },
  codeInput: {
    flex: 1, fontSize: RF(15), color: colors.dark,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1.5, paddingVertical: 0,
  },
  codeClearBtn: { padding: spacing[1], marginLeft: spacing[1] },
  codeCharCount: { fontSize: RF(10), color: colors.subtle, textAlign: 'right', marginTop: 3, marginRight: spacing[1] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  typeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  typeChip: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, ...shadow.sm,
  },
  typeChipOn:    { backgroundColor: colors.dark, borderColor: colors.dark },
  typeChipTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.body },
  typeChipTxtOn: { color: '#fff' },
  uploadLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2], paddingHorizontal: spacing[1] },
  // Summary modal
  summaryCardRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4],
  },
  summaryCardImg: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
  },
  summaryCardName: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  summaryCardSub:  { fontSize: typography.size.lg, color: colors.muted, marginTop: 3 },
  summaryCardAmt:  { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.primary },
  summaryDivider:  { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[2],
  },
  summaryRowLabel: { fontSize: typography.size.lg, color: colors.muted },
  summaryRowVal:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  summaryTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
  },
  summaryTotalLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  summaryTotalAmt:   { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.primary },

  // Bottom sell button — orange CTA
  sellBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center' as const,
  },
  sellBtnOff: { backgroundColor: colors.accentLight },
  sellBtnTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: '#fff' },
  sellBtnTxtOff: { color: colors.accent },
  sellHint: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.warningLight, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  sellHintTxt: { fontSize: typography.size.sm, color: colors.warning, fontWeight: typography.weight.semibold, flex: 1 },

  // Upload
  imagesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3],
  },
  imageThumbnailWrap: {
    width: 64, height: 64, borderRadius: radius.md,
    overflow: 'hidden', position: 'relative',
  },
  imageThumbnail: { width: '100%', height: '100%' },
  imageThumbnailRemove: {
    position: 'absolute', top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageAddBtn: {
    width: 64, height: 64, borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: spacing[1],
  },
  imageAddTxt: { fontSize: typography.size.xs, color: colors.muted, fontWeight: typography.weight.medium },

  // Inline error badge
  inlineError: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[1] + 2,
    marginBottom: spacing[2],
  },
  inlineErrorTxt: {
    fontSize: typography.size.xs, color: colors.error,
    fontWeight: typography.weight.medium, flex: 1,
  },

  uploadBox: {
    width: 160, height: 160, borderRadius: radius.lg,
    backgroundColor: '#F0F4F0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2], overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  uploadPreview:     { width: '100%' as any, height: '100%' as any },
  uploadPlaceholder: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing[2] },
  uploadRemove: {
    position: 'absolute' as const, top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  uploadHelpTxt: {
    fontSize: typography.size.xs, color: colors.muted,
    fontWeight: typography.weight.regular, marginBottom: spacing[3],
    lineHeight: 18,
  },

  // Inline field hint
  fieldHint: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: spacing[1] + 2, marginTop: spacing[1], marginBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  fieldHintTxt: {
    fontSize: typography.size.xs, color: colors.warning,
    fontWeight: typography.weight.medium,
  },
  charCount: {
    fontSize: typography.size.xs, color: colors.subtle,
    textAlign: 'right' as const, marginTop: spacing[1],
  },

  // Scan icon inside code input
  scanIconBtn: {
    position: 'absolute' as const,
    top: spacing[3],
    right: spacing[3],
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },

  // Input Balance
  balanceField: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52, justifyContent: 'center' as const,
    marginBottom: spacing[3], borderWidth: 1, borderColor: colors.border,
  },
  balanceInput: { fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  rangeHint:    { fontSize: typography.size.lg, color: colors.subtle, marginBottom: spacing[3], paddingHorizontal: spacing[1] },

  // Selected card
  selectedCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[3], ...shadow.sm,
  },
  selectedCardIcon: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  selectedCardImg:  { width: 56, height: 56 },
  selectedCardName: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  selectedCardSub:  { fontSize: typography.size.lg, color: colors.muted, marginTop: 2 },

  // Form fields
  field: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[3], ...shadow.sm },
  fieldLabel: { fontSize: typography.size.lg, color: colors.body, marginBottom: spacing[2], fontWeight: typography.weight.extrabold },
  fieldVal:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  inputBox: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: colors.background, borderRadius: radius.md,
    paddingHorizontal: spacing[4], minHeight: 48,
  },
  inputPrefix: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark, marginRight: spacing[2] },
  inputTxt:    { flex: 1, fontSize: typography.size.lg, color: colors.dark, paddingVertical: spacing[2] },
  payoutBox: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[3],
  },
  payoutLbl:  { fontSize: typography.size.lg, color: colors.primary, marginBottom: 2 },
  payoutAmt:  { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.primary },
  payoutRate: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },

  // Bottom bar — absolutely pinned to bottom of screen
  bottomBar: {
    position: 'absolute' as const,
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: 'transparent',
    gap: spacing[3],
  },

  // Settlement amount — inline at top of form
  settlementWrap: {
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing[4],
  },
  settlementLabel: {
    fontSize: typography.size.base as any,
    color: colors.muted,
    fontWeight: typography.weight.extrabold,
    marginBottom: spacing[1],
  },
  settlementAmt: {
    fontSize: RF(36) as any,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    letterSpacing: -1,
  },
  settlementRate: {
    fontSize: typography.size.sm as any,
    color: colors.muted,
    marginTop: spacing[1],
  },

  // Split pill button
  splitPill: {
    flexDirection: 'row' as const,
    borderRadius: radius.full,
    overflow: 'hidden' as const,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  splitPillOff: {
    borderColor: colors.border,
  },
  splitLeft: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing[5],
  },
  splitLeftTxt: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
  },
  splitRight: {
    flex: 2,
    backgroundColor: colors.accent,
    overflow: 'hidden' as const,
  },
  splitRightOff: {
    backgroundColor: colors.disabled,
  },
  couponRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[2],
    paddingVertical: spacing[2],
  },
  couponRowTxt: {
    flex: 1, fontSize: typography.size.lg, color: colors.primary,
    fontWeight: typography.weight.extrabold,
  },
  couponAppliedRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[2],
    backgroundColor: colors.successLight, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  couponAppliedTxt: {
    flex: 1, fontSize: typography.size.lg, color: colors.success,
    fontWeight: typography.weight.extrabold,
  },
  couponAppliedAmt: {
    fontSize: typography.size.lg, color: colors.success,
    fontWeight: typography.weight.extrabold,
  },

  // Modals
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    height: '50%' as any, paddingBottom: spacing[5],
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center' as const,
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  searchBox: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: colors.background, borderRadius: radius.md,
    marginHorizontal: spacing[5], marginTop: spacing[3], marginBottom: spacing[2],
    paddingHorizontal: spacing[4], height: 44,
  },
  searchInput: { flex: 1, fontSize: typography.size.lg, color: colors.dark, marginLeft: spacing[2] },
  cardItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  cardItemIcon: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: spacing[3] },
  cardItemImg:  { width: 44, height: 44 },
  cardItemName: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  gridThree:    { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing[3] },
  gridItem: {
    width: '30%' as any, height: 52,
    backgroundColor: colors.background, borderRadius: radius.md,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1.5, borderColor: colors.border,
  },
  gridItemOn:    { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  gridItemTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  gridItemTxtOn: { color: colors.primary },

  // Guest
  guestWrap:  { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: spacing[8], gap: spacing[3] },
  guestIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: 'center' as const, justifyContent: 'center' as const },
  guestTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, textAlign: 'center' as const },
  guestSub:   { fontSize: typography.size.lg, color: colors.muted, textAlign: 'center' as const },
  loginBtn:   { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing[8], paddingVertical: spacing[4], marginTop: spacing[3] },
  loginBtnTxt:{ fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primaryText },

  // Scanner
  scanBtn:        { padding: spacing[2], alignSelf: 'flex-start' as const, marginTop: spacing[1] },
  scannerWrap:    { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  scannerFrame: {
    width: 260, height: 260, borderWidth: 3, borderColor: colors.primary,
    borderRadius: radius.lg, backgroundColor: 'transparent',
  },
  scannerHint: { color: '#fff', fontSize: typography.size.lg, marginTop: spacing[5], textAlign: 'center' as const, paddingHorizontal: spacing[8] },
  scannerClose: {
    position: 'absolute' as const, top: 56, right: spacing[5],
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center' as const, justifyContent: 'center' as const,
  },
})

// ── Success + summary extra styles ───────────────────────────────────────────
const ss = StyleSheet.create({
  // Coupon selector in summary modal
  couponSection: {
    paddingVertical: spacing[4],
  },
  couponLabel: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.muted, marginBottom: spacing[2],
  },
  couponPicker: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2,
  },
  couponPickerTxt: {
    flex: 1, fontSize: typography.size.base, color: colors.subtle,
  },
  couponApplied: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successLight, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.success,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    gap: spacing[3],
  },
  couponAppliedTitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.dark,
  },
  couponAppliedAmt: {
    fontSize: typography.size.sm, color: colors.success,
    fontWeight: typography.weight.semibold, marginTop: 2,
  },

  // Coupon picker bottom sheet
  cpSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    maxHeight: '82%',
    ...shadow.lg,
  },
  cpHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  cpHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cpBack:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cpInfoBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cpTitle:   { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.dark },
  cpClose:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cpItem: {
    flexDirection: 'row', backgroundColor: colors.primary,
    borderRadius: radius.xl, marginBottom: spacing[3],
    overflow: 'visible', position: 'relative',
  },
  cpLeft: {
    width: 100, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[5],
    borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  cpNotchTop:    { position: 'absolute', left: 91, top: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  cpNotchBottom: { position: 'absolute', left: 91, bottom: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  cpAmt:  { fontSize: RF(28), fontWeight: typography.weight.extrabold, color: '#fff', textAlign: 'center' },
  cpOff:  { fontSize: RF(10), fontWeight: typography.weight.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  cpRight: {
    flex: 1, paddingVertical: spacing[4],
    paddingLeft: spacing[5], paddingRight: spacing[4],
    justifyContent: 'center', gap: spacing[1] + 2,
  },
  cpItemTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  cpItemSub:   { fontSize: typography.size.sm, color: 'rgba(255,255,255,0.8)' },
  cpItemBonus: { fontSize: typography.size.sm, color: 'rgba(255,255,255,0.9)', fontWeight: typography.weight.semibold },
  cpDontUse: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cpDontUseTxt: { fontSize: typography.size.base, color: colors.subtle, fontWeight: typography.weight.medium },
  cpDontUseDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border },

  // Inline coupon list (inside summary modal) — kept for reference
  cpInline: { marginTop: spacing[3] },
  cpInlineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2], marginBottom: spacing[3] },
  cpInlineTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },

  // Success screen
  successTop: {
    alignItems: 'center', paddingTop: spacing[10], paddingBottom: spacing[5],
    position: 'relative',
  },
  spark: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, opacity: 0.5,
  },
  checkRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2, borderColor: `${colors.primary}40`,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  processingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    marginTop: spacing[4],
  },
  processingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  processingTxt: {
    fontSize: typography.size.sm, color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  successTitle: {
    fontSize: ms(typography.size['4xl']), fontWeight: typography.weight.extrabold,
    color: colors.dark, textAlign: 'center', marginBottom: spacing[3],
    paddingHorizontal: spacing[6],
  },
  successSub: {
    fontSize: ms(typography.size.lg), color: colors.muted,
    textAlign: 'center', lineHeight: ms(28), marginBottom: spacing[6],
    paddingHorizontal: spacing[8],
  },

  // Receipt card
  receiptCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[5], padding: spacing[5],
    ...shadow.sm,
  },
  receiptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[3] + 2,
  },
  receiptLabel: { fontSize: ms(typography.size.base), color: colors.muted },
  receiptValue: { fontSize: ms(typography.size.base), fontWeight: typography.weight.semibold, color: colors.dark, maxWidth: '55%', textAlign: 'right' },
  receiptDivider: { height: 1, backgroundColor: colors.background },

  // Bottom buttons
  bottomBtns: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: '#F8F9FA',
    gap: spacing[3],
  },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[5],
    minHeight: ms(56),
  },
  homeBtnTxt: { fontSize: ms(typography.size.lg), fontWeight: typography.weight.bold, color: '#fff' },

  imageViewLink: {
    fontSize: typography.size.base, color: colors.primary,
    fontWeight: typography.weight.bold,
  },

  // Summary modal extras
  codeBox: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[2],
  },
  codeTxt: { fontSize: typography.size.sm, color: colors.dark, lineHeight: 20 },
  imagePreview: {
    width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing[2],
  },
  holdWrap: { marginTop: spacing[4] },
  holdHint: {
    fontSize: typography.size.sm, color: colors.muted,
    textAlign: 'center', marginBottom: spacing[3],
    fontWeight: typography.weight.medium,
  },
})

// ── Image guide modal styles ──────────────────────────────────────────────────
const ig = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[5], alignItems: 'center',
  },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark, marginBottom: spacing[4] },

  // YES
  yesBox: {
    width: 120, height: 90, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[1], position: 'relative',
  },
  yesImg:    { alignItems: 'center', justifyContent: 'center' },
  yesLabel:  { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.dark, marginBottom: spacing[1] },
  yesCheck: {
    position: 'absolute', bottom: -10, left: '50%',
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginLeft: -11,
  },
  yesCaption: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, marginTop: spacing[4], marginBottom: spacing[4] },

  // NO grid
  noGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center', marginBottom: spacing[5] },
  noItem: { width: '44%', alignItems: 'center' },
  noImg: {
    width: '100%', height: 80, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.error,
    backgroundColor: '#FFF5F5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[1], position: 'relative',
  },
  noLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.dark, marginBottom: 2 },
  noCross: {
    position: 'absolute', bottom: -10, left: '50%',
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
    marginLeft: -11,
  },
  noCaption: { fontSize: typography.size.xs, color: colors.error, textAlign: 'center', marginTop: spacing[3], lineHeight: 16 },

  closeBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing[10], paddingVertical: spacing[3],
  },
  closeBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primaryText },
})


// ── Hold button styles ────────────────────────────────────────────────────────
const hb = StyleSheet.create({
  btn: {
    flex: 1, height: '100%' as any,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  txt: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extrabold,
    color: '#fff',
  },
})

// ── Confirm modal styles ─────────────────────────────────────────────────────
const cm = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  amtWrap: {
    backgroundColor: colors.primaryLight, borderRadius: radius.xl,
    paddingVertical: spacing[4], paddingHorizontal: spacing[5],
    alignItems: 'center', marginBottom: spacing[3],
  },
  amtLabel: {
    fontSize: typography.size.sm, color: colors.primary,
    fontWeight: typography.weight.semibold, marginBottom: spacing[1],
    letterSpacing: 0.3,
  },
  amt: {
    fontSize: RF(40), fontWeight: typography.weight.extrabold,
    color: colors.primary, letterSpacing: -1.5,
  },
  couponBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.successLight, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    marginTop: spacing[2],
  },
  couponBadgeTxt: {
    fontSize: typography.size.xs, color: colors.success,
    fontWeight: typography.weight.semibold,
  },
  rows: {
    backgroundColor: colors.background, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], marginBottom: spacing[4],
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[3],
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowLbl: { fontSize: typography.size.base, color: colors.muted },
  rowVal: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, maxWidth: '60%', textAlign: 'right' },
  rowValGreen: { color: '#22C55E' },

  // Coupon row
  couponRow: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingVertical: spacing[4],
  },
  couponIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFF3E0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing[2],
  },
  couponLbl: { fontSize: typography.size.base, color: colors.dark, flex: 1 },
  couponVal: { fontSize: typography.size.sm, color: colors.accent, fontWeight: typography.weight.semibold, marginRight: spacing[1] },

  // Warning note
  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: '#E6F7F5', borderRadius: radius.lg,
    padding: spacing[3], marginBottom: spacing[4],
  },
  noteTxt: { flex: 1, fontSize: typography.size.xs, color: colors.muted, lineHeight: 18 },

  // Submit button
  submitBtn: {
    backgroundColor: '#1A191E', borderRadius: 100,
    paddingVertical: spacing[4] + 2, alignItems: 'center',
    marginTop: spacing[2],
  },
  submitTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },

  btnRow: { flexDirection: 'row', gap: spacing[3] },
  cancelBtn: {
    flex: 1, borderWidth: 2, borderColor: colors.dark,
    borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center',
  },
  cancelTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  confirmBtn: {
    flex: 2, backgroundColor: colors.accent,
    borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center',
  },
  confirmTxt: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#fff' },
})

// ── Photo sheet styles ────────────────────────────────────────────────────────
const ph = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[5], paddingBottom: spacing[10],
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.lg, fontWeight: typography.weight.bold,
    color: colors.dark, textAlign: 'center', marginBottom: spacing[5],
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[4], gap: spacing[4],
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  rowTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.dark,
  },
  divider: { height: 1, backgroundColor: colors.border },
})

// ── Order Summary Page styles ─────────────────────────────────────────────────
const sp = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  settlementCard: {
    borderRadius: radius['2xl'], padding: spacing[6],
    alignItems: 'center', marginBottom: spacing[4],
  },
  settlementLabel: { fontSize: typography.size.base, color: 'rgba(255,255,255,0.8)', marginBottom: spacing[2] },
  settlementAmt:   { fontSize: RF(40), fontWeight: typography.weight.extrabold, color: '#fff', letterSpacing: -1 },
  couponBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, marginTop: spacing[3],
  },
  couponBadgeTxt: { fontSize: typography.size.sm, color: '#fff', fontWeight: typography.weight.semibold },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing[4], marginBottom: spacing[3], ...shadow.sm,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] },
  cardImg:  { width: 52, height: 52, borderRadius: radius.md },
  cardName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  cardSub:  { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  divider:  { height: 1, backgroundColor: colors.border, marginVertical: spacing[3] },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLbl:   { fontSize: typography.size.base, color: colors.muted },
  rowVal:   { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark },
  sectionTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, marginBottom: spacing[3] },
  bottomBar: {
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
})
