import { RF } from '../util/responsive'
import { getStatusBarHeight } from '../util/statusBar'
/**
 * TransactionPinPad
 * Professional 4-digit PIN pad for authorizing withdrawals.
 * Matches the fintech reference design: title, 4 dot indicators, custom numpad.
 */
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, ActivityIndicator, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius, typography } from '../theme'

const PIN_LENGTH = 4

interface Props {
  visible: boolean
  title?: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  onComplete: (pin: string) => void
  onClose: () => void
}

export function TransactionPinPad({
  visible, title = 'Enter Transaction Pin',
  subtitle = 'To complete this transaction, enter your transaction PIN',
  loading = false, error = null,
  onComplete, onClose,
}: Props) {
  const [pin, setPin] = useState('')
  const shakeAnim = new Animated.Value(0)

  // Reset PIN when modal opens
  useEffect(() => {
    if (visible) setPin('')
  }, [visible])

  // Shake on error
  useEffect(() => {
    if (error) {
      setPin('')
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start()
    }
  }, [error])

  function pressDigit(d: string) {
    if (pin.length >= PIN_LENGTH || loading) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      // Small delay so user sees the last dot fill
      setTimeout(() => onComplete(next), 120)
    }
  }

  function pressDelete() {
    if (loading) return
    setPin(p => p.slice(0, -1))
  }

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ]

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[st.root, { paddingTop: getStatusBarHeight() }]}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} style={st.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Authorize Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Title + subtitle */}
        <View style={st.titleWrap}>
          <Text style={st.title}>{title}</Text>
          <Text style={st.subtitle}>{subtitle}</Text>
        </View>

        {/* PIN dots */}
        <Animated.View style={[st.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[st.dot, i < pin.length && st.dotFilled]}>
              {i < pin.length && <View style={st.dotInner} />}
            </View>
          ))}
        </Animated.View>

        {/* Error */}
        {!!error && (
          <Text style={st.errorTxt}>{error}</Text>
        )}

        {/* Loading */}
        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing[4] }} />
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Numpad */}
        <View style={st.numpad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={st.numRow}>
              {row.map((key, ki) => {
                if (!key) return <View key={ki} style={st.numKey} />
                if (key === 'del') return (
                  <TouchableOpacity key={ki} style={st.numKey} onPress={pressDelete} activeOpacity={0.6}>
                    <Feather name="delete" size={22} color={colors.dark} />
                  </TouchableOpacity>
                )
                return (
                  <TouchableOpacity key={ki} style={st.numKey} onPress={() => pressDigit(key)} activeOpacity={0.6}>
                    <Text style={st.numTxt}>{key}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  )
}

const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F2F2F7' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: RF(17), fontWeight: '600', color: colors.dark },
  titleWrap:  { alignItems: 'center', paddingTop: spacing[8], paddingHorizontal: spacing[6] },
  title:      { fontSize: RF(22), fontWeight: '800', color: colors.dark, marginBottom: spacing[2], textAlign: 'center' },
  subtitle:   { fontSize: RF(13), color: colors.muted, textAlign: 'center', lineHeight: 20 },
  dotsRow:    { flexDirection: 'row', justifyContent: 'center', gap: spacing[4], marginTop: spacing[8] },
  dot:        {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled:  { borderColor: colors.primary, backgroundColor: '#EBF3FB' },
  dotInner:   { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  errorTxt:   { textAlign: 'center', color: colors.error, fontSize: RF(13), marginTop: spacing[3] },
  numpad:     { paddingHorizontal: spacing[6], paddingBottom: spacing[6] },
  numRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  numKey:     { width: 80, height: 72, alignItems: 'center', justifyContent: 'center' },
  numTxt:     { fontSize: RF(28), fontWeight: '400', color: colors.dark },
})
