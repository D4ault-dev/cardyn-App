/**
 * WithdrawPinSetupModal
 * Shows when user tries to withdraw for the first time without a PIN set.
 * Lets them set a 6-digit withdrawal PIN inline.
 */
import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void   // called after PIN is set — proceed with withdrawal
}

export function WithdrawPinSetupModal({ visible, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets()
  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const confirmRef = useRef<TextInput>(null)

  function reset() {
    setPin(''); setConfirm(''); setError(null)
  }

  async function handleSet() {
    if (pin.length !== 6) { setError('PIN must be exactly 6 digits'); return }
    if (pin !== confirm)  { setError('PINs do not match'); return }
    setLoading(true)
    setError(null)
    try {
      await client.put('/tuka/user/withdrawPassword', {
        newPassword: pin,
        oldPassword: '',   // empty = first-time setup
      })
      reset()
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Failed to set PIN. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Feather name="lock" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text style={s.title}>Set Withdrawal PIN</Text>
              <Text style={s.sub}>Required before your first withdrawal</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            {/* PIN input */}
            <Text style={s.label}>Enter 6-digit PIN</Text>
            <TextInput
              style={s.input}
              placeholder="••••••"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pin}
              onChangeText={v => { setPin(v); setError(null) }}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            {/* Confirm PIN */}
            <Text style={s.label}>Confirm PIN</Text>
            <TextInput
              ref={confirmRef}
              style={s.input}
              placeholder="••••••"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={confirm}
              onChangeText={v => { setConfirm(v); setError(null) }}
              returnKeyType="done"
              onSubmitEditing={handleSet}
            />

            {/* Error */}
            {error ? (
              <View style={s.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            ) : null}

            {/* Hint */}
            <Text style={s.hint}>
              This PIN protects your withdrawals. You'll need it every time you withdraw funds.
            </Text>

            {/* Submit */}
            <TouchableOpacity
              style={[s.btn, (loading || pin.length < 6 || confirm.length < 6) && s.btnOff]}
              onPress={handleSet}
              disabled={loading || pin.length < 6 || confirm.length < 6}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnTxt}>Set PIN & Continue</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingBottom: spacing[10],
    ...shadow.lg,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  sub:   { fontSize: typography.size.sm, color: colors.muted, marginTop: 2 },
  body:  { paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  label: {
    fontSize: typography.size.sm, fontWeight: typography.weight.semibold,
    color: colors.body, marginBottom: spacing[2],
  },
  input: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], height: 56,
    fontSize: typography.size['2xl'], color: colors.dark,
    letterSpacing: 8, marginBottom: spacing[4],
  },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.errorLight, borderRadius: radius.lg,
    padding: spacing[3], marginBottom: spacing[3],
  },
  errorTxt: { fontSize: typography.size.sm, color: colors.error, flex: 1 },
  hint: {
    fontSize: typography.size.sm, color: colors.muted,
    lineHeight: 20, marginBottom: spacing[5],
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  btnOff:  { backgroundColor: colors.disabled },
  btnTxt:  { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})
