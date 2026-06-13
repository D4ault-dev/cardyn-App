import { RF, ms } from '../util/responsive'
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Modal, FlatList, TextInput, Alert, Platform} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { Spinner } from '../components/Spinner'
import { CardListSkeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchCountries, Country } from '../api/country'
import client from '../api/client'
import { BottomSheet } from '../components/BottomSheet'
import { currLabel } from '../util/currency'
import { useCountry } from '../context/CountryContext'

import { colors as _c } from '../theme'
const GREEN = _c.primary
const GREEN_LIGHT = _c.primaryLight

const CARD_BG = ['#EEF4FF','#FFF4E6','#F0FFF4','#FFF0F6','#F0F9FF','#FFFBEB','#F5F0FF','#F0FFFA']

export default function RateAlertScreen(props: StackScreenProps<RootStackParams, 'RateAlert'>) {
  const insets = useSafeAreaInsets()
  const params = (props.route?.params as any) || {}
  const { countries, selectedCountry } = useCountry()

  const [cards, setCards]           = useState<CardCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedCard, setSelectedCard]   = useState<CardCategory | null>(null)
  const [selectedType, setSelectedType]   = useState<string>(params.inputType || '')
  const [selectedCurrency, setSelectedCurrency] = useState<string>(params.currency || '')
  const [selectedMode, setSelectedMode]   = useState<'Fast' | 'Slow'>('Fast')
  const [faceValue, setFaceValue]         = useState<string>(params.faceValue || '')
  const [targetRate, setTargetRate]       = useState<string>('')

  const [cardPickerOpen, setCardPickerOpen]           = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen]   = useState(false)
  const [ratePickerOpen, setRatePickerOpen]           = useState(false)
  const [typePickerOpen, setTypePickerOpen]           = useState(false)
  const [cardSearch, setCardSearch]                   = useState('')

  useEffect(() => {
    setLoading(true)
    fetchCardCategories(true, selectedCountry?.name || '').then(c => {
      setCards(c)
      const initial = params.cardId ? c.find((x: CardCategory) => x.id === params.cardId) : c[0]
      if (initial) {
        setSelectedCard(initial)
        setSelectedMode(initial.defaultMode === 'slow' ? 'Slow' : 'Fast')
        if (!params.inputType)  setSelectedType(initial.inputTypes?.[0] || '')
        if (!params.currency)   setSelectedCurrency(initial.currencies?.[0] || '')
      }
    }).finally(() => setLoading(false))
  }, [selectedCountry?.name])

  function initCard(card: CardCategory) {
    setSelectedCard(card)
    // Auto-select first type — All is valid if admin selected it
    setSelectedType(card.inputTypes?.[0] || '')
    setSelectedMode(card.defaultMode === 'slow' ? 'Slow' : 'Fast')
    // Auto-select first currency
    setSelectedCurrency(card.currencies?.[0] || '')
    setFaceValue('')
  }

  const cardCountry = selectedCountry
    ?? (selectedCard ? countries.find(c => c.name === selectedCard.country) : null)
    ?? countries[0]
    ?? null

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
    // Admin stores base rate, multiply by country's todayRate to get NGN
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
      <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
            <Feather name="chevron-left" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Set Rate Alert</Text>
          <View style={{ width: 36 }} />
        </View>
        <CardListSkeleton />
      </View>
    )
  }

  const imgUrl = resolveImageUrl(selectedCard?.icon ?? null)

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
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
            {selectedCurrency || 'Select Currency'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Select Rate dropdown */}
        <TouchableOpacity
          style={[s.dropdown, !selectedCurrency && s.dropdownDisabled]}
          onPress={() => selectedCurrency && setRatePickerOpen(true)}
          activeOpacity={0.8}>
          <Text style={faceValue ? s.dropdownVal : s.dropdownPlaceholder}>
            {faceValue
              ? `${selectedCurrency} ${faceValue}  ·  ${cardCountry?.currencySymbol || '₦'}${currentRate > 0 ? currentRate.toFixed(2) : '—'} per ${selectedCurrency}1`
              : selectedCurrency ? 'Select Rate' : 'Select currency first'}
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
            Current Rate: {cardCountry?.currencySymbol || '₦'}{currentRate > 0
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
            : <Text style={[s.submitBtnTxt, (!canSubmit || submitting) && s.submitBtnTxtOff]}>Set Rate Alert</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Type picker — show all types admin configured */}
      <BottomSheet visible={typePickerOpen} onClose={() => setTypePickerOpen(false)} heightFraction={0.42}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Select Type</Text>
          <TouchableOpacity onPress={() => setTypePickerOpen(false)}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
          <View style={s.gridThree}>
            {(selectedCard?.inputTypes || []).map((t: string) => (
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

      {/* Card picker */}
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
          data={cards.filter((c: CardCategory) => c.name.toLowerCase().includes(cardSearch.toLowerCase()))}
          keyExtractor={(c: CardCategory) => String(c.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
          renderItem={({ item, index }: { item: CardCategory; index: number }) => {
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

      {/* Currency picker — 3-column grid Modal */}
      <Modal visible={currencyPickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCurrencyPickerOpen(false)} />
          <View style={[s.sheet, { height: '50%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setCurrencyPickerOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
              <View style={s.gridThree}>
                {(selectedCard?.currencies || []).map((code: string) => (
                  <TouchableOpacity key={code}
                    style={[s.gridItem, selectedCurrency === code && s.gridItemOn]}
                    onPress={() => { setSelectedCurrency(code); setFaceValue(''); setCurrencyPickerOpen(false) }}
                    activeOpacity={0.8}>
                    <Text style={[s.gridItemTxt, selectedCurrency === code && s.gridItemTxtOn]}>
                      {currLabel(code)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rate picker Modal — CardsScreen rate table design */}
      <Modal visible={ratePickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRatePickerOpen(false)} />
          <View style={[s.sheet, { maxHeight: '75%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Rate</Text>
              <TouchableOpacity onPress={() => setRatePickerOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Fast / Slow toggle */}
            {rateConfig && (() => {
              const hasFast = rateConfig.rows.some((r: any) => r.mode === 'Fast')
              const hasSlow = rateConfig.rows.some((r: any) => r.mode === 'Slow')
              if (!hasFast || !hasSlow) return null
              return (
                <View style={[s.modeRow, { marginHorizontal: spacing[4], marginTop: spacing[3] }]}>
                  {(['Fast', 'Slow'] as const).map(m => (
                    <TouchableOpacity key={m}
                      style={[s.modeBtn, selectedMode === m && s.modeBtnOn]}
                      onPress={() => { setSelectedMode(m); setFaceValue('') }}
                      activeOpacity={0.8}>
                      <Feather name={m === 'Fast' ? 'zap' : 'clock'} size={14}
                        color={selectedMode === m ? '#fff' : colors.muted} style={{ marginRight: 4 }} />
                      <Text style={[s.modeBtnTxt, selectedMode === m && s.modeBtnTxtOn]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })()}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[8] }}>
              {/* Table header */}
              <View style={[s.rateTableHead, { marginHorizontal: spacing[4], marginTop: spacing[3], borderRadius: radius.lg }]}>
                <Text style={[s.rateHeadTxt, { flex: 1.3 }]}>Card Value</Text>
                <Text style={[s.rateHeadTxt, { flex: 1.2 }]}>Type</Text>
                <Text style={[s.rateHeadTxt, { flex: 1.5, textAlign: 'right' }]}>Rate ({cardCountry?.currencySymbol || '₦'})</Text>
              </View>

              <View style={[s.rateTableWrap, { marginHorizontal: spacing[4], marginTop: spacing[2] }]}>
                {faceValueRows.length === 0 ? (
                  <View style={{ padding: spacing[8], alignItems: 'center' }}>
                    <Text style={{ fontSize: ms(typography.size.base), color: colors.muted }}>
                      No rates for {selectedCurrency} · {selectedMode}
                    </Text>
                  </View>
                ) : faceValueRows.map((row: any, i: number) => {
                  const label = rowLabel(row)
                  const active = faceValue === label
                  const showTypes = row.inputTypes?.length ? row.inputTypes : ['All']
                  const [val, rangeType] = (() => {
                    if (row.rangeType === 'fixed')    return [`${row.value}`, 'fixed']
                    if (row.rangeType === 'multiple') return [`${row.base}(${row.min}~${row.max})`, 'multiple']
                    return [`${row.min}-${row.max}`, 'range']
                  })()
                  return (
                    <TouchableOpacity key={i}
                      style={[s.rateCard, active && s.rateCardOn]}
                      onPress={() => { setFaceValue(label); setRatePickerOpen(false) }}
                      activeOpacity={0.8}>
                      <View style={{ flex: 1.3 }}>
                        <Text style={[s.rateRangeVal, active && { color: colors.primary }]}>{val}</Text>
                        <Text style={s.rateRangeType}>{rangeType}</Text>
                      </View>
                      <View style={{ flex: 1.2 }}>
                        {showTypes.map((tp: string, j: number) => (
                          <Text key={j} style={[s.rateTypeVal, active && { color: colors.primary }]}>{tp}</Text>
                        ))}
                      </View>
                      <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                        {showTypes.map((tp: string, j: number) => {
                          const r = row.rates?.[selectedType] || row.rates?.[tp] || row.rates?.['All'] || ''
                          const rateVal = r ? parseFloat(r) * (cardCountry?.todayRate ?? 1) : 0
                          return (
                            <Text key={j} style={[s.rateRateVal, active && { color: colors.primaryDark }]}>
                              {selectedCurrency}1 ≈ {rateVal > 0 ? rateVal.toFixed(2) : '—'}
                            </Text>
                          )
                        })}
                      </View>
                      {active && <View style={s.rateCardCheck}><Feather name="check-circle" size={16} color={colors.primary} /></View>}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  submitBtnTxtOff: { color: colors.disabledText },

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
    paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  pickerRowOn:  { backgroundColor: GREEN_LIGHT, borderWidth: 1.5, borderColor: GREEN },
  pickerIcon:   { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  pickerName:   { flex: 1, fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },

  // 3-column grid
  gridThree: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  gridItem: {
    width: '30%', height: 52,
    backgroundColor: colors.background, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  gridItemOn:    { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  gridItemTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  gridItemTxtOn: { color: colors.primary },

  // Fast/Slow mode toggle
  modeRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  modeBtnOn:    { backgroundColor: GREEN, borderColor: GREEN },
  modeBtnTxt:   { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.muted },
  modeBtnTxtOn: { color: '#fff' },

  // Rate table (CardsScreen design)
  rateTableWrap: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.sm,
  },
  rateTableHead: {
    flexDirection: 'row', paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background,
  },
  rateHeadTxt: { fontSize: ms(typography.size.sm), fontWeight: typography.weight.extrabold, color: colors.primary },
  rateCard: {
    flexDirection: 'row', paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  rateCardOn:    { backgroundColor: GREEN_LIGHT },
  rateCardCheck: { marginLeft: spacing[2] },
  rateRangeVal:  { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.dark },
  rateRangeType: { fontSize: ms(typography.size.xs), color: colors.muted, marginTop: 2 },
  rateTypeVal:   { fontSize: ms(typography.size.base), color: colors.muted, lineHeight: ms(24), fontWeight: typography.weight.semibold },
  rateRateVal:   { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.primaryDark, lineHeight: ms(24) },

  // Old face value picker styles (kept for reference, unused)
  fvRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginHorizontal: spacing[4], marginBottom: spacing[2], backgroundColor: colors.surface, borderRadius: radius.xl, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  fvLeft: { flex: 1 },
  fvTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  fvRate: { fontSize: typography.size.sm, color: GREEN, fontWeight: typography.weight.bold },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  tag: { backgroundColor: GREEN_LIGHT, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  tagTxt: { fontSize: RF(11), color: GREEN, fontWeight: typography.weight.medium },
})
