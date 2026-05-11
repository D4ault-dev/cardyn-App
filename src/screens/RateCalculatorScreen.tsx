import { RF, ms } from '../util/responsive'
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Modal, FlatList, TextInput,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { fetchCountries, Country } from '../api/country'
import { BottomSheet } from '../components/BottomSheet'
import { currLabel } from '../util/currency'
import { useCountry } from '../context/CountryContext'

// Colors now from theme
import { colors as _c } from '../theme'
const GREEN = _c.primary
const GREEN_LIGHT = _c.primaryLight

const CARD_BG = ['#EEF4FF','#FFF4E6','#F0FFF4','#FFF0F6','#F0F9FF','#FFFBEB','#F5F0FF','#F0FFFA']

function fmt(n: number, sym = '₦') {
  return `${sym}${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
}

export default function RateCalculatorScreen(props: StackScreenProps<RootStackParams, 'RateCalculator'>) {
  const insets = useSafeAreaInsets()
  const incomingId = (props.route?.params as any)?.cardId ?? null
  const { countries, selectedCountry } = useCountry()

  const [cards, setCards]     = useState<CardCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedCard, setSelectedCard]   = useState<CardCategory | null>(null)
  const [selectedType, setSelectedType]   = useState<string>('')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [selectedMode, setSelectedMode]   = useState<'Fast' | 'Slow'>('Fast')
  const [faceValue, setFaceValue]         = useState<string>('')
  const [amount, setAmount]               = useState<string>('')

  const [cardPickerOpen, setCardPickerOpen]         = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [ratePickerOpen, setRatePickerOpen]         = useState(false)
  const [typePickerOpen, setTypePickerOpen]         = useState(false)
  const [cardSearch, setCardSearch]       = useState('')
  const [amountError, setAmountError]     = useState('')

  useEffect(() => {
    setLoading(true)
    fetchCardCategories(true, selectedCountry?.name || '').then(c => {
      setCards(c)
      const initial = incomingId ? c.find(x => x.id === incomingId) : c[0]
      if (initial) initCard(initial)
    }).finally(() => setLoading(false))
  }, [selectedCountry?.name])

  function initCard(card: CardCategory) {
    setSelectedCard(card)
    // Auto-select first type — All is a valid type if admin selected it
    setSelectedType(card.inputTypes?.[0] || '')
    setSelectedMode(card.defaultMode === 'slow' ? 'Slow' : 'Fast')
    // Auto-select first currency
    setSelectedCurrency(card.currencies?.[0] || '')
    setFaceValue('')
    setAmount('')
    setAmountError('')
  }

  const cardCountry = selectedCountry
    ?? (selectedCard ? countries.find(c => c.name === selectedCard.country) : null)
    ?? countries[0]
    ?? null

  // Trade terms come from the card's configInfo array
  const tradeTerms = selectedCard?.configInfo?.length
    ? selectedCard.configInfo.join('\n')
    : 'Trade Terms: Please keep your card safe!'

  const rateConfig = selectedCard?.rateConfigs?.find(r => r.currency === selectedCurrency)

  // Filter rows by selected mode
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
    if (!selectedRow) return 0
    // Admin stores base rate (e.g. 5.15 per $1), apply country rate mode
    const r = selectedRow.rates?.[selectedType] || selectedRow.rates?.['All'] || ''
    if (!r) return 0
    const baseRate  = parseFloat(r)
    const todayRate = cardCountry?.todayRate ?? 1
    if (cardCountry?.rateMode === 'divide') {
      return todayRate > 0 ? baseRate / todayRate : baseRate
    }
    return baseRate * todayRate
  }

  function getRowRate(row: any): number {
    const r = row.rates?.[selectedType] || row.rates?.['All'] || ''
    if (!r) return 0
    const baseRate  = parseFloat(r)
    const todayRate = cardCountry?.todayRate ?? 1
    if (cardCountry?.rateMode === 'divide') {
      return todayRate > 0 ? baseRate / todayRate : baseRate
    }
    return baseRate * todayRate
  }

  function getLimits(): { min: number; max: number } | null {
    if (!selectedRow) return null
    if (selectedRow.rangeType === 'fixed') return { min: parseFloat(selectedRow.value), max: parseFloat(selectedRow.value) }
    if (selectedRow.rangeType === 'multiple') return { min: parseFloat(selectedRow.min), max: parseFloat(selectedRow.max) }
    return { min: parseFloat(selectedRow.min), max: parseFloat(selectedRow.max) }
  }

  const limits = getLimits()
  const rate   = getRate()
  const amtNum = parseFloat(amount) || 0
  const result = amtNum > 0 && rate > 0 ? amtNum * rate : 0

  // Validate amount against limits — also enforces multiples for 'multiple' rangeType
  function handleAmountChange(v: string) {
    setAmount(v)
    const n = parseFloat(v) || 0
    if (!limits || n === 0) { setAmountError(''); return }
    if (n < limits.min) {
      setAmountError(`Minimum is ${limits.min}`)
    } else if (n > limits.max) {
      setAmountError(`Maximum is ${limits.max}`)
    } else if (selectedRow?.rangeType === 'multiple') {
      const base = parseFloat(selectedRow.base) || 1
      if (n % base !== 0) {
        setAmountError(`Must be a multiple of ${base} (e.g. ${base}, ${base * 2}, ${base * 3}...)`)
      } else {
        setAmountError('')
      }
    } else {
      setAmountError('')
    }
  }

  const amountInRange = !limits || (
    amtNum >= limits.min &&
    amtNum <= limits.max &&
    (selectedRow?.rangeType !== 'multiple' || amtNum % (parseFloat(selectedRow?.base || '1') || 1) === 0)
  )
  const canSell = !!(selectedCard && selectedType && selectedCurrency && faceValue && amtNum > 0 && amountInRange)

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
            <Feather name="chevron-left" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Rate Calculator</Text>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator color={GREEN} style={{ marginTop: spacing[8] }} />
      </SafeAreaView>
    )
  }

  const imgUrl = resolveImageUrl(selectedCard?.icon ?? null)

  return (
    <>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rate Calculator</Text>
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

        {/* Input type dropdown — same style as currency */}
        {(selectedCard?.inputTypes?.length ?? 0) > 0 && (
          <>
            <TouchableOpacity
              style={s.dropdown}
              onPress={() => setTypePickerOpen(true)}
              activeOpacity={0.8}>
              <Text style={selectedType ? s.dropdownVal : s.dropdownPlaceholder}>
                {selectedType || 'Select Type (Code / Physical)'}
              </Text>
              <Feather name="chevron-down" size={18} color={colors.muted} />
            </TouchableOpacity>
          </>
        )}

        {/* Currency dropdown */}
        <TouchableOpacity
          style={s.dropdown}
          onPress={() => setCurrencyPickerOpen(true)}
          activeOpacity={0.8}>
          <Text style={selectedCurrency ? s.dropdownVal : s.dropdownPlaceholder}>
            {selectedCurrency || 'Select Currency'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Select Rate dropdown — only shown after currency is selected */}
        <TouchableOpacity
          style={[s.dropdown, !selectedCurrency && s.dropdownDisabled]}
          onPress={() => selectedCurrency && setRatePickerOpen(true)}
          activeOpacity={0.8}>
          <Text style={faceValue ? s.dropdownVal : s.dropdownPlaceholder}>
            {faceValue
              ? `${selectedCurrency} ${faceValue}  ·  ${cardCountry?.currencySymbol || '₦'}${rate > 0 ? rate.toFixed(2) : '—'} per ${selectedCurrency}1`
              : selectedCurrency ? 'Select Rate' : 'Select currency first'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Fast / Slow mode toggle — only show if card has rows for both modes */}
        {selectedCurrency && rateConfig && (
          (() => {
            const hasFast = rateConfig.rows.some(r => r.mode === 'Fast')
            const hasSlow = rateConfig.rows.some(r => r.mode === 'Slow')
            if (!hasFast || !hasSlow) return null
            return (
              <View style={s.modeRow}>
                {(['Fast', 'Slow'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.modeBtn, selectedMode === m && s.modeBtnOn]}
                    onPress={() => { setSelectedMode(m); setFaceValue(''); setAmount(''); setAmountError('') }}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={m === 'Fast' ? 'zap' : 'clock'}
                      size={14}
                      color={selectedMode === m ? '#fff' : colors.muted}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[s.modeBtnTxt, selectedMode === m && s.modeBtnTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          })()
        )}

        {/* Amount input */}
        <TextInput
          style={[s.amountInput, !faceValue && s.inputDisabled]}
          placeholder={limits ? `Amount (${limits.min} – ${limits.max})` : 'Enter amount'}
          placeholderTextColor={colors.subtle}
          keyboardType="numeric"
          value={amount}
          onChangeText={handleAmountChange}
          editable={!!faceValue}
        />
        {!!amountError && (
          <Text style={s.amountErr}>{amountError}</Text>
        )}

        {/* Trade terms */}
        <Text style={s.tradeTerms}>{tradeTerms}</Text>

        {/* Rate row */}
        <View style={s.rateRow}>
          <Feather name="trending-up" size={16} color={GREEN} />
          <Text style={s.rateText}>
            Rate: {rate > 0
              ? `${cardCountry?.currencySymbol || '₦'}${rate.toLocaleString('en-NG', { minimumFractionDigits: 2 })} per ${selectedCurrency || '$'}1`
              : '—'}
          </Text>
        </View>

        {/* Result */}
        <Text style={s.resultAmt}>
          {result > 0 ? fmt(result, cardCountry?.currencySymbol || '₦') : `${cardCountry?.currencySymbol || '₦'}0.00`}
        </Text>

      </ScrollView>

      {/* Bottom buttons */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[4] }]}>
        <TouchableOpacity style={s.alertBtn} activeOpacity={0.8}
          onPress={() => props.navigation.navigate('RateAlert' as any, {
            cardId: selectedCard?.id,
            currency: selectedCurrency,
            faceValue,
            inputType: selectedType,
            rate,
          } as any)}>
          <Text style={s.alertBtnTxt}>Set Rate Alert</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.sellBtn, !canSell && s.sellBtnOff]}
          activeOpacity={0.85}
          onPress={() => {
            if (canSell) props.navigation.navigate('SellCard' as any, { cardId: selectedCard!.id })
          }}>
          <Text style={[s.sellBtnTxt, !canSell && s.sellBtnTxtOff]}>Sell Gift Card</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>

      {/* Card picker modal */}
      <Modal visible={cardPickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setCardPickerOpen(false); setCardSearch('') }} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Card</Text>
              <TouchableOpacity onPress={() => { setCardPickerOpen(false); setCardSearch('') }} style={s.sheetClose}>
                <Feather name="x" size={18} color={colors.dark} />
              </TouchableOpacity>
            </View>
            <View style={s.searchBox}>
              <Feather name="search" size={16} color={colors.muted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search gift cards..."
                placeholderTextColor={colors.subtle}
                value={cardSearch}
                onChangeText={setCardSearch}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={cards.filter(c => c.name.toLowerCase().includes(cardSearch.toLowerCase()))}
              keyExtractor={c => String(c.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing[8] }}
              renderItem={({ item, index }) => {
                const url  = resolveImageUrl(item.icon)
                const bg   = CARD_BG[index % CARD_BG.length]
                const active = selectedCard?.id === item.id
                return (
                  <TouchableOpacity
                    style={[s.pickerRow, active && s.pickerRowOn]}
                    onPress={() => { initCard(item); setCardPickerOpen(false); setCardSearch('') }}
                    activeOpacity={0.7}>
                    {url ? (
                      <Image source={{ uri: url }} style={s.pickerIcon} resizeMode="cover" />
                    ) : (
                      <View style={[s.pickerIcon, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="credit-card" size={18} color={colors.muted} />
                      </View>
                    )}
                    <Text style={[s.pickerName, active && { color: GREEN }]}>{item.name}</Text>
                    {active && <Feather name="check-circle" size={18} color={GREEN} />}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Type picker — shows rate table filtered by type inside modal */}
      <BottomSheet visible={typePickerOpen} onClose={() => setTypePickerOpen(false)} heightFraction={0.75}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Select Type</Text>
          <TouchableOpacity onPress={() => setTypePickerOpen(false)}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing[4] }} showsVerticalScrollIndicator={false}>
          {/* Type chips — show all types admin configured, including 'All' */}
          <View style={s.gridThree}>
            {(selectedCard?.inputTypes || []).map(t => (
              <TouchableOpacity key={t}
                style={[s.gridItem, selectedType === t && s.gridItemOn]}
                onPress={() => setSelectedType(t)}
                activeOpacity={0.8}>
                <Text style={[s.gridItemTxt, selectedType === t && s.gridItemTxtOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rate table for selected type — shown below chips */}
          {selectedCurrency && faceValueRows.length > 0 && (
            <View style={[s.rateTableWrap, { marginTop: spacing[4] }]}>
              <View style={s.rateTableHead}>
                <Text style={[s.rateHeadTxt, { flex: 1.3 }]}>Card Value</Text>
                <Text style={[s.rateHeadTxt, { flex: 1.2 }]}>Type</Text>
                <Text style={[s.rateHeadTxt, { flex: 1.5, textAlign: 'right' }]}>Rate ({cardCountry?.currencySymbol || '₦'})</Text>
              </View>
              {faceValueRows.map((row, i) => {
                const label = rowLabel(row)
                const active = faceValue === label
                const displayTypes = row.inputTypes?.length ? row.inputTypes : ['All']
                const showTypes = displayTypes
                const [val, rangeType] = (() => {
                  if (row.rangeType === 'fixed')    return [`${row.value}`, 'fixed']
                  if (row.rangeType === 'multiple') return [`${row.base}(${row.min}~${row.max})`, 'multiple']
                  return [`${row.min}-${row.max}`, 'range']
                })()
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.rateCard, active && s.rateCardOn]}
                    onPress={() => {
                      setFaceValue(label)
                      setAmount('')
                      setAmountError('')
                      if (displayTypes.length === 1) setSelectedType(displayTypes[0])
                      setTypePickerOpen(false)
                    }}
                    activeOpacity={0.8}
                  >
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
                        // Show rate for the currently previewed type
                        const r = row.rates?.[selectedType] || row.rates?.[tp] || row.rates?.['All'] || ''
                        const rateVal = r ? parseFloat(r) * (cardCountry?.todayRate ?? 1) : 0
                        return (
                          <Text key={j} style={[s.rateRateVal, active && { color: colors.primaryDark }]}>
                            {selectedCurrency}1 ≈ {rateVal > 0 ? rateVal.toFixed(2) : '—'}
                          </Text>
                        )
                      })}
                    </View>
                    {active && (
                      <View style={s.rateCardCheck}>
                        <Feather name="check-circle" size={16} color={colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* If no currency selected yet, prompt */}
          {!selectedCurrency && (
            <View style={{ alignItems: 'center', paddingVertical: spacing[8] }}>
              <Text style={{ fontSize: ms(typography.size.sm), color: colors.muted }}>
                Select a currency first to see rates
              </Text>
            </View>
          )}
        </ScrollView>
      </BottomSheet>

      {/* Currency picker — 3-column grid, same as SellCardScreen country modal */}
      <Modal visible={currencyPickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCurrencyPickerOpen(false)} />
          <View style={[s.sheet, { height: '50%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Currency</Text>
              <TouchableOpacity
                onPress={() => setCurrencyPickerOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
              <View style={s.gridThree}>
                {(selectedCard?.currencies || []).map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[s.gridItem, selectedCurrency === code && s.gridItemOn]}
                    onPress={() => { setSelectedCurrency(code); setFaceValue(''); setAmount(''); setAmountError(''); setCurrencyPickerOpen(false) }}
                    activeOpacity={0.8}
                  >
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

      {/* Rate picker modal — CardsScreen rate table design */}
      <Modal visible={ratePickerOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRatePickerOpen(false)} />
          <View style={[s.sheet, { maxHeight: '75%' }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Rate</Text>
              <TouchableOpacity
                onPress={() => setRatePickerOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Fast / Slow toggle inside modal */}
            {rateConfig && (() => {
              const hasFast = rateConfig.rows.some(r => r.mode === 'Fast')
              const hasSlow = rateConfig.rows.some(r => r.mode === 'Slow')
              if (!hasFast || !hasSlow) return null
              return (
                <View style={[s.modeRow, { marginHorizontal: spacing[4], marginTop: spacing[3] }]}>
                  {(['Fast', 'Slow'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[s.modeBtn, selectedMode === m && s.modeBtnOn]}
                      onPress={() => { setSelectedMode(m); setFaceValue(''); setAmount(''); setAmountError('') }}
                      activeOpacity={0.8}
                    >
                      <Feather name={m === 'Fast' ? 'zap' : 'clock'} size={14}
                        color={selectedMode === m ? '#fff' : colors.muted} style={{ marginRight: 4 }} />
                      <Text style={[s.modeBtnTxt, selectedMode === m && s.modeBtnTxtOn]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            })()}

            {/* Rate table */}
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
                ) : faceValueRows.map((row, i) => {
                  const label = rowLabel(row)
                  const active = faceValue === label
                  const showTypes = row.inputTypes?.length ? row.inputTypes : ['All']
                  const [val, rangeType] = (() => {
                    if (row.rangeType === 'fixed')    return [`${row.value}`, 'fixed']
                    if (row.rangeType === 'multiple') return [`${row.base}(${row.min}~${row.max})`, 'multiple']
                    return [`${row.min}-${row.max}`, 'range']
                  })()
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.rateCard, active && s.rateCardOn]}
                      onPress={() => {
                        setFaceValue(label)
                        setAmount('')
                        setAmountError('')
                        if (showTypes.length === 1) setSelectedType(showTypes[0])
                        setRatePickerOpen(false)
                      }}
                      activeOpacity={0.8}
                    >
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
                      {active && (
                        <View style={s.rateCardCheck}>
                          <Feather name="check-circle" size={16} color={colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </>
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
  inputDisabled: { opacity: 0.5 },

  amountErr: {
    fontSize: typography.size.sm, color: colors.error,
    marginTop: -spacing[2], marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },

  // Fast / Slow mode toggle
  modeRow: {
    flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3],
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeBtnOn:    { backgroundColor: GREEN, borderColor: GREEN },
  modeBtnTxt:   { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.muted },
  modeBtnTxtOn: { color: '#fff' },

  tradeTerms: {
    fontSize: typography.size.sm, color: colors.muted,
    marginBottom: spacing[3], lineHeight: 20,
  },

  rateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginBottom: spacing[2],
  },
  rateText: {
    fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold,
  },

  resultAmt: {
    fontSize: RF(40), fontWeight: typography.weight.extrabold,
    color: colors.dark, letterSpacing: -1,
    textAlign: 'center', marginTop: spacing[2], marginBottom: spacing[4],
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  alertBtn: {
    flex: 1, borderWidth: 2, borderColor: _c.secondary,
    borderRadius: radius.full, paddingVertical: spacing[4],
    alignItems: 'center', justifyContent: 'center',
  },
  alertBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: _c.secondary },
  sellBtn: {
    flex: 1, backgroundColor: _c.accent,
    borderRadius: radius.full, paddingVertical: spacing[4],
    alignItems: 'center', justifyContent: 'center',
  },
  sellBtnOff:    { backgroundColor: colors.disabled },
  sellBtnTxt:    { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  sellBtnTxtOff: { color: colors.disabledText },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },

  // 3-column grid — same as SellCardScreen
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

  // ── Inline rate table (CardsScreen design) ────────────────────────────────
  rateTableWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  rateTableHead: {
    flexDirection: 'row',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  rateHeadTxt: {
    fontSize: ms(typography.size.sm),
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
  },
  rateCard: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    alignItems: 'center',
  },
  rateCardOn: { backgroundColor: GREEN_LIGHT },
  rateCardCheck: { marginLeft: spacing[2] },
  rateRangeVal:  { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.dark },
  rateRangeType: { fontSize: ms(typography.size.xs), color: colors.muted, marginTop: 2 },
  rateTypeVal:   { fontSize: ms(typography.size.base), color: colors.muted, lineHeight: ms(24), fontWeight: typography.weight.semibold },
  rateRateVal:   { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.primaryDark, lineHeight: ms(24) },

  // Face value picker
  fvRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  fvLeft:   { flex: 1 },
  fvTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  fvRateWrap: { alignItems: 'flex-end', gap: 2 },
  fvRateLabel: { fontSize: RF(10), color: colors.muted, fontWeight: typography.weight.medium },
  fvRate:   { fontSize: typography.size.sm, color: GREEN, fontWeight: typography.weight.bold },
  tagRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  tag: {
    backgroundColor: GREEN_LIGHT, borderRadius: radius.full,
    paddingHorizontal: spacing[2], paddingVertical: 2,
  },
  tagTxt: { fontSize: RF(11), color: GREEN, fontWeight: typography.weight.medium },
})
