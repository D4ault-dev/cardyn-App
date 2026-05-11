import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, SectionList,
  Platform, Animated, Linking, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { colors, spacing, radius, typography, fw } from '../../theme'
import { ms, RF, AVATAR_MD } from '../../util/responsive'
import { Country } from '../../api/country'

// ── StepHeader ────────────────────────────────────────────────────────────────
export function StepHeader({
  onBack, progress, onHelp,
}: { onBack: () => void; progress: number; onHelp?: () => void }) {
  return (
    <>
      <View style={sh.bar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={sh.backBtn}>
            <Feather name="arrow-left" size={ms(18)} color={colors.dark} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHelp}>
          <Text style={sh.helpTxt}>Help</Text>
        </TouchableOpacity>
      </View>
      <View style={sh.track}>
        <View style={[sh.fill, { width: `${progress * 100}%` as any }]} />
      </View>
    </>
  )
}

const sh = StyleSheet.create({
  bar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  backBtn: { width: ms(38), height: ms(38), borderRadius: ms(19), backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  helpTxt: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.primary },
  track:   { height: 2, backgroundColor: '#F0F0F0', marginHorizontal: spacing[5], borderRadius: 1 },
  fill:    { height: 2, backgroundColor: colors.primary, borderRadius: 1 },
})

// ── SocialDivider ─────────────────────────────────────────────────────────────
export function SocialDivider() {
  return (
    <View style={sdv.row}>
      <View style={sdv.line} />
      <Text style={sdv.txt}>or continue with</Text>
      <View style={sdv.line} />
    </View>
  )
}

const sdv = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], marginVertical: spacing[4] },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  txt:  { fontSize: typography.size.xs, color: colors.subtle, fontWeight: typography.weight.medium, marginHorizontal: spacing[4] },
})

// ── SocialButton ──────────────────────────────────────────────────────────────
export function SocialButton({
  provider, loading, onPress,
}: { provider: 'google' | 'apple'; loading: boolean; onPress: () => void }) {
  const isGoogle = provider === 'google'
  // On iOS: always flex:1 so two buttons share the row equally
  // On Android: flex:1 too so button fills available width correctly
  const btnStyle = sbt.half  // flex:1 on both platforms
  return (
    <TouchableOpacity
      style={[sbt.btn, btnStyle]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : isGoogle ? (
        <Svg width={ms(20)} height={ms(20)} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </Svg>
      ) : (
        <Svg width={ms(20)} height={ms(20)} viewBox="0 0 24 24">
          <Path fill={colors.dark} d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </Svg>
      )}
      <Text style={sbt.txt}>{isGoogle ? 'Google' : 'Apple'}</Text>
    </TouchableOpacity>
  )
}

const sbt = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    paddingVertical: ms(13),
    // Android shadow for depth
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  half:      { flex: 1 },
  fullWidth: {},
  txt: { fontSize: RF(typography.size.md), fontWeight: fw('semibold') as any, color: colors.dark },
})

