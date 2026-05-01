import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image,
  ActivityIndicator,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { resolveImageUrl } from '../api/cards'

// ─── Row ──────────────────────────────────────────────────────────────────────
function Row({
  label, value, sub, onPress, danger = false, last = false,
}: {
  label: string; value?: string; sub?: string
  onPress?: () => void; danger?: boolean; last?: boolean
}) {
  return (
    <TouchableOpacity
      style={[r.row, !last && r.border]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={[r.label, danger && { color: '#EF4444' }]}>{label}</Text>
        {sub ? <Text style={r.sub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={r.value} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Feather name="chevron-right" size={16} color={colors.subtle} style={{ marginLeft: spacing[2] }} /> : null}
    </TouchableOpacity>
  )
}

const r = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4] + 2,
    minHeight: 56,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.dark },
  sub:   { fontSize: typography.size.xs, color: colors.muted, marginTop: 3, lineHeight: 16 },
  value: { fontSize: typography.size.sm, color: colors.muted, fontWeight: typography.weight.medium, maxWidth: 160 },
})

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AccountSettingsScreen(props: StackScreenProps<RootStackParams, 'AccountSettings'>) {
  const insets = useSafeAreaInsets()
  const { user, logout } = useAuth()
  const u = user.isPresent() ? user.getOrThrow() : null

  const [loading, setLoading]   = useState(true)
  const [name, setName]         = useState(u?.name || '')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [avatar, setAvatar]     = useState<string | null>(null)
  const [hasWithdrawPw, setHasWithdrawPw] = useState(false)

  const initials = name
    ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // Fetch fresh data from /tuka/user/me (source of truth — reads from DB)
  const refreshProfile = useCallback(async () => {
    try {
      const res = await client.get('/tuka/user/me')
      const d   = res.data?.data || res.data
      setPhone(d.phone  || '')
      setEmail(d.email  || '')
      // Prefer nickName (sys_user) for display name, fall back to realName
      setName(d.nickName || d.realName || u?.name || '')
      setAvatar(d.avatar || null)
      setHasWithdrawPw(!!d.hasWithdrawPassword)
    } catch {
      // Fallback to /getInfo if /me fails
      try {
        const res = await client.get('/getInfo')
        const info = res.data?.user || res.data
        setPhone(info.phonenumber || '')
        setEmail(info.email || '')
        setName(info.nickName && info.nickName !== info.userName ? info.nickName : info.userName || '')
        setAvatar(info.avatar ? resolveImageUrl(info.avatar) : null)
      } catch { /* keep existing */ }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refreshProfile() }, [])

  // Re-sync every time we come back from a sub-screen
  useEffect(() => {
    const unsub = props.navigation.addListener('focus', refreshProfile)
    return unsub
  }, [props.navigation, refreshProfile])

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ])
  }

  const avatarUri = avatar ? resolveImageUrl(avatar) : null

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      <AppHeader title="Account Settings" onBack={() => props.navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: spacing[5], paddingBottom: Math.max(insets.bottom, 16) + 40 }}>

          {/* ── Card 1: Avatar + name — tap to edit profile ── */}
          <View style={s.card}>
            <TouchableOpacity
              style={s.profileRow}
              onPress={() => props.navigation.navigate('ProfileEdit')}
              activeOpacity={0.65}
            >
              {/* Avatar */}
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} resizeMode="cover" />
              ) : (
                <Image source={require('../../assets/default-avatar.png')} style={s.avatarImg} resizeMode="cover" />
              )}
              <Text style={[r.label, { marginLeft: spacing[3], flex: 1 }]}>
                {name || u?.uid || '—'}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.subtle} />
            </TouchableOpacity>
          </View>

          {/* ── Card 2: Contact + passwords ── */}
          <View style={[s.card, { marginTop: spacing[4] }]}>
            <Row
              label="Phone number"
              value={phone || '—'}
              sub={!phone ? 'Tap to bind a phone number' : undefined}
              onPress={() => {
                if (!phone) {
                  // Social user — navigate to bind phone screen
                  props.navigation.navigate('BindPhone' as any)
                } else {
                  props.navigation.navigate('VerifyIdentity', { next: 'ModifyPassword', type: 'login' })
                }
              }}
            />
            <Row
              label="Email"
              value={email || '—'}
              onPress={() => props.navigation.navigate('UpdateEmail')}
            />
            <Row
              label="Withdrawal Password"
              value={hasWithdrawPw ? 'Change / Reset' : 'Not set'}
              sub={hasWithdrawPw ? 'Tap to change or reset your 4-digit PIN' : 'Set a PIN to authorize withdrawals'}
              onPress={() => props.navigation.navigate('WithdrawPassword', { hasPin: hasWithdrawPw } as any)}
            />
            <Row
              label="Modify Password"
              onPress={() => props.navigation.navigate('ModifyPassword', { type: 'login' })}
              last
            />
          </View>

          {/* ── Card 3: Security ── */}
          <View style={[s.card, { marginTop: spacing[4] }]}>
            <Row
              label="Security"
              sub="After enabling Biometrics, it will be prioritized for high-security operations."
              onPress={() => props.navigation.navigate('SecuritySettings')}
              last
            />
          </View>

          {/* ── Card 4: Account Deletion ── */}
          <View style={[s.card, { marginTop: spacing[4] }]}>
            <Row
              label="Account Deletion"
              onPress={() => props.navigation.navigate('AccountDeletion')}
              danger
              last
            />
          </View>

        </ScrollView>
      )}

    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], overflow: 'hidden', ...shadow.sm,
  },

  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    minHeight: 64,
  },

  avatarImg: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.primary,
  },
})
