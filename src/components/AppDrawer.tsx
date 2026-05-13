import { getStatusBarHeight } from '../util/statusBar'
import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Image, Alert, Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { useDrawer, DRAWER_W } from '../context/DrawerContext'
import { apiGetUserInfo } from '../api/auth'
import { BASE_URL } from '../api/client'
import { colors, typography, spacing, radius, shadow } from '../theme'

function resolveAvatar(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  // Rewrite /profile/ paths to /files/ endpoint
  const cleaned = path.replace('/profile/', '/files/')
  return `${BASE_URL}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`
}

export function AppDrawer() {
  const { user, logout } = useAuth()
  const { drawerVisible, drawerAnim, overlayAnim, close } = useDrawer()
  const navigation = useNavigation<any>()
  const [avatar, setAvatar] = useState<string | null>(null)
  // Track if avatar has been fetched this session — avoid re-fetching on every open
  const avatarFetchedRef = React.useRef(false)

  useEffect(() => {
    // Only fetch avatar once per session, not on every drawer open
    if (drawerVisible && user.isPresent() && !avatarFetchedRef.current) {
      avatarFetchedRef.current = true
      apiGetUserInfo().then(info => {
        if (info.avatar) setAvatar(info.avatar)
      }).catch(() => {})
    }
  }, [drawerVisible, user])

  function navigate(screen: string, params?: any) {
    // Close drawer immediately without waiting for animation — then navigate
    // This eliminates the 220ms animation delay before the new screen appears
    drawerAnim.stopAnimation()
    overlayAnim.stopAnimation()
    drawerAnim.setValue(-DRAWER_W)
    overlayAnim.setValue(0)
    close()
    // Navigate on next frame — drawer is already visually gone
    requestAnimationFrame(() => navigation.navigate(screen, params))
  }

  function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            close()
            setTimeout(logout, 250)
          },
        },
      ],
      { cancelable: true }
    )
  }

  const u        = user.isPresent() ? user.getOrThrow() : null
  const name     = u?.name || 'Guest'
  const avatarUri = avatar ? resolveAvatar(avatar) : null

  const menuItems = [
    { icon: 'grid'           as const, label: 'Wallet',            onPress: () => navigate('Withdraw') },
    { icon: 'tag'            as const, label: 'Coupons',            onPress: () => navigate('Coupon') },
    { icon: 'award'          as const, label: 'Leaderboard',        onPress: () => navigate('Leaderboard') },
    { icon: 'shield'         as const, label: 'Security & Privacy', onPress: () => navigate('SecuritySettings') },
    { icon: 'settings'       as const, label: 'Settings',           onPress: () => navigate('AccountSettings') },
    { icon: 'message-square' as const, label: 'Chat with us',       onPress: () => navigate('Chat') },
  ]

  if (!drawerVisible) return null

  return (
    <>
      {/* Dim overlay */}
      <Animated.View style={[d.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View style={[d.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <View style={{ flex: 1, paddingTop: getStatusBarHeight() }}>

          {/* Close button — top left */}
          <TouchableOpacity onPress={close} style={d.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={22} color={colors.dark} />
          </TouchableOpacity>

          {/* Avatar + name — centered */}
          <View style={d.profileSection}>
            <View style={d.avatarWrap}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={d.avatarImg}
                  resizeMode="cover"
                  onError={() => setAvatar(null)}
                />
              ) : (
                <Image
                  source={require('../../assets/default-avatar.png')}
                  style={d.avatarImg}
                  resizeMode="cover"
                />
              )}
              {/* Edit badge */}
              <TouchableOpacity
                style={d.editBadge}
                onPress={() => navigate('ProfileEdit')}
                activeOpacity={0.8}>
                <Feather name="edit-2" size={11} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={d.name}>{name}</Text>
          </View>

          <View style={d.divider} />

          {/* Menu items — scrollable so logout is always visible on small screens */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: spacing[3], paddingBottom: spacing[2] }}
            style={{ flex: 1 }}>
            {menuItems.map(item => (
              <TouchableOpacity
                key={item.label}
                style={d.menuRow}
                onPress={item.onPress}
                activeOpacity={0.65}>
                <View style={d.iconWrap}>
                  <Feather name={item.icon} size={20} color={colors.dark} />
                </View>
                <Text style={d.menuLabel}>{item.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.border} />
              </TouchableOpacity>
            ))}

            <View style={d.divider} />

            {/* Logout — inside ScrollView so it's always reachable */}
            <TouchableOpacity style={d.logoutRow} onPress={handleLogout} activeOpacity={0.65}>
              <View style={d.iconWrap}>
                <Feather name="log-out" size={20} color={colors.error} />
              </View>
              <Text style={[d.menuLabel, { color: colors.error }]}>Log out</Text>
            </TouchableOpacity>
          </ScrollView>

        </View>
      </Animated.View>
    </>
  )
}

const d = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100,
  },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: DRAWER_W,
    backgroundColor: colors.surface,
    zIndex: 101,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 20,
  },

  // Close button
  closeBtn: {
    marginLeft: spacing[5],
    marginTop: spacing[4],
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  // Profile — centered
  profileSection: {
    alignItems: 'center',
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  avatarWrap: {
    width: 72, height: 72,
    marginBottom: spacing[2],
    position: 'relative',
  },
  avatarImg: {
    width: 72, height: 72,
    borderRadius: 18,
    borderWidth: 2.5, borderColor: colors.primaryLight,
  },
  editBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  name: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing[5],
  },

  // Menu rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing[4],
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.dark,
  },

  // Logout
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
  },
})
