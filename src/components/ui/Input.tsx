import React, { useState } from 'react'
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../../theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  leftIcon?: keyof typeof Feather.glyphMap
  leftContent?: React.ReactNode
  containerStyle?: ViewStyle
}

export default function Input({
  label, error, leftIcon, leftContent,
  containerStyle, ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[s.wrapper, containerStyle]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <View style={[
        s.inputWrap,
        focused && s.inputWrapFocused,
        !!error && s.inputWrapError,
      ]}>
        {leftContent}
        {leftIcon && !leftContent && (
          <Feather name={leftIcon} size={18} color={focused ? colors.primary : colors.subtle}
            style={{ marginRight: spacing[2] }} />
        )}
        <TextInput
          style={s.input}
          placeholderTextColor={colors.subtle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: { marginBottom: spacing[4] },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.body,
    marginBottom: spacing[1],
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4] - 2,
    ...shadow.sm,
  },
  inputWrapFocused: {
    borderColor: colors.borderFocus,
    ...shadow.md,
  },
  inputWrapError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.dark,
    paddingVertical: 0,
  },
  error: {
    fontSize: typography.size.xs,
    color: colors.error,
    marginTop: spacing[1],
  },
})
