import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, TextInput, FlatList,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchCardCategories, CardCategory, resolveImageUrl } from '../api/cards'

const CARD_BG = [
  '#EEF4FF','#FFF4E6','#F0FFF4','#FFF0F6',
  '#F0F9FF','#FFFBEB','#F5F0FF','#F0FFFA',
]
const CARD_ACCENT = [
  '#1677FF','#FA8C16','#52C41A','#EB2F96',
  '#13C2C2','#FAAD14','#722ED1','#10B981',
]

export default function CardPickerScreen(props: StackScreenProps<RootStackParams, 'CardPicker'>) {
  const insets = useSafeAreaInsets()
  const [cards, setCards]     = useState<CardCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const selectedId = (props.route.params as any)?.selectedId ?? null

  useEffect(() => {
    fetchCardCategories().then(c => { setCards(c); setLoading(false) })
  }, [])

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  function select(card: CardCategory) {
    props.navigation.navigate('Tabs' as any, {
      screen: 'Wallet',
      params: { selectedCardId: card.id },
    } as any)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={colors.dark} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Select Card</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search gift cards..."
          placeholderTextColor={colors.subtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <Spinner style={{ marginTop: spacing[16] }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item, index }) => {
            const url    = resolveImageUrl(item.icon)
            const bg     = CARD_BG[index % CARD_BG.length]
            const accent = CARD_ACCENT[index % CARD_ACCENT.length]
            const active = selectedId === item.id

            return (
              <TouchableOpacity
                style={[s.row, active && s.rowOn]}
                onPress={() => select(item)}
                activeOpacity={0.7}>

                {/* Icon */}
                <View style={[s.iconWrap, { backgroundColor: bg }]}>
                  {url ? (
                    <Image source={{ uri: url }} style={s.iconImg} resizeMode="cover" />
                  ) : (
                    <Feather name="credit-card" size={22} color={accent} />
                  )}
                </View>

                {/* Text */}
                <View style={s.textWrap}>
                  <Text style={[s.name, active && { color: colors.primary }]}>{item.name}</Text>
                  {item.currencies?.length > 0 && (
                    <Text style={s.sub}>{item.currencies.join(' · ')}</Text>
                  )}
                </View>

                {/* Right side */}
                {active ? (
                  <View style={s.checkBadge}>
                    <Feather name="check" size={14} color="#fff" />
                  </View>
                ) : (
                  <Feather name="chevron-right" size={18} color={colors.border} />
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  headerSub: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surface, borderRadius: radius.full,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    paddingHorizontal: spacing[4], height: 46,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },

  separator: {
    height: 1, backgroundColor: colors.background,
    marginLeft: spacing[5] + 44 + spacing[3],
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  rowOn: { backgroundColor: colors.primaryLight },

  iconWrap: {
    width: 44, height: 44, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  iconImg: { width: 44, height: 44 },

  textWrap: { flex: 1, gap: 3 },
  name: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
  },
  sub: {
    fontSize: typography.size.sm,
    color: colors.muted,
  },

  checkBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
})
