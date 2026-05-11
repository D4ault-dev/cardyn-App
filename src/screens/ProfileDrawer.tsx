import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Animated, Dimensions, ScrollView, Modal, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { fetchWalletInfo } from '../api/wallet'
import { colors, typography, spacing, radius, shadow } from '../theme'

const { width: W } = Dimensions.get('window')
const DRAWER_W = W * 0.80

type Props = {
  visible: boolean
  onClose: () => void
  navigation: any
}

export default function ProfileDrawer({ visible, onClose, navigation }: Props) {
  const { user, logout } = useAuth()
  const slideAnim = useRef(new Animated.Value(DRAWER_W)).current
  const [totalSales, setTotalSales] = useState(0)

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 70, friction: 12,
      }).start()
      if (user.isPresent()) {
        fetchWalletInfo().then(w => setTotalSales(w.totalSales)).catch(() => {})
      }
    } else {
      Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 200, useNativeDriver: true }).start()
    }
  }, [visible])

  function close() {
    Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 200, useNativeDriver: true }).start(onClose)
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { close(); setTimeout(logout, 250) } },
    ])
  }

  const u        = user.isPresent() ? user.getOrThrow() : null
  const initials = u ? u.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : '?'

  type Row = { icon: React.ComponentProps<typeof Feather>['name']; label: string; sub?: string; onPress?: () => void }

  const rows: Row[] = [
    {
      icon: 'credit-card', label: 'Wallet',
      onPress: () => { close(); setTimeout(() => navigation.navigate('Withdraw'), 250) },
    },
    { icon: 'user', label: 'Account Settings' },
    { icon: 'book-open', label: 'Trading Guidelines' },
    { icon: 'refresh-cw', label: 'Version update', sub: 'V1.0.0' },
  ]

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={s.root}>
        {/* Dim overlay */}
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close} />

        {/* Drawer */}
        <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={{ flex: 1, paddingTop: Platform.OS === 'android' ? getStatusBarHeight() : 0 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[8] }}>

              {/* User row */}
              <View style={s.userRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u?.name || 'Guest'}</Text>
                  <Text style={s.userSub}>{u?.email || ''}</Text>
                </View>
                <TouchableOpacity onPress={close} style={s.closeBtn} activeOpacity={0.7}>
                  <Feather name="x" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Level badge */}
              <View style={s.levelCard}>
                <View style={s.levelBadge}>
                  <Feather name="star" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text style={s.levelName}>New Star</Text>
                  <Text style={s.levelSub}>
                    ₦{(totalSales || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 })} total sales
                  </Text>
                </View>
                <TouchableOpacity style={s.checkBtn} activeOpacity={0.8} onPress={() => { close(); setTimeout(() => navigation.navigate('Leaderboard'), 250) }}>
                  <Text style={s.checkBtnTxt}>Check</Text>
                </TouchableOpacity>
              </View>

              {/* Menu */}
              <View style={s.menuCard}>
                {rows.map((row, i) => (
                  <View key={row.label}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity style={s.menuRow} onPress={row.onPress} activeOpacity={0.7}>
                      <View style={s.menuIcon}>
                        <Feather name={row.icon} size={18} color={colors.dark} />
                      </View>
                      <Text style={s.menuLabel}>{row.label}</Text>
                      <View style={{ flex: 1 }} />
                      {row.sub && <Text style={s.menuSub}>{row.sub}</Text>}
                      <Feather name="chevron-right" size={16} color={colors.subtle} style={{ marginLeft: spacing[2] }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Log out */}
              <View style={s.menuCard}>
                <TouchableOpacity style={s.menuRow} onPress={handleLogout} activeOpacity={0.7}>
                  <View style={s.menuIcon}>
                    <Feather name="power" size={18} color={colors.dark} />
                  </View>
                  <Text style={s.menuLabel}>Log out</Text>
                  <View style={{ flex: 1 }} />
                  <Feather name="chevron-right" size={16} color={colors.subtle} />
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    width: DRAWER_W, backgroundColor: '#F2F3F5',
    ...shadow.lg,
  },

  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[4],
    gap: spacing[3],
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  userName: { fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.dark },
  userSub: { fontSize: typography.size.xs, color: colors.muted, marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },

  levelCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6F7F5', borderRadius: radius.lg,
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    padding: spacing[4], borderWidth: 1, borderColor: '#00C2B4',
  },
  levelBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  levelName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  levelSub: { fontSize: typography.size.xs, color: colors.muted, marginTop: 2 },
  checkBtn: {
    borderWidth: 1.5, borderColor: colors.dark, borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: spacing[1] + 2,
  },
  checkBtnTxt: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.dark },

  menuCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    overflow: 'hidden', ...shadow.sm,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing[4] + 36 + spacing[3] },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  menuIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing[3],
  },
  menuLabel: { fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.dark },
  menuSub: { fontSize: typography.size.sm, color: colors.muted },
})
