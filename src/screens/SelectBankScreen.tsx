import { RF } from '../util/responsive'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../theme'
import { fetchNigerianBanks, NigerianBank } from '../api/wallet'

// Build alphabetical sections
function buildSections(banks: NigerianBank[]) {
  const map: Record<string, NigerianBank[]> = {}
  for (const b of banks) {
    const letter = b.name[0].toUpperCase()
    if (!map[letter]) map[letter] = []
    map[letter].push(b)
  }
  return Object.keys(map).sort().map(letter => ({ title: letter, data: map[letter] }))
}

// Generate initials avatar color from bank name
const AVATAR_COLORS = ['#E53935','#8E24AA','#1E88E5','#00897B','#F4511E','#6D4C41','#546E7A','#039BE5','#43A047','#FB8C00']
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function SelectBankScreen(props: StackScreenProps<RootStackParams, 'SelectBank'>) {
  const insets = useSafeAreaInsets()
  const [banks, setBanks]     = useState<NigerianBank[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const sectionListRef = useRef<SectionList>(null)

  useEffect(() => {
    fetchNigerianBanks().then(b => { setBanks(b); setLoading(false) })
  }, [])

  const filtered = search
    ? banks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : banks

  const sections = buildSections(filtered)
  const letters  = sections.map(s => s.title)

  function scrollToLetter(letter: string) {
    const idx = sections.findIndex(s => s.title === letter)
    if (idx >= 0) {
      sectionListRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 0 })
    }
  }

  function selectBank(bank: NigerianBank) {
    // Pass selected bank back via navigation params
    props.navigation.navigate('AddBank' as any, { bank: JSON.stringify(bank) })
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppHeader title="Select your bank" onBack={() => props.navigation.goBack()} />

      {/* Search */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search Bank"
          placeholderTextColor={colors.subtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Feather name="x-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[16] }} />
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Bank list */}
          <SectionList
            ref={sectionListRef}
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={item => `${item.code}_${item.name}`}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
            renderSectionHeader={({ section }) => (
              <View style={s.sectionHeader}>
                <Text style={s.sectionHeaderTxt}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item, index, section }) => {
              const isLast = index === section.data.length - 1
              const initials = item.name.slice(0, 2).toUpperCase()
              const bg = avatarColor(item.name)
              return (
                <TouchableOpacity
                  style={[s.bankRow, isLast && s.bankRowLast]}
                  onPress={() => selectBank(item)}
                  activeOpacity={0.7}>
                  {/* Real logo or bank building icon fallback */}
                  {item.logoUrl ? (
                    <Image
                      source={{ uri: item.logoUrl }}
                      style={s.bankLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Image
                      source={require('../../assets/bank-default.png')}
                      style={s.bankLogo}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={s.bankName}>{item.name}</Text>
                  <Feather name="chevron-right" size={16} color={colors.border} />
                </TouchableOpacity>
              )
            }}
          />

          {/* A-Z index — only show when not searching */}
          {!search && (
            <View style={s.alphaIndex}>
              {letters.map(l => (
                <TouchableOpacity key={l} onPress={() => scrollToLetter(l)} hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}>
                  <Text style={s.alphaLetter}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surface, borderRadius: radius.full,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    paddingHorizontal: spacing[4], height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },

  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing[5], paddingVertical: spacing[2],
  },
  sectionHeaderTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.muted },

  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3] + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bankRowLast: { borderBottomWidth: 0 },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.extrabold, color: '#fff' },
  bankLogo: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  bankIconWrap: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  bankName: { flex: 1, fontSize: typography.size.lg, color: colors.dark, fontWeight: typography.weight.extrabold },

  // A-Z index
  alphaIndex: {
    width: 20, justifyContent: 'center', alignItems: 'center',
    paddingVertical: spacing[4], gap: 2,
  },
  alphaLetter: { fontSize: RF(11), fontWeight: typography.weight.bold, color: colors.primary },
})
