/**
 * BottomBackButton — floating "Back" pill shown at the bottom of screens.
 * Helps users who don't know about swipe-back gesture.
 * Place inside the screen's root View, below any ScrollView.
 */
import React from 'react'
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, typography, spacing, radius } from '../theme'

interface Props {
  onPress: () => void
  label?: string
  /** For dark-background screens — uses light pill styling */
  dark?: boolean
}

export function BottomBackButton({ onPress, label = 'Back', dark = false }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <TouchableOpacity
        style={[s.pill, dark && s.pillDark]}
        onPress={onPress}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
      >
        <Text style={[s.label, dark && s.labelDark]}>{label}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing[2],
    pointerEvents: 'box-none' as any,
  },
  pill: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.dark,
  },
  labelDark: {
    color: '#fff',
  },
})
