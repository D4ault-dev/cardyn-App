import { RF } from '../util/responsive'
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Modal, FlatList, TextInput, Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchCountries, Country } from '../api/country'
import client from '../api/client'
import { BottomSheet } from '../components/BottomSheet'
// Colors now from theme
import { colors as _c } from '../theme'
const GREEN = _c.primary
const GREEN_LIGHT = _c.primaryLight

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', AUD: '🇦🇺', EUR: '🇪🇺', GBP: '🇬🇧',
  CAD: '🇨🇦', NZD: '🇳🇿', BRL: '🇧🇷', SGD: '🇸🇬',
  HKD: '🇭🇰', JPY: '🇯🇵', CNY: '🇨🇳', INR: '🇮🇳',
  MYR: '🇲🇾', PHP: '🇵🇭', KRW: '🇰🇷', CHF: '🇨🇭',
  SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰', ZAR: '🇿🇦',
  MXN: '🇲🇽', TRY: '🇹🇷', THB: '🇹🇭', IDR: '🇮🇩',
  VND: '🇻🇳', PLN: '🇵🇱', AED: '🇦🇪', SAR: '🇸🇦',
  TWD: '🇹🇼', RUB: '🇷🇺',
}

const CARD_BG = ['#EEF4FF','#FFF4E6','#F0FFF4','#FFF0F6','#F0F9FF','#FFFBEB','#F5F0FF','#F0FFFA']

function flagFor(code: string) {
  return CURRENCY_FLAGS[code?.toUpperCase()] || '🏳️'
}

