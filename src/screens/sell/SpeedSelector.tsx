import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../../theme'

interface Props {
  selectedMode: 'Fast' | 'Slow'
  tooltipOpen: boolean
  onChangeMode: (mode: 'Fast' | 'Slow') => void
  onToggleTooltip: () => void
}

export function SpeedSelector({ selectedMode, tooltipOpen, onChangeMode, onToggleTooltip }: Props) {
  return (
    <View style={s.speedField}>
      <View style={s.speedLabelRow}>
        <Text style={s.speedLabel}>Speed</Text>
        <TouchableOpacity
          onPress={onToggleTooltip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}>
          <Feather name="info" size={15} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={s.speedToggle}>
        {(['Fast', 'Slow'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[s.speedBtn, selectedMode === m && s.speedBtnOn]}
            onPress={() => onChangeMode(m)}
            activeOpacity={0.8}>
            <Text style={[s.speedBtnTxt, selectedMode === m && s.speedBtnTxtOn]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tooltipOpen && (
        <View style={s.speedTooltip}>
          <View style={s.speedTooltipRow}>
            <View style={[s.speedTooltipDot, { backgroundColor: colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.speedTooltipTitle}>⚡ Fast</Text>
              <Text style={s.speedTooltipDesc}>
                Higher rate, processed within 5–15 minutes. Best for urgent trades.
              </Text>
            </View>
          </View>
          <View style={[s.speedTooltipRow, { marginTop: spacing[3] }]}>
            <View style={[s.speedTooltipDot, { backgroundColor: colors.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.speedTooltipTitle}>🐢 Slow</Text>
              <Text style={s.speedTooltipDesc}>
                Lower rate, processed within 1–24 hours. Best for non-urgent trades.
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  speedField: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  speedLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  speedLabel: {
    fontSize: typography.size.lg, color: colors.muted,
    fontWeight: typography.weight.extrabold,
  },
  speedToggle: { flexDirection: 'row', gap: spacing[2] },
  speedBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[1] + 2,
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  speedBtnOn:    { backgroundColor: colors.primary, borderColor: colors.primary },
  speedBtnTxt:   { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.body },
  speedBtnTxtOn: { color: '#fff' },
  speedTooltip: {
    marginTop: spacing[3],
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  speedTooltipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
  },
  speedTooltipDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
  },
  speedTooltipTitle: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold,
    color: colors.dark, marginBottom: 2,
  },
  speedTooltipDesc: {
    fontSize: typography.size.xs, color: colors.muted, lineHeight: 16,
  },
})
