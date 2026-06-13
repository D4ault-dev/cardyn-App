import { RF } from '../util/responsive'
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, Animated, Alert, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { BottomBackButton } from '../components/BottomBackButton'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../context/AuthContext'
import { Spinner, AppRefreshControl } from '../components/Spinner'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import storage from '../util/storage'
import { resolveImageUrl } from '../api/cards'
import { apiGetUserInfo } from '../api/auth'
import { useToast } from '../util/useToast'

// ── Username bottom sheet ─────────────────────────────────────────────────────
function UsernameSheet({
  visible, current, onClose, onConfirm, onError,
}: {
  visible: boolean
  current: string
  onClose: () => void
  onConfirm: (val: string) => Promise<void>
  onError: (msg: string) => void
}) {
  const [value, setValue]   = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (visible) { setValue(current); setSaving(false) } }, [visible])

  async function handleConfirm() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onConfirm(value.trim())
      onClose()
    } catch (e: any) {
      onError(e?.response?.data?.msg || e?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={us.overlay} activeOpacity={1} onPress={onClose} />
        <View style={us.sheet}>
          <View style={us.handle} />
          <Text style={us.sheetTitle}>Username</Text>

          {/* Input with clear button */}
          <View style={us.inputWrap}>
            <TextInput
              style={us.input}
              value={value}
              onChangeText={setValue}
              placeholder="Enter username"
              placeholderTextColor={colors.subtle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            {value.length > 0 && (
              <TouchableOpacity onPress={() => setValue('')} style={us.clearBtn} activeOpacity={0.7}>
                <Feather name="x-circle" size={18} color={colors.subtle} />
              </TouchableOpacity>
            )}
          </View>

          {/* Dark confirm button */}
          <TouchableOpacity
            style={[us.confirmBtn, (!value.trim() || saving) && us.confirmBtnOff]}
            onPress={handleConfirm}
            disabled={!value.trim() || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={us.confirmBtnTxt}>Confirm</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const us = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[5], paddingBottom: spacing[8],
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[4],
  },
  sheetTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.bold,
    color: colors.dark, marginBottom: spacing[4],
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing[4], marginBottom: spacing[5],
  },
  input: {
    flex: 1, fontSize: typography.size.lg, color: colors.dark,
    paddingVertical: spacing[4], fontWeight: typography.weight.extrabold,
  },
  clearBtn: { padding: spacing[1] },
  confirmBtn: {
    backgroundColor: '#1A1A1A', borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  confirmBtnOff: { backgroundColor: '#D0D0D0' },
  confirmBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})

// ── Date of Birth bottom sheet ────────────────────────────────────────────────
function DobSheet({
  visible, current, onClose, onConfirm, onError,
}: {
  visible: boolean
  current: string
  onClose: () => void
  onConfirm: (val: string) => Promise<void>
  onError: (msg: string) => void
}) {
  const [value, setValue]   = useState(current || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (visible) { setValue(current || ''); setSaving(false) } }, [visible])

  // Simple text input for date — format YYYY-MM-DD
  async function handleConfirm() {
    const trimmed = value.trim()
    if (!trimmed) return
    // Basic validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      onError('Please enter date as YYYY-MM-DD')
      return
    }
    setSaving(true)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch (e: any) {
      onError(e?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={us.overlay} activeOpacity={1} onPress={onClose} />
        <View style={us.sheet}>
          <View style={us.handle} />
          <Text style={us.sheetTitle}>Date of Birth</Text>
          <View style={us.inputWrap}>
            <TextInput
              style={us.input}
              value={value}
              onChangeText={setValue}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.subtle}
              keyboardType="numbers-and-punctuation"
              autoFocus
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            {value.length > 0 && (
              <TouchableOpacity onPress={() => setValue('')} style={us.clearBtn} activeOpacity={0.7}>
                <Feather name="x-circle" size={18} color={colors.subtle} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: typography.size.sm, color: colors.muted, marginBottom: spacing[4] }}>
            Format: YYYY-MM-DD (e.g. 1995-06-15)
          </Text>
          <TouchableOpacity
            style={[us.confirmBtn, (!value.trim() || saving) && us.confirmBtnOff]}
            onPress={handleConfirm}
            disabled={!value.trim() || saving}
            activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={us.confirmBtnTxt}>Save</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileEditScreen(props: StackScreenProps<RootStackParams, 'ProfileEdit'>) {
  const { user, refreshUser } = useAuth()
  const u = user.isPresent() ? user.getOrThrow() : null

  const [name, setName]               = useState(u?.name || '')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [dobSheetOpen, setDobSheetOpen] = useState(false)
  const [avatarUri, setAvatarUri]     = useState<string | null>(null)
  const [serverAvatar, setServerAvatar] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [sheetOpen, setSheetOpen]           = useState(false)
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false)
  const pendingPick    = useRef<'gallery' | 'camera' | null>(null)
  const photoSheetAnim = useRef(new Animated.Value(0)).current  // 0=hidden, 1=visible

  function openPhotoSheet() {
    setPhotoSheetOpen(true)
    Animated.timing(photoSheetAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }

  function closePhotoSheet(action: 'gallery' | 'camera' | null) {
    pendingPick.current = action
    // Fast fade out (120ms) then hide Modal — much faster than slide animation
    Animated.timing(photoSheetAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setPhotoSheetOpen(false)
    })
  }

  const { showSuccess, showError, Toast } = useToast()

  const initials = name
    ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // Load fresh data from backend on mount
  useEffect(() => {
    apiGetUserInfo().then(info => {
      setName(
        info.nickName && info.nickName !== info.userName
          ? info.nickName : info.userName || ''
      )
      if (info.avatar) setServerAvatar(info.avatar)
    }).catch(() => {})
    // Load DOB from tuka profile
    client.get('/tuka/user/me').then(res => {
      const dob = res.data?.data?.dateOfBirth
      if (dob) setDateOfBirth(dob)
    }).catch(() => {})
  }, [])

  // ── Photo picker ─────────────────────────────────────────────────────────
  async function pickFromLibrary() {
    // No permission needed on Android 13+ — expo-image-picker uses the system photo picker
    // On Android 12 and below, expo-image-picker handles READ_EXTERNAL_STORAGE internally
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri)
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access.'); return }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri)
  }

  async function uploadPhoto(uri: string) {
    setUploadingPhoto(true)
    setAvatarUri(uri)
    try {
      const filename = uri.split('/').pop() || 'avatar.jpg'
      const ext      = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mime     = ext === 'png' ? 'image/png' : 'image/jpeg'
      const form     = new FormData()
      form.append('avatarfile', { uri, name: filename, type: mime } as any)
      const res = await client.post('/system/user/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const imgUrl = res.data?.imgUrl || res.data?.data?.imgUrl || ''
      if (imgUrl) setServerAvatar(imgUrl)
      setImgLoadError(false)  // reset error state so new image shows
      // Invalidate the drawer avatar cache so it refreshes immediately
      const { cacheInvalidate } = await import('../util/cache')
      cacheInvalidate('userInfo:avatar')
      await refreshUser()
      showSuccess('Photo updated')
    } catch (e: any) {
      showError(e?.response?.data?.msg || e?.message || 'Could not upload photo')
      setAvatarUri(null)
    } finally { setUploadingPhoto(false) }
  }

  function handleCameraPress() {
    openPhotoSheet()
  }

  // Called after the photo sheet Modal fully dismisses
  function onPhotoSheetDismiss() {
    if (pendingPick.current === 'gallery') { pendingPick.current = null; pickFromLibrary() }
    if (pendingPick.current === 'camera')  { pendingPick.current = null; pickFromCamera() }
  }

  // ── Save name (called from sheet) ─────────────────────────────────────────
  async function saveName(newName: string) {
    await client.put('/system/user/profile', { nickName: newName })
    await client.put('/tuka/user/profile', { realName: newName })
    await storage.setItem('@tuka_user_name', newName)
    await refreshUser()
    setName(newName)
    showSuccess('Username updated')
  }

  async function saveDob(dob: string) {
    await client.put('/tuka/user/profile', { dateOfBirth: dob })
    setDateOfBirth(dob)
    showSuccess('Date of birth saved')
  }

  const displayUri = avatarUri || (serverAvatar ? resolveImageUrl(serverAvatar) : null)
  const [imgLoadError, setImgLoadError] = useState(false)

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>
      <AppHeader title="Profile Edit" onBack={() => props.navigation.goBack()} />

      <View style={s.body}>

        {/* ── Avatar ── */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={s.avatarWrap} onPress={handleCameraPress} activeOpacity={0.85}>
            {(displayUri && !imgLoadError) ? (
              <Image
                source={{ uri: displayUri }}
                style={s.avatarImg}
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <Image
                source={require('../../assets/default-avatar.png')}
                style={s.avatarImg}
                resizeMode="cover"
              />
            )}
            <View style={s.cameraBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="camera" size={13} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={s.avatarName}>{name}</Text>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* ── Username + DOB rows ── */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() => setSheetOpen(true)}
            activeOpacity={0.7}>
            <Text style={s.rowLabel}>Username</Text>
            <Text style={s.rowValue} numberOfLines={1}>{name || '—'}</Text>
            <Feather name="chevron-right" size={16} color={colors.subtle} style={{ marginLeft: spacing[2] }} />
          </TouchableOpacity>

          <View style={s.rowDivider} />

          <TouchableOpacity
            style={s.row}
            onPress={() => setDobSheetOpen(true)}
            activeOpacity={0.7}>
            <Text style={s.rowLabel}>Date of Birth</Text>
            <Text style={s.rowValue} numberOfLines={1}>{dateOfBirth || 'Not set'}</Text>
            <Feather name="chevron-right" size={16} color={colors.subtle} style={{ marginLeft: spacing[2] }} />
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Photo picker bottom sheet ── */}
      <Modal
        visible={photoSheetOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onDismiss={onPhotoSheetDismiss}
      >
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: photoSheetAnim }}>
          <TouchableOpacity style={ph.overlay} activeOpacity={1} onPress={() => closePhotoSheet(null)} />
          <Animated.View style={[ph.sheet, {
            position: 'absolute', bottom: 0, left: 0, right: 0,
            transform: [{ translateY: photoSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }]
          }]}>
            <View style={ph.handle} />
            <Text style={ph.title}>Upload Photo</Text>

            <TouchableOpacity
              style={ph.row}
              activeOpacity={0.7}
              onPress={() => closePhotoSheet('gallery')}
            >
              <View style={ph.iconWrap}>
                <Feather name="image" size={20} color={colors.dark} />
              </View>
              <Text style={ph.rowTxt}>Upload from Gallery</Text>
            </TouchableOpacity>

            <View style={ph.divider} />

            <TouchableOpacity
              style={ph.row}
              activeOpacity={0.7}
              onPress={() => closePhotoSheet('camera')}
            >
              <View style={ph.iconWrap}>
                <Feather name="camera" size={20} color={colors.dark} />
              </View>
              <Text style={ph.rowTxt}>Capture with Camera</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Username bottom sheet ── */}
      <UsernameSheet
        visible={sheetOpen}
        current={name}
        onClose={() => setSheetOpen(false)}
        onConfirm={saveName}
        onError={showError}
      />

      {/* ── Date of Birth sheet ── */}
      <DobSheet
        visible={dobSheetOpen}
        current={dateOfBirth}
        onClose={() => setDobSheetOpen(false)}
        onConfirm={saveDob}
        onError={showError}
      />

      {/* ── Toast ── */}
      {Toast}
      <BottomBackButton onPress={() => props.navigation.goBack()} />

    </View>
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

  body: { flex: 1 },

  avatarSection: { alignItems: 'center', paddingVertical: spacing[6] },
  avatarWrap: { position: 'relative', marginBottom: spacing[3] },
  avatarImg: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: colors.primary,
  },
  avatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.primary,
  },
  avatarTxt: { fontSize: RF(28), fontWeight: typography.weight.extrabold, color: colors.primary },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.dark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  avatarName: {
    fontSize: typography.size.base, color: colors.muted,
    fontWeight: typography.weight.medium,
  },

  divider: { height: 1, backgroundColor: colors.border },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginTop: spacing[4],
    borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    minHeight: 56,
  },
  rowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[5] },
  rowLabel: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.dark, flex: 1,
  },
  rowValue: {
    fontSize: typography.size.base, color: colors.muted,
    fontWeight: typography.weight.semibold, maxWidth: 160,
  },
})

// ── Photo sheet styles ────────────────────────────────────────────────────────
const ph = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing[5], paddingBottom: spacing[10],
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, alignSelf: 'center',
    marginTop: spacing[3], marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.lg, fontWeight: typography.weight.bold,
    color: colors.dark, textAlign: 'center',
    marginBottom: spacing[5],
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[4], gap: spacing[4],
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  rowTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.medium, color: colors.dark,
  },
  divider: { height: 1, backgroundColor: colors.border },
})
