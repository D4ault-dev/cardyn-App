import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native'
import { colors, typography, spacing, radius, shadow } from '../../theme'

type Variant = 'primary' | 'outline' | 'ghost'

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  fullWidth?: boolean
}

export default function Button({
  label, onPress, variant = 'primary',
  disabled, loading, style, fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      style={[
        s.base,
        fullWidth && s.full,
        variant === 'primary' && s.primary,
        variant === 'outline' && s.outline,
        variant === 'ghost'   && s.ghost,
        isDisabled && s.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.primary} size="small" />
      ) : (
        <Text style={[
          s.label,
          variant === 'primary' && s.labelPrimary,
          variant === 'outline' && s.labelOutline,
          variant === 'ghost'   && s.labelGhost,
          isDisabled && s.labelDisabled,
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  base: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  full: { alignSelf: 'stretch' },

  // Variants
  primary: {
    backgroundColor: colors.primary,
    ...shadow.primary(colors.primary),
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: colors.primaryLight,
  },
  disabled: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
    borderColor: colors.disabled,
  },

  // Labels
  label: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  labelPrimary: { color: colors.primaryText },
  labelOutline: { color: colors.primary },
  labelGhost:   { color: colors.primary },
  labelDisabled: { color: colors.disabledText },
})
