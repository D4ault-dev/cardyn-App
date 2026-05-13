import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { useToast } from '../util/useToast'
import { ms } from '../util/responsive'

// ── Password field ────────────────────────────────────────────────────────────
function PwField({
  placeholder, value, onChange, last = false,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  last?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <View style={[f.wrap, !last && f.border]}>
      <TextInput
        style={f.input}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        secureTextEntry={!show}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={() => setShow(p => !p)} style={f.eyeBtn} activeOpacity={0.7}>
        <Feather name={show ? 'eye' : 'eye-off'} size={18} color={colors.subtle} />
      </TouchableOpacity>
    </View>
  )
}

const f = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], minHeight: 58,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  input: {
    flex: 1, fontSize: typography.size.lg,
    color: colors.dark, paddingVertical: spacing[4],
    fontWeight: typography.weight.extrabold,
  },
  eyeBtn: { padding: spacing[2] },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ModifyPasswordScreen(props: StackScreenProps<RootStackParams, 'ModifyPassword'>) {
  const insets = useSafeAreaInsets()
  const { type } = props.route.params
  const isWithdraw = type === 'withdraw'

  const [oldPw, setOldPw]         = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving]       = useState(false)

  const { showSuccess, showError, Toast } = useToast()

  const canConfirm = oldPw.length > 0 && newPw.length >= 6 && confirmPw.length >= 6 && !saving

  async function handleConfirm() {
    if (newPw !== confirmPw) {
      showError('New passwords do not match')
      return
    }
    if (newPw.length < 6) {
      showError('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      if (isWithdraw) {
        await client.put('/tuka/user/withdrawPassword', { oldPassword: oldPw, newPassword: newPw })
      } else {
        await client.put('/system/user/profile/updatePwd', { oldPassword: oldPw, newPassword: newPw })
      }
      setOldPw(''); setNewPw(''); setConfirmPw('')
      showSuccess('Password updated')
      setTimeout(() => props.navigation.goBack(), 2200)
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.response?.data?.message || e?.message || 'Update failed'
      showError(msg)
    } finally { setSaving(false) }
  }

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>

      <AppHeader title={isWithdraw ? 'Withdrawal Password' : 'Modify Password'} onBack={() => props.navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>

          {/* Old password — standalone card */}
          <View style={s.card}>
            <PwField
              placeholder="Please enter old password"
              value={oldPw}
              onChange={setOldPw}
              last
            />
          </View>

          {/* New + Confirm — grouped card */}
          <View style={[s.card, { marginTop: spacing[4] }]}>
            <PwField
              placeholder="Please enter new password"
              value={newPw}
              onChange={setNewPw}
            />
            <PwField
              placeholder="Please confirm password"
              value={confirmPw}
              onChange={setConfirmPw}
              last
            />
          </View>

        </View>

        {/* Confirm button */}
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + spacing[3] }]}>
          <TouchableOpacity
            style={[s.confirmBtn, !canConfirm && s.confirmBtnOff]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.confirmBtnTxt, !canConfirm && s.confirmBtnTxtOff]}>Confirm</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Toast */}
      {Toast}

    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  body: { flex: 1, paddingTop: spacing[5] },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },

  bottomBar: {
    paddingHorizontal: spacing[5], paddingTop: spacing[3],
  },
  confirmBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  confirmBtnOff: { backgroundColor: '#E0E0E0' },
  confirmBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
  confirmBtnTxtOff: { color: '#AAAAAA' },
})
