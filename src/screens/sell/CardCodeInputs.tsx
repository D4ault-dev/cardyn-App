import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../../theme'
import { RF } from '../../util/responsive'

interface Props {
  cardCodes: string[]
  quantity: number
  inputFocusIdx: number
  attempted: boolean
  codeRefs: React.MutableRefObject<(TextInput | null)[]>
  onChangeCode: (idx: number, value: string) => void
  onClearCode: (idx: number) => void
  onFocus: (idx: number) => void
  onBlur: () => void
  scrollRef?: React.RefObject<ScrollView | null>
  onScanPhoto?: () => void
  ocrScanning?: boolean
}

export function CardCodeInputs({
  cardCodes, quantity, inputFocusIdx, attempted,
  codeRefs, onChangeCode, onClearCode, onFocus, onBlur, scrollRef,
  onScanPhoto, ocrScanning,
}: Props) {
  const codesFilledCount = cardCodes.filter(c => c.trim().length > 0).length
  const allFilled = codesFilledCount === quantity

  function handleFocus(idx: number) {
    onFocus(idx)
    // Scroll down so the focused input is visible above the keyboard
    setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 300)
  }

  return (
    <View style={s.codesSection}>
      {/* Header */}
      <View style={s.codesSectionHeader}>
        <Text style={s.codesSectionTitle}>Card Codes</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* OCR scan button */}
          {onScanPhoto && (
            <TouchableOpacity
              onPress={onScanPhoto}
              disabled={ocrScanning}
              style={[s.scanPhotoBtn, ocrScanning && { opacity: 0.5 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}>
              <Feather name="camera" size={14} color={colors.primary} />
              <Text style={s.scanPhotoBtnTxt}>{ocrScanning ? 'Reading...' : 'Scan Photo'}</Text>
            </TouchableOpacity>
          )}
          <View style={s.codesProgress}>
            <Text style={[s.codesSectionSub, allFilled && { color: colors.success }]}>
              {codesFilledCount}/{quantity} filled
            </Text>
            {allFilled && (
              <Feather name="check-circle" size={14} color={colors.success} style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>

      {/* Code inputs */}
      {cardCodes.map((code, idx) => (
        <View key={idx} style={s.codeInputRow}>
          <View style={[
            s.codeInputWrap,
            code.trim().length > 0 && s.codeInputWrapFilled,
            inputFocusIdx === idx && s.codeInputWrapFocused,
          ]}>
            <View style={[s.codeInputNumWrap, code.trim().length > 0 && s.codeInputNumWrapFilled]}>
              <Text style={[s.codeInputNum, code.trim().length > 0 && s.codeInputNumFilled]}>
                {idx + 1}
              </Text>
            </View>
            <TextInput
              ref={el => { codeRefs.current[idx] = el }}
              style={s.codeInput}
              placeholder={`Code ${idx + 1}`}
              placeholderTextColor={colors.subtle}
              value={code}
              onChangeText={v => onChangeCode(idx, v)}
              maxLength={30}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType={idx < cardCodes.length - 1 ? 'next' : 'done'}
              onFocus={() => handleFocus(idx)}
              onBlur={onBlur}
              onSubmitEditing={() => {
                if (idx < cardCodes.length - 1) {
                  codeRefs.current[idx + 1]?.focus()
                }
              }}
              blurOnSubmit={idx === cardCodes.length - 1}
            />
            {code.length > 0 && (
              <TouchableOpacity
                onPress={() => onClearCode(idx)}
                style={s.codeClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[s.codeCharCount, code.length >= 28 && { color: colors.warning }]}>
            {code.length}/30
          </Text>
        </View>
      ))}

      {/* Inline error */}
      {attempted && cardCodes.every(c => !c.trim()) && (
        <View style={s.inlineError}>
          <Feather name="alert-circle" size={13} color={colors.error} />
          <Text style={s.inlineErrorTxt}>Enter at least one card code to continue</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  codesSection: { marginBottom: spacing[3] },
  codesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[2], paddingHorizontal: spacing[1],
  },
  codesSectionTitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark,
  },
  codesSectionSub: { fontSize: typography.size.sm, color: colors.muted },
  codesProgress:   { flexDirection: 'row', alignItems: 'center' },
  scanPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  scanPhotoBtnTxt: { fontSize: typography.size.xs, color: colors.primary, fontWeight: '600' as any },
  codeInputRow:    { marginBottom: spacing[2] },
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
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing[3], flexShrink: 0,
  },
  codeInputNumWrapFilled: { backgroundColor: colors.success, borderColor: colors.success },
  codeInputNum:       { fontSize: RF(11), fontWeight: typography.weight.bold, color: colors.muted },
  codeInputNumFilled: { color: '#fff' },
  codeInput: {
    flex: 1, fontSize: RF(15), color: colors.dark,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1.5, paddingVertical: 0,
  },
  codeClearBtn:  { padding: spacing[1], marginLeft: spacing[1] },
  codeCharCount: { fontSize: RF(10), color: colors.subtle, textAlign: 'right', marginTop: 3, marginRight: spacing[1] },
  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    marginBottom: spacing[2],
  },
  inlineErrorTxt: {
    fontSize: typography.size.xs, color: colors.error,
    fontWeight: typography.weight.medium, flex: 1,
  },
})
