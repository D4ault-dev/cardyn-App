/**
 * AppHeader — consistent header used across all app screens.
 * Back button: circle with primaryLight bg + arrow-left icon
 * Title: centered, xl, extrabold
 * Right slot: optional action button
 */
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, spacing, radius, typography } from '../theme'

interface Props {
  title: string
  onBack?: () => void
  rightIcon?: keyof typeof Feather.glyphMap
  onRight?: () => void
  rightLabel?: string
  /** Use light (white) text/icons — for screens with dark backgrounds */
  light?: boolean
}

export function AppHeader({ title, onBack, rightIcon, onRight, rightLabel, light }: Props) {
  const iconColor  = light ? '#FFFFFF' : colors.primary
  const titleColor = light ? '#FFFFFF' : colors.dark
  const btnBg      = light ? 'rgba(255,255,255,0.15)' : colors.primaryLight

  return (
    <View style={s.header}>
      {onBack ? (
        <TouchableOpacity style={[s.backBtn, { backgroundColor: btnBg }]} onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={20} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <View style={s.spacer} />
      )}

      <Text style={[s.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>

      {(rightIcon || rightLabel) && onRight ? (
        <TouchableOpacity style={s.rightBtn} onPress={onRight}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {rightIcon
            ? <Feather name={rightIcon} size={20} color={iconColor} />
            : <Text style={[s.rightLabel, { color: iconColor }]}>{rightLabel}</Text>
          }
        </TouchableOpacity>
      ) : (
        <View style={s.spacer} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 36 },
  title: {
    flex: 1,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    textAlign: 'center',
  },
  rightBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
})