export default function RateAlertScreen(props: StackScreenProps<RootStackParams, 'RateAlert'>) {
  const insets = useSafeAreaInsets()
  const params = (props.route?.params as any) || {}

  const [cards, setCards]         = useState<CardCategory[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedCard, setSelectedCard]   = useState<CardCategory | null>(null)
  const [selectedType, setSelectedType]   = useState<string>(params.inputType || '')
  const [selectedCurrency, setSelectedCurrency] = useState<string>(params.currency || '')
  const [selectedMode, setSelectedMode]   = useState<'Fast' | 'Slow'>('Fast')
  const [faceValue, setFaceValue]         = useState<string>(params.faceValue || '')
  const [targetRate, setTargetRate]       = useState<string>('')

  const [cardPickerOpen, setCardPickerOpen]         = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [faceValuePickerOpen, setFaceValuePickerOpen] = useState(false)
  const [typePickerOpen, setTypePickerOpen]         = useState(false)
  const [cardSearch, setCardSearch]       = useState('')

  useEffect(() => {
    Promise.all([fetchCardCategories(), fetchCountries()]).then(([c, co]) => {
      setCards(c)
      setCountries(co)
      const initial = params.cardId ? c.find((x: CardCategory) => x.id === params.cardId) : c[0]
      if (initial) {
        setSelectedCard(initial)
        setSelectedMode(initial.defaultMode === 'slow' ? 'Slow' : 'Fast')
        if (!selectedType) setSelectedType('')
      }
    }).finally(() => setLoading(false))
  }, [])

  function initCard(card: CardCategory) {
    setSelectedCard(card)
    setSelectedType('')
    setSelectedMode(card.defaultMode === 'slow' ? 'Slow' : 'Fast')
    setSelectedCurrency('')
    setFaceValue('')
  }

  const cardCountry = selectedCard
    ? countries.find(c => c.name === selectedCard.country) || countries[0] || null
    : null

  // Trade terms from card's configInfo
  const tradeTerms = selectedCard?.configInfo?.length
    ? selectedCard.configInfo.join('\n')
    : 'Trade Terms: Please keep your card safe!'

  const rateConfig = selectedCard?.rateConfigs?.find(r => r.currency === selectedCurrency)
  const faceValueRows = rateConfig
    ? rateConfig.rows.filter(r => r.mode === selectedMode)
    : []

  function rowLabel(row: any): string {
    if (row.rangeType === 'fixed')    return `${row.value}`
    if (row.rangeType === 'multiple') return `${row.base} (${row.min}–${row.max})`
    return `${row.min} – ${row.max}`
  }

  const faceValueOptions = faceValueRows.map(rowLabel)
  const selectedRowIndex = faceValueOptions.indexOf(faceValue)
  const selectedRow = selectedRowIndex >= 0 ? faceValueRows[selectedRowIndex] : null

  function getRate(): number {
    if (!selectedRow) return params.rate || 0
    const r = selectedRow.rates?.[selectedType] || selectedRow.rates?.['All'] || ''
    if (!r) return 0
    return parseFloat(r) * (cardCountry?.todayRate ?? 1)
  }

  function getRowRate(row: any): number {
    const r = row.rates?.[selectedType] || row.rates?.['All'] || ''
    if (!r) return 0
    return parseFloat(r) * (cardCountry?.todayRate ?? 1)
  }

  const currentRate = getRate()
  const canSubmit = !!(selectedCard && selectedType && selectedCurrency && faceValue && targetRate && parseFloat(targetRate) > 0)

  async function handleSubmit() {
    if (!canSubmit || !selectedCard) return
    setSubmitting(true)
    try {
      await client.post('/tuka/rateAlert/create', {
        categoryId:   selectedCard.id,
        categoryName: selectedCard.name,
        currency:     selectedCurrency,
        faceValue,
        inputType:    selectedType,
        currentRate,
        targetRate:   parseFloat(targetRate),
      })
      props.navigation.navigate('RateAlertList' as any, { success: true } as any)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to set rate alert')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
            <Feather name="chevron-left" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Set Rate Alert</Text>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator color={GREEN} style={{ marginTop: spacing[8] }} />
      </SafeAreaView>
    )
  }

  const imgUrl = resolveImageUrl(selectedCard?.icon ?? null)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Set Rate Alert</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing[4] }}
        keyboardShouldPersistTaps="handled">

        {/* Card row */}
        <View style={s.cardRow}>
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={s.cardIcon} resizeMode="cover" />
          ) : (
            <View style={[s.cardIcon, s.cardIconFallback]}>
              <Feather name="credit-card" size={22} color={GREEN} />
            </View>
          )}
          <Text style={s.cardName} numberOfLines={1}>{selectedCard?.name || 'Select a card'}</Text>
          <TouchableOpacity style={s.changeBtn} onPress={() => setCardPickerOpen(true)} activeOpacity={0.8}>
            <Text style={s.changeBtnTxt}>Change card</Text>
          </TouchableOpacity>
        </View>

        {/* Type dropdown — same as RateCalculatorScreen */}
        {(selectedCard?.inputTypes?.length ?? 0) > 0 && (
          <TouchableOpacity
            style={s.dropdown}
            onPress={() => setTypePickerOpen(true)}
            activeOpacity={0.8}>
            <Text style={selectedType ? s.dropdownVal : s.dropdownPlaceholder}>
              {selectedType || 'Select Type'}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}

        {/* Currency dropdown */}
        <TouchableOpacity style={s.dropdown} onPress={() => setCurrencyPickerOpen(true)} activeOpacity={0.8}>
          <Text style={selectedCurrency ? s.dropdownVal : s.dropdownPlaceholder}>
            {selectedCurrency ? `${flagFor(selectedCurrency)}  ${selectedCurrency}` : 'Select Currency'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Face value dropdown */}
        <TouchableOpacity
          style={[s.dropdown, !selectedCurrency && s.dropdownDisabled]}
          onPress={() => selectedCurrency && setFaceValuePickerOpen(true)}
          activeOpacity={0.8}>
          <Text style={faceValue ? s.dropdownVal : s.dropdownPlaceholder}>
            {faceValue || (selectedCurrency ? 'Select Face Value' : 'Select currency first')}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Target rate input */}
        <TextInput
          style={s.amountInput}
          placeholder="Enter Target Rate"
          placeholderTextColor={colors.subtle}
          keyboardType="numeric"
          value={targetRate}
          onChangeText={setTargetRate}
        />

        {/* Trade terms */}
        <Text style={s.tradeTerms}>{tradeTerms}</Text>

        {/* Current rate banner */}
        <View style={s.rateBanner}>
          <Feather name="trending-up" size={16} color={GREEN} />
          <Text style={s.rateBannerTxt}>
            Current Rate: ₦{currentRate > 0
              ? currentRate.toLocaleString('en-NG', { minimumFractionDigits: 2 })
              : '0.00'}
          </Text>
        </View>

      </ScrollView>

      {/* Bottom button */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[4] }]}>
        <TouchableOpacity
          style={[s.submitBtn, (!canSubmit || submitting) && s.submitBtnOff]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.submitBtnTxt}>Set Rate Alert</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Type picker — same 3-column grid as RateCalculatorScreen */}
      <BottomSheet visible={typePickerOpen} onClose={() => setTypePickerOpen(false)} heightFraction={0.42}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Type</Text>
          <TouchableOpacity onPress={() => setTypePickerOpen(false)}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
          <View style={s.gridThree}>
            {(selectedCard?.inputTypes || []).map(t => (
              <TouchableOpacity key={t}
                style={[s.gridItem, selectedType === t && s.gridItemOn]}
                onPress={() => { setSelectedType(t); setFaceValue(''); setTypePickerOpen(false) }}
                activeOpacity={0.8}>
                <Text style={[s.gridItemTxt, selectedType === t && s.gridItemTxtOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Card picker — smooth BottomSheet */}
      <BottomSheet visible={cardPickerOpen} onClose={() => { setCardPickerOpen(false); setCardSearch('') }} heightFraction={0.72}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Select Card</Text>
          <TouchableOpacity onPress={() => { setCardPickerOpen(false); setCardSearch('') }} style={s.sheetClose}>
            <Feather name="x" size={18} color={colors.dark} />
          </TouchableOpacity>
        </View>
        <View style={s.searchBox}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput style={s.searchInput} placeholder="Search gift cards..." placeholderTextColor={colors.subtle} value={cardSearch} onChangeText={setCardSearch} autoCorrect={false} />
        </View>
        <FlatList
          data={cards.filter(c => c.name.toLowerCase().includes(cardSearch.toLowerCase()))}
          keyExtractor={c => String(c.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
          renderItem={({ item, index }) => {
            const url = resolveImageUrl(item.icon)
            const bg = CARD_BG[index % CARD_BG.length]
            const active = selectedCard?.id === item.id
            return (
              <TouchableOpacity style={[s.pickerRow, active && s.pickerRowOn]} onPress={() => { initCard(item); setCardPickerOpen(false); setCardSearch('') }} activeOpacity={0.7}>
                {url ? <Image source={{ uri: url }} style={s.pickerIcon} resizeMode="cover" /> : <View style={[s.pickerIcon, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}><Feather name="credit-card" size={18} color={colors.muted} /></View>}
                <Text style={[s.pickerName, active && { color: GREEN }]}>{item.name}</Text>
                {active && <Feather name="check-circle" size={18} color={GREEN} />}
              </TouchableOpacity>
            )
          }}
        />
      </BottomSheet>

      {/* Currency picker — smooth BottomSheet */}
      <BottomSheet visible={currencyPickerOpen} onClose={() => setCurrencyPickerOpen(false)} heightFraction={0.5}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Select Currency</Text>
          <TouchableOpacity onPress={() => setCurrencyPickerOpen(false)} style={s.sheetClose}><Feather name="x" size={18} color={colors.dark} /></TouchableOpacity>
        </View>
        <FlatList
          data={selectedCard?.currencies || []}
          keyExtractor={c => c}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
          renderItem={({ item }) => {
            const active = selectedCurrency === item
            return (
              <TouchableOpacity style={[s.pickerRow, active && s.pickerRowOn]} onPress={() => { setSelectedCurrency(item); setFaceValue(''); setCurrencyPickerOpen(false) }} activeOpacity={0.7}>
                <Text style={s.flagEmoji}>{flagFor(item)}</Text>
                <Text style={[s.pickerName, active && { color: GREEN }]}>{item}</Text>
                {active && <Feather name="check-circle" size={18} color={GREEN} />}
              </TouchableOpacity>
            )
          }}
        />
      </BottomSheet>

      {/* Face value picker — smooth BottomSheet */}
      <BottomSheet visible={faceValuePickerOpen} onClose={() => setFaceValuePickerOpen(false)} heightFraction={0.62}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Select Face Value</Text>
          <TouchableOpacity onPress={() => setFaceValuePickerOpen(false)} style={s.sheetClose}><Feather name="x" size={18} color={colors.dark} /></TouchableOpacity>
        </View>
        <FlatList
          data={faceValueRows}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
          renderItem={({ item }) => {
            const label = rowLabel(item)
            const active = faceValue === label
            const rowR = getRowRate(item)
            const tags: string[] = [...(item.inputTypes?.length && !item.inputTypes.includes('All') ? item.inputTypes : []), selectedMode === 'Fast' ? 'Fast card' : 'Slow card', item.rangeType === 'multiple' ? `Accepts Multiples of ${item.base}` : ''].filter(Boolean)
            return (
              <TouchableOpacity style={[s.fvRow, active && s.pickerRowOn]} onPress={() => { setFaceValue(label); setFaceValuePickerOpen(false) }} activeOpacity={0.7}>
                <View style={s.fvLeft}>
                  <View style={s.fvTopRow}><Text style={s.flagEmoji}>{flagFor(selectedCurrency)}</Text><Text style={[s.pickerName, active && { color: GREEN }]}>{label}</Text></View>
                  {tags.length > 0 && <View style={s.tagRow}>{tags.map(tag => <View key={tag} style={s.tag}><Text style={s.tagTxt}>{tag}</Text></View>)}</View>}
                </View>
                <Text style={s.fvRate}>Rate: {rowR > 0 ? rowR.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '—'}</Text>
              </TouchableOpacity>
            )
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark,
  },

  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface,
    marginBottom: spacing[3],
    borderRadius: radius.xl, padding: spacing[4],
    ...shadow.sm,
  },
  cardIcon: { width: 48, height: 48, borderRadius: radius.lg, overflow: 'hidden' },
  cardIconFallback: { backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center' },
  cardName: { flex: 1, fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  changeBtn: {
    backgroundColor: GREEN, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
  },
  changeBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: '#fff' },

  typeTabs: {
    flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3],
  },
  typeTab: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  typeTabOn:    { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  typeTabTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.muted },
  typeTabTxtOn: { color: GREEN },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52,
    marginBottom: spacing[3], backgroundColor: colors.surface,
  },
  dropdownDisabled: { opacity: 0.5 },
  dropdownVal:         { fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },
  dropdownPlaceholder: { fontSize: typography.size.lg, color: colors.subtle },

  amountInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], height: 52,
    marginBottom: spacing[3], backgroundColor: colors.surface,
    fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold,
  },

  tradeTerms: {
    fontSize: typography.size.sm, color: colors.muted,
    marginBottom: spacing[3], lineHeight: 20,
  },

  rateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: GREEN_LIGHT, borderRadius: radius.lg,
    padding: spacing[4], marginBottom: spacing[3],
  },
  rateBannerTxt: {
    fontSize: typography.size.base, color: GREEN, fontWeight: typography.weight.bold,
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  submitBtn: {
    backgroundColor: _c.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center', justifyContent: 'center',
  },
  submitBtnOff: { backgroundColor: colors.disabled },
  submitBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },

  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    maxHeight: '75%', paddingBottom: spacing[8],
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.background, borderRadius: radius.full,
    marginHorizontal: spacing[4], marginVertical: spacing[3],
    paddingHorizontal: spacing[4], height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.size.base, color: colors.dark },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerRowOn:  { backgroundColor: GREEN_LIGHT },
  pickerIcon:   { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  pickerName:   { flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  flagEmoji:    { fontSize: RF(22) },

  fvRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  fvLeft:   { flex: 1 },
  fvTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  fvRate:   { fontSize: typography.size.sm, color: GREEN, fontWeight: typography.weight.bold },
  tagRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  tag: {
    backgroundColor: GREEN_LIGHT, borderRadius: radius.full,
    paddingHorizontal: spacing[2], paddingVertical: 2,
  },
  tagTxt: { fontSize: RF(11), color: GREEN, fontWeight: typography.weight.medium },
})
