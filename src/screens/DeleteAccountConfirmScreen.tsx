import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { apiGetUserInfo } from '../api/auth'
import { useToast } from '../util/useToast'
import { ms } from '../util/responsive'

export default function DeleteAccountConfirmScreen(
  props: StackScreenProps<RootStackParams, 'DeleteAccountConfirm'>
) {
  const insets = useSafeAreaInsets()
  const { logout } = useAuth()
  const { showError, Toast } = useToast()

  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [isSocialUser, setIsSocialUser] = useState(false)
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // OTP state for social users
  const [otpCode, setOtpCode]     = useState('')
  const [pinId, setPinId]         = useState('')
  const [sending, setSending]     = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiGetUserInfo().then(info => {
      const raw = info.phonenumber || info.userName || ''
      const masked = raw.length > 8 ? raw.slice(0, 4) + '****' + raw.slice(-4) : raw
      setPhone(masked)
      setEmail(info.email || '')
      // Social users have username starting with g_ or a_
      const uname = info.userName || ''
      setIsSocialUser(uname.startsWith('g_') || uname.startsWith('a_'))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0 }
        return c - 1
      }), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  async function sendOtp() {
    const contact = phone.replace(/\*/g, '') || email
    if (!contact) { showError('No phone or email on file to verify'); return }
    setSending(true)
    try {
      if (email && !phone.replace(/\*/g, '')) {
        const res = await client.post('/tuka/otp/sendEmail', { email })
        setPinId(res.data?.data?.pinId || email)
      } else {
        // Get real phone from /me
        const me = await client.get('/tuka/user/me')
        const realPhone = me.data?.data?.phone || ''
        if (!realPhone) { showError('No phone number on file'); setSending(false); return }
        const res = await client.post('/tuka/otp/send', { phone: realPhone })
        setPinId(res.data?.data?.pinId || '')
      }
      setCountdown(60)
    } catch (e: any) {
      showError(e.message || 'Failed to send code')
    } finally { setSending(false) }
  }

  const canDelete = isSocialUser
    ? (otpCode.length >= 4 && !!pinId && !verifying && !deleting)
    : (password.length >= 6 && !verifying && !deleting)

  async function handleDelete() {
    setVerifying(true)
    try {
      if (isSocialUser) {
        // Verify OTP
        await client.post('/tuka/otp/verify', { pinId, pin: otpCode })
      } else {
        // Verify password
        await client.post('/tuka/user/verifyLoginPassword', { password })
      }
      setConfirmOpen(true)
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.message || (isSocialUser ? 'Invalid code' : 'Incorrect password')
      showError(msg)
    } finally { setVerifying(false) }
  }

  async function handleConfirmedDelete() {
    setConfirmOpen(false)
    setDeleting(true)
    try {
      const res = await client.delete('/tuka/user/deleteAccount')
      if (res.data?.code !== 200) throw new Error(res.data?.msg || 'Deletion failed')
      await logout()
    } catch (e: any) {
      setDeleting(false)
      showError(e?.response?.data?.msg || e?.message || 'Could not delete account.')
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Delete Account</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          <View style={s.card}>
            {/* Show phone/email */}
            <View style={[s.fieldRow, s.border]}>
              <Text style={s.phoneText}>{phone || email || '—'}</Text>
            </View>

            {isSocialUser ? (
              /* Social user — OTP verification */
              <View style={s.fieldRow}>
                <Feather name="shield" size={18} color={colors.muted} style={{ marginRight: spacing[3] }} />
                <TextInput
                  style={s.input}
                  placeholder="Verification code"
                  placeholderTextColor={colors.subtle}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity onPress={sendOtp} disabled={sending || countdown > 0} activeOpacity={0.7}>
                  {sending
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Text style={[s.sendTxt, countdown > 0 && { color: colors.muted }]}>
                        {countdown > 0 ? `${countdown}s` : 'Send'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              /* Regular user — password */
              <View style={s.fieldRow}>
                <TextInput
                  style={s.input}
                  placeholder="Please enter password"
                  placeholderTextColor={colors.subtle}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={canDelete ? handleDelete : undefined}
                />
                <TouchableOpacity onPress={() => setShowPw(p => !p)} style={s.eyeBtn} activeOpacity={0.7}>
                  <Feather name={showPw ? 'eye' : 'eye-off'} size={18} color={colors.subtle} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.deleteBtn, !canDelete && s.deleteBtnOff]}
            onPress={handleDelete}
            disabled={!canDelete}
            activeOpacity={0.85}>
            {verifying || deleting
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.deleteBtnTxt, !canDelete && s.deleteBtnTxtOff]}>Delete</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Final confirmation popup */}
      <Modal visible={confirmOpen} transparent animationType="fade">
        <View style={m.overlay}>
          <View style={m.card}>
            <View style={m.iconCircle}>
              <Feather name="alert-triangle" size={28} color="#F05A5A" />
            </View>
            <Text style={m.title}>Delete Account?</Text>
            <Text style={m.body}>
              This action is permanent and cannot be undone. All your data, balance, and transaction history will be lost.
            </Text>
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setConfirmOpen(false)} activeOpacity={0.8}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.deleteBtn} onPress={handleConfirmedDelete} activeOpacity={0.85}>
                <Text style={m.deleteTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {Toast}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  body: { flex: 1, paddingTop: spacing[5] },
  card: {
    backgroundColor: colors.surface, marginHorizontal: spacing[4],
    borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], minHeight: 58,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  phoneText: {
    flex: 1, fontSize: typography.size.base,
    fontWeight: typography.weight.medium, color: colors.dark,
  },
  input: {
    flex: 1, fontSize: typography.size.base,
    color: colors.dark, paddingVertical: spacing[4],
  },
  eyeBtn: { padding: spacing[2] },
  sendTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  bottomBar: {
    paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[3],
  },
  deleteBtn: {
    backgroundColor: '#F05A5A', borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  deleteBtnOff: { backgroundColor: '#E0E0E0' },
  deleteBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
  deleteBtnTxtOff: { color: '#AAAAAA' },
})

// ── Confirmation modal styles ─────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    width: '100%',
    alignItems: 'center',
    ...shadow.sm,
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFF0F0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[3], textAlign: 'center',
  },
  body: {
    fontSize: typography.size.sm, color: colors.muted,
    textAlign: 'center', lineHeight: 20,
    marginBottom: spacing[6],
  },
  btnRow: {
    flexDirection: 'row', gap: spacing[3], width: '100%',
  },
  cancelBtn: {
    flex: 1, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    paddingVertical: spacing[3] + 2, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  cancelTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark,
  },
  deleteBtn: {
    flex: 1, borderRadius: radius.full,
    backgroundColor: '#F05A5A',
    paddingVertical: spacing[3] + 2, alignItems: 'center',
  },
  deleteTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
})
