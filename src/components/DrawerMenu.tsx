import { RF } from '../util/responsive'
import React, { useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, TouchableWithoutFeedback,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from '@react-navigation/native'
import { colors, typography, spacing, radius } from '../theme'

const { width: W } = Dimensions.get('window')
const DRAWER_WIDTH = W * 0.78

interface Props {
  visible: boolean
  onClose: () => void
}

export default function DrawerMenu({ visible, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const { user, logout } = useAuth()
  const navigation = useNavigation<any>()

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true,
          tension: 65, friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 220, useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          onClose()
          await logout()
        }
      },
    ])
  }

  const userName = user.isPresent() ? user.getOrThrow().name : 'Guest'
  const initials = userName.charAt(0).toUpperCase()

  if (!visible) return null

  return (
    <View style={s.overlay}>
      {/* Dim background */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideAnim }] }]}>

        {/* ── User header ── */}
        <View style={s.userSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.userName}>{userName}</Text>
        </View>

        {/* ── Level badge ── */}
        <View style={s.levelCard}>
          <View style={s.levelLeft}>
            <View style={s.shieldBadge}>
              <Text style={{ fontSize: RF(20) }}>🛡️</Text>
            </View>
            <Text style={s.levelText}>New Star</Text>
            <View style={s.vBadge}>
              <Text style={s.vBadgeText}>V0</Text>
            </View>
          </View>
          <TouchableOpacity style={s.checkBtn}>
            <Text style={s.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>

        {/* ── Menu group 1 ── */}
        <View style={s.menuCard}>
          <MenuItem
            icon="credit-card"
            label="Wallet"
            onPress={() => { onClose(); navigation.navigate('Wallet') }}
          />
          <View style={s.menuDivider} />
          <MenuItem
            icon="settings"
            label="Account Settings"
            onPress={() => { onClose(); navigation.navigate('Profile') }}
          />
        </View>

        {/* ── Menu group 2 ── */}
        <View style={s.menuCard}>
          <MenuItem
            icon="book-open"
            label="Trading Guidelines"
            onPress={() => {}}
          />
          <View style={s.menuDivider} />
          <MenuItem
            icon="refresh-cw"
            label="Version update"
            value="V1.0.0"
            onPress={() => {}}
          />
        </View>

        {/* ── Menu group 3 ── */}
        <View style={s.menuCard}>
          <MenuItem
            icon="power"
            label="Log out"
            onPress={handleLogout}
            danger
          />
        </View>

      </Animated.View>
    </View>
  )
}

function MenuItem({
  icon, label, value, onPress, danger,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  value?: string
  onPress: () => void
  danger?: boolean
}) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={s.menuItemLeft}>
        <Feather name={icon} size={20} color={danger ? colors.error : colors.muted} />
        <Text style={[s.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      </View>
      <View style={s.menuItemRight}>
        {value && <Text style={s.menuValue}>{value}</Text>}
        <Feather name="chevron-right" size={18} color={colors.border} />
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: spacing[4],
  },

  // User
  userSection: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], marginBottom: spacing[4],
  },
  avatar: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.primaryText, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold },
  userName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },

  // Level badge
  levelCard: {
    backgroundColor: '#FFF5EE',
    borderRadius: radius.lg, padding: spacing[4],
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  levelLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  shieldBadge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark },
  vBadge: {
    backgroundColor: colors.dark, borderRadius: radius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 2,
  },
  vBadgeText: { color: colors.primaryText, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  checkBtn: {
    borderWidth: 1.5, borderColor: colors.dark,
    borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[1] + 2,
  },
  checkBtnText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.dark },

  // Menu cards
  menuCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing[3], overflow: 'hidden',
  },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[4] },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  menuLabel: { fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.dark },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  menuValue: { fontSize: typography.size.sm, color: colors.subtle },
})
