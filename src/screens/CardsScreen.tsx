import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, FlatList, Platform} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { useIsFocused } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { CardListSkeleton } from '../components/Skeleton'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'
import { currSym, currLabel } from '../util/currency'
import { useDrawerSwipe } from '../hooks/useDrawerSwipe'
import { FadeScreen } from '../components/FadeScreen'
import { ms, tabBarClearance } from '../util/responsive'
import { useCountry } from '../context/CountryContext'

const CARD_BG = ['#E8F5E9','#FFF3E0','#E3F2FD','#FCE4EC','#F3E5F5','#E0F7FA','#FFF8E1','#E8EAF6']

// ── Rate Table ────────────────────────────────────────────────────────────────
const RateTable = React.memo(function RateTable({
  card, country, mode, onSell,
}: {
  card: CardCategory; country: any | null; mode: 'Fast' | 'Slow'
  onSell: (currency: string, inputType: string, mode: 'Fast' | 'Slow') => void
}) {
  const [currency, setCurrency] = useState(card.currencies?.[0] || 'USD')

  const sym        = country?.currencySymbol || '₦'
  const rateConfig = useMemo(
    () => card.rateConfigs?.find((r: any) => r.currency === currency),
    [card, currency]
  )
  const rows = useMemo(
    () => (rateConfig?.rows || []).filter((r: any) => r.mode === mode),
    [rateConfig, mode]
  )

  function getRate(row: any, type: string): number {
    const r = row.rates?.[type] || row.rates?.['All'] || ''
    const baseRate = r ? parseFloat(r) : (card.rate ?? 0)
    const todayRate = country?.todayRate ?? 1
    if (country?.rateMode === 'divide') {
      return todayRate > 0 ? baseRate / todayRate : baseRate
    }
    return baseRate * todayRate
  }

  function rangeLabel(row: any): [string, string] {
    if (row.rangeType === 'fixed')    return [`${row.value}`, 'fixed']
    if (row.rangeType === 'multiple') return [`${row.base}(${row.min}~${row.max})`, 'multiple']
    return [`${row.min}-${row.max}`, 'range']
  }

  // Stable renderItem for the rate rows FlatList
  const renderRateRow = useCallback(({ item: row, index: i }: { item: any; index: number }) => {
    const types = row.inputTypes?.length ? row.inputTypes : ['All']
    const [val, type] = rangeLabel(row)
    return (
      <TouchableOpacity
        style={t.rateCard}
        onPress={() => onSell(currency, types[0], mode)}
        activeOpacity={0.8}>
        <View style={{ flex: 1.3 }}>
          <Text style={t.rangeVal}>{val}</Text>
          <Text style={t.rangeType}>{type}</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          {types.map((tp: string, j: number) => (
            <Text key={j} style={t.typeVal}>{tp}</Text>
          ))}
        </View>
        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
          {types.map((tp: string, j: number) => (
            <Text key={j} style={t.rateVal}>
              {currSym(currency)}1 ≈ {getRate(row, tp).toFixed(2)}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    )
  }, [currency, mode, onSell, country, card])

  return (
    <View style={t.wrap}>
      {/* Currency chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={t.chipsScroll}>
        <View style={{ flexDirection: 'row', gap: spacing[2], paddingVertical: spacing[3], paddingRight: spacing[2] }}>
          {card.currencies.map((cur: string) => (
            <TouchableOpacity key={cur}
              style={[t.chip, currency === cur && t.chipOn]}
              onPress={() => setCurrency(cur)} activeOpacity={0.8}>
              <Text style={[t.chipTxt, currency === cur && t.chipTxtOn]}>{currLabel(cur)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Table header */}
      <View style={t.tableHead}>
        <Text style={[t.headTxt, { flex: 1.3 }]}>Card Value</Text>
        <Text style={[t.headTxt, { flex: 1.2 }]}>Type</Text>
        <Text style={[t.headTxt, { flex: 1.5, textAlign: 'right' }]}>Rate({sym})</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={t.noRates}>No rates for {currLabel(currency)} · {mode}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(_item, index) => String(index)}
          renderItem={renderRateRow}
          scrollEnabled={false}
          removeClippedSubviews={false}
        />
      )}
    </View>
  )
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CardsScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const insets = useSafeAreaInsets()
  const [cards, setCards]           = useState<CardCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode]             = useState<'Fast' | 'Slow'>('Fast')

  // Global country from context
  const { selectedCountry, countries } = useCountry()
  const isFocused = useIsFocused()

  // Accept selectedCardId passed back from CardPickerScreen
  const incomingId = (props.route?.params as any)?.selectedCardId

  const load = useCallback(async (force = false) => {
    try {
      const c = await fetchCardCategories(force, selectedCountry?.name || '')
      setCards(c)
      // Only default to first card on initial load (no card selected yet)
      // Never reset the selection when refreshing — user's choice must be preserved
      setSelectedId(prev => {
        if (prev !== null && c.some(card => card.id === prev)) return prev  // keep current
        return c.length > 0 ? c[0].id : null  // first card only on initial load
      })
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [selectedCountry?.name])

  useEffect(() => {
    setLoading(true)
    load(true)
  }, [selectedCountry?.name])

  // Refresh data on focus but DON'T reset selected card
  useEffect(() => {
    if (isFocused) load(false)  // force=false — use cache, no flicker, no selection reset
  }, [isFocused])

  // When CardPickerScreen navigates back with a selection — always honour it
  useEffect(() => {
    if (incomingId) setSelectedId(incomingId)
  }, [incomingId])

  const onRefresh = () => { setRefreshing(true); load(true) }

  const getCountry = useCallback((card: CardCategory) =>
    countries.find(c => c.name === card.country) || selectedCountry || countries[0] || null,
  [countries, selectedCountry])

  const selectedCard        = useMemo(() => cards.find(c => c.id === selectedId) || null, [cards, selectedId])
  const selectedCardCountry = useMemo(() => selectedCard ? getCountry(selectedCard) : (selectedCountry || null), [selectedCard, getCountry, selectedCountry])
  const imgUrl              = useMemo(() => resolveImageUrl(selectedCard?.icon ?? null), [selectedCard])

  const handleSell = useCallback((currency: string, inputType: string, rowMode: 'Fast' | 'Slow') => {
    if (!selectedCard) return
    props.navigation.navigate('SellCard' as any, {
      cardId: selectedCard.id,
      currency,
      inputType,
      mode: rowMode,
    })
  }, [selectedCard, props.navigation])

  const swipeHandlers = useDrawerSwipe()

  return (
    <FadeScreen>
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ width: 36 }} />
        <Text style={s.headerTitle}>Card Rates</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Top row: 70% dropdown + 30% pill toggle ── */}
      <View style={s.topRow}>

        {/* Dropdown — navigates to CardPickerScreen */}
        <TouchableOpacity
          style={s.selectorRow}
          onPress={() => props.navigation.navigate('CardPicker' as any, { selectedId } as any)}
          activeOpacity={0.8}>
          {selectedCard ? (
            <>
              {imgUrl ? (
                <Image source={{ uri: imgUrl }} style={s.selectorIcon} resizeMode="cover" />
              ) : (
                <View style={[s.selectorIcon, { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="credit-card" size={16} color={colors.primary} />
                </View>
              )}
              <Text style={s.selectorName} numberOfLines={1}>{selectedCard.name}</Text>
            </>
          ) : (
            <>
              <View style={[s.selectorIcon, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="credit-card" size={16} color={colors.subtle} />
              </View>
              <Text style={s.selectorPlaceholder} numberOfLines={1}>Select a card</Text>
            </>
          )}
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </TouchableOpacity>

        {/* Fast / Slow pill segmented control */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'Fast' && s.modeBtnOn]}
            onPress={() => setMode('Fast')} activeOpacity={0.8}>
            <Text style={[s.modeTxt, mode === 'Fast' && s.modeTxtOn]}>Fast</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'Slow' && s.modeBtnOn]}
            onPress={() => setMode('Slow')} activeOpacity={0.8}>
            <Text style={[s.modeTxt, mode === 'Slow' && s.modeTxtOn]}>Slow</Text>
          </TouchableOpacity>
        </View>

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: tabBarClearance(insets.bottom) }}>

        {loading ? (
          <CardListSkeleton />
        ) : !selectedCard ? (
          <View style={s.emptyState}>
            <Feather name="credit-card" size={36} color={colors.subtle} />
            <Text style={s.emptyTxt}>Select a card above to view rates</Text>
          </View>
        ) : (
          <RateTable
            card={selectedCard}
            country={selectedCardCountry}
            mode={mode}
            onSell={handleSell}
          />
        )}
      </ScrollView>

    </View>
    </View>
    </FadeScreen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[4],
  },
  headerTitle: {
    flex: 1, fontSize: ms(typography.size.xl),
    fontWeight: typography.weight.extrabold, color: colors.dark, textAlign: 'center',
  },

  // Top row: 70% dropdown + 30% pill toggle
  topRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
  },
  selectorRow: {
    flex: 7,
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radius.xl, paddingHorizontal: spacing[3], height: 52,
    borderWidth: 1.5, borderColor: colors.border,
    ...shadow.sm,
  },
  selectorIcon:        { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  selectorName:        { flex: 1, fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.dark },
  selectorPlaceholder: { flex: 1, fontSize: ms(typography.size.lg), color: colors.subtle },

  // Pill segmented control — 30%
  modeToggle: {
    flex: 3,
    height: 52,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.border,
    padding: 4,
    ...shadow.sm,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.lg,
  },
  modeBtnOn: {
    backgroundColor: colors.primary,
  },
  modeTxt:   { fontSize: ms(typography.size.sm), fontWeight: typography.weight.bold, color: colors.muted },
  modeTxtOn: { color: '#fff' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: spacing[16], gap: spacing[3] },
  emptyTxt:   { fontSize: ms(typography.size.base), color: colors.muted },
})

const t = StyleSheet.create({
  wrap:       { backgroundColor: colors.background, paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  chipsScroll: { flexGrow: 0 },

  chip: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt:   { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.muted },
  chipTxtOn: { color: '#fff' },

  tableHead: {
    flexDirection: 'row', paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginBottom: spacing[3],
  },
  headTxt: { fontSize: ms(typography.size.base), fontWeight: typography.weight.extrabold, color: colors.primary },

  rateCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  rangeVal:  { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.primary },
  rangeType: { fontSize: ms(typography.size.sm), color: colors.primary, opacity: 0.6, marginTop: 2 },
  typeVal:   { fontSize: ms(typography.size.lg), color: colors.muted, lineHeight: ms(26), fontWeight: typography.weight.extrabold },
  rateVal:   { fontSize: ms(typography.size.lg), fontWeight: typography.weight.extrabold, color: colors.primaryDark, lineHeight: ms(26) },
  noRates:   { fontSize: ms(typography.size.lg), color: colors.muted, textAlign: 'center', paddingVertical: spacing[8] },
})