// ── CountryPickerModal ────────────────────────────────────────────────────────
export function CountryPickerModal({
  visible, countries, selected, onSelect, onClose, loading,
}: {
  visible: boolean
  countries: Country[]
  selected: Country
  onSelect: (c: Country) => void
  onClose: () => void
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const listRef = useRef<SectionList<Country>>(null)

  useEffect(() => { if (visible) setSearch('') }, [visible])

  const sections = useMemo(() => {
    const filtered = countries.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phonePrefix.includes(search.replace('+', ''))
    )
    if (search.length > 0) return [{ title: '', data: filtered }]
    const map: Record<string, Country[]> = {}
    filtered.forEach(c => {
      const letter = c.name[0].toUpperCase()
      if (!map[letter]) map[letter] = []
      map[letter].push(c)
    })
    return Object.keys(map).sort().map(letter => ({ title: letter, data: map[letter] }))
  }, [countries, search])

  const alphabet = sections.map(s => s.title).filter(Boolean)

  function scrollToLetter(letter: string) {
    const idx = sections.findIndex(s => s.title === letter)
    if (idx >= 0) listRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 0 })
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cp.root}>
        <View style={cp.header}>
          <Text style={cp.title}>Choose Country or Region</Text>
          <TouchableOpacity onPress={onClose} style={cp.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={ms(20)} color={colors.body} />
          </TouchableOpacity>
        </View>
        <View style={cp.searchWrap}>
          <Feather name="search" size={ms(15)} color={colors.subtle} />
          <TextInput
            style={cp.searchInput}
            placeholder="Search"
            placeholderTextColor={colors.subtle}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <SectionList
              ref={listRef}
              sections={sections}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled
              keyboardShouldPersistTaps="handled"
              renderSectionHeader={({ section }) =>
                section.title ? (
                  <View style={cp.sectionHeader}>
                    <Text style={cp.sectionLetter}>{section.title}</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = item.id === selected.id
                return (
                  <TouchableOpacity
                    style={[cp.row, isSelected && cp.rowSelected]}
                    onPress={() => { onSelect(item); onClose() }}
                    activeOpacity={0.6}>
                    <Text style={[cp.rowName, isSelected && cp.rowNameSelected]}>{item.name}</Text>
                    <Text style={[cp.rowCode, isSelected && cp.rowCodeSelected]}>+{item.phonePrefix}</Text>
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: ms(40) }}>
                  <Text style={{ color: colors.subtle, fontSize: typography.size.base }}>No results found</Text>
                </View>
              }
            />
            {search.length === 0 && (
              <View style={cp.alphaIndex} pointerEvents="box-none">
                {alphabet.map(letter => (
                  <TouchableOpacity key={letter} onPress={() => scrollToLetter(letter)}
                    hitSlop={{ top: 2, bottom: 2, left: 8, right: 8 }}>
                    <Text style={cp.alphaLetter}>{letter}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  )
}

const cp = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F2F2F7' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: spacing[5], paddingBottom: spacing[3], paddingHorizontal: spacing[5], backgroundColor: '#F2F2F7' },
  title:         { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark, flex: 1, textAlign: 'center' },
  closeBtn:      { position: 'absolute', right: spacing[5], top: spacing[5], width: ms(28), height: ms(28), borderRadius: ms(14), backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: ms(10), marginHorizontal: spacing[4], marginBottom: spacing[3], paddingHorizontal: spacing[3], paddingVertical: ms(10), gap: spacing[2] },
  searchInput:   { flex: 1, fontSize: typography.size.md, color: colors.dark, paddingVertical: 0 },
  sectionHeader: { backgroundColor: '#F2F2F7', paddingHorizontal: spacing[5], paddingVertical: ms(6) },
  sectionLetter: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: spacing[5], paddingVertical: ms(14), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  rowSelected:   { backgroundColor: '#EBF3FB' },
  rowName:       { flex: 1, fontSize: typography.size.md, color: colors.dark },
  rowNameSelected: { color: colors.primary, fontWeight: typography.weight.semibold },
  rowCode:       { fontSize: typography.size.md, color: colors.muted, fontWeight: typography.weight.medium },
  rowCodeSelected: { color: colors.primary },
  alphaIndex:    { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 1 },
  alphaLetter:   { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.semibold, paddingVertical: 1, paddingHorizontal: 4 },
})

// ── HelpModal ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { id: '1', q: 'How do I create an account?', a: 'Tap Sign Up, enter your name and phone number, verify with the OTP code, then set your password.' },
  { id: '2', q: 'I forgot my password', a: 'Tap "Reset password" on the login screen, enter your phone number, verify with OTP, then set a new password.' },
  { id: '3', q: 'How do I sell a gift card?', a: 'Tap "Sell Card" on the home screen, select your card type, enter the card details and amount, then submit.' },
  { id: '4', q: 'How long does payment take?', a: 'Payments are processed within 5–30 minutes after your card is verified.' },
  { id: '5', q: 'How do I withdraw my balance?', a: 'Go to Wallet → Withdraw, enter your bank details and amount, then confirm.' },
  { id: '6', q: 'What gift cards do you accept?', a: 'Apple iTunes, Steam, Amazon, Google Play, Razer Gold, Xbox, PlayStation, Walmart, Nordstrom, and more.' },
]

import { Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
const SCREEN_HEIGHT = Dimensions.get('screen').height

export function HelpModal({ visible, onClose, onChatSupport }: { visible: boolean; onClose: () => void; onChatSupport?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const insets = useSafeAreaInsets()

  const slideAnim    = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const backdropAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, tension: 68, friction: 13,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1, duration: 280, useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start(() => setMounted(false))
    }
  }, [visible])

  if (!mounted && !visible) return null

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[hm.overlay, { opacity: backdropAnim }]} pointerEvents="box-none">
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[hm.sheetWrap, { transform: [{ translateY: slideAnim }] }]}>
        <View style={hm.sheet}>
          <View style={hm.handle} />
          <View style={hm.header}>
            <Text style={hm.headerTitle}>Help</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={ms(22)} color={colors.dark} />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={[hm.content, { paddingBottom: Math.max(insets.bottom, 16) + spacing[6] }]}
            bounces={false}
          >
            <Text style={hm.title}>How can we help you?</Text>
            <Text style={hm.sectionLabel}>Frequently Asked Questions</Text>
            {FAQ_ITEMS.map((faq, i) => (
              <View key={faq.id} style={[hm.faqItem, i > 0 && hm.faqItemBorder]}>
                <TouchableOpacity style={hm.faqRow}
                  onPress={() => setExpanded(p => p === faq.id ? null : faq.id)} activeOpacity={0.7}>
                  <Text style={hm.faqQ}>{faq.q}</Text>
                  <Feather name={expanded === faq.id ? 'chevron-up' : 'chevron-down'} size={ms(17)} color={colors.primary} />
                </TouchableOpacity>
                {expanded === faq.id && (
                  <View style={hm.faqAns}>
                    <Text style={hm.faqAnsTxt}>{faq.a}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={hm.bottomFill} />
      </Animated.View>
    </Modal>
  )
}

const hm = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.75,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    overflow: 'hidden',
  },
  bottomFill: {
    backgroundColor: '#F5F5F5',
    height: 0,
  },
  handle:       { width: ms(40), height: ms(4), backgroundColor: colors.border, borderRadius: ms(2), alignSelf: 'center', marginTop: spacing[3], marginBottom: spacing[2] },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerTitle:  { fontSize: RF(typography.size.lg), fontWeight: typography.weight.bold, color: colors.dark },
  content:      { paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  title:        { fontSize: RF(typography.size['2xl']), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[5] },
  sectionLabel: { fontSize: RF(typography.size.xs), fontWeight: typography.weight.medium, color: colors.muted, marginBottom: spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: '#FFFFFF', borderRadius: radius.md, marginBottom: spacing[5], overflow: 'hidden' },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: spacing[4] },
  faqItem:      { backgroundColor: '#FFFFFF', borderRadius: radius.md, marginBottom: spacing[2], overflow: 'hidden' },
  faqItemBorder:{ marginTop: 0 },
  faqRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  faqQ:         { flex: 1, fontSize: RF(typography.size.base), fontWeight: typography.weight.semibold, color: colors.dark, marginRight: spacing[3] },
  faqAns:       { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
  faqAnsTxt:    { fontSize: RF(typography.size.base), color: colors.muted, lineHeight: ms(22) },
  supportCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[3] },
  supportIconWrap: { width: ms(40), height: ms(40), borderRadius: ms(20), backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  supportTitle:    { fontSize: RF(typography.size.base), fontWeight: typography.weight.semibold, color: colors.dark },
  supportSub:      { fontSize: RF(typography.size.sm), color: colors.muted, marginTop: 2 },
})
