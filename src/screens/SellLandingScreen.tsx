/**
 * SellLandingScreen — shown when user taps the center FAB in the tab bar.
 * A clean card picker that lets users quickly select a gift card to sell.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'

const { width: W } = Dimensions.get('window')
const CARD_W = (W - spacing[4] * 2 - spacing[3]) / 2

const CARD_BG = [
  '#E8F5E9','#FFF3E0','#E3F2FD','#FCE4EC',
  '#F3E5F5','#E0F7FA','#FFF8E1','#E8EAF6',
]

export default function SellLandingScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const [cards,     setCards]     = useState<CardCategory[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [search,    setSearch]    = useState('')

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchCardCategories(force)
      setCards(data)
    } catch { /* keep */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [])

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(card: CardCategory) {
    props.navigation.navigate('SellCard' as any, { cardId: card.id } as any)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Sell Gift Cards</Text>
        <Text style={s.sub}>Select a card to get started</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={colors.muted} style={{ marginRight: spacing[2] }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search gift cards..."
          placeholderTextColor={colors.subtle}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing[3] }}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: 120, gap: spacing[3] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true) }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="credit-card" size={40} color={colors.border} />
              <Text style={s.emptyTxt}>No cards found</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const imgUrl = resolveImageUrl(item.icon)
            const bg = CARD_BG[index % CARD_BG.length]
            return (
              <TouchableOpacity
                style={[s.card, { width: CARD_W }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.82}
              >
                <View style={[s.iconWrap, { backgroundColor: bg }]}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={s.icon} resizeMode="cover" />
                  ) : (
                    <Feather name="credit-card" size={28} color={colors.muted} />
                  )}
                </View>
                <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                {item.rate ? (
                  <Text style={s.cardRate}>
                    ₦{(item.rate).toLocaleString('en-NG', { minimumFractionDigits: 0 })} / $1
                  </Text>
                ) : null}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  title:  {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  sub:    {
    fontSize: typography.size.sm,
    color: colors.muted,
    marginTop: 3,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4], height: 48,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1, fontSize: typography.size.base, color: colors.dark,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:    { alignItems: 'center', paddingTop: spacing[12], gap: spacing[3] },
  emptyTxt: { fontSize: typography.size.base, color: colors.muted },

  // Card grid item
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    ...shadow.sm,
  },
  iconWrap: {
    width: 72, height: 72,
    borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  icon:     { width: 72, height: 72 },
  cardName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.dark,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardRate: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[1],
  },
})
