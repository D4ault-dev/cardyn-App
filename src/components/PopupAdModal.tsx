import { RF } from '../util/responsive'
import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Image, Animated, Dimensions, Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchActivePopups, PopupAd } from '../api/popup'
import storage from '../util/storage'

const { width: W } = Dimensions.get('window')
const SEEN_KEY = '@tuka_seen_popups'

interface Props {
  onNavigate?: (type: string, value: string) => void
}

export function PopupAdModal({ onNavigate }: Props) {
  const [popup, setPopup]   = useState<PopupAd | null>(null)
  const [visible, setVisible] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    loadPopup()
  }, [])

  async function loadPopup() {
    try {
      const popups = await fetchActivePopups()
      if (!popups.length) return

      // Get already-seen popup IDs
      const seenRaw = await storage.getItem(SEEN_KEY)
      const seen: number[] = seenRaw ? JSON.parse(seenRaw) : []

      // Find first popup not yet seen (or that doesn't require show_once)
      const toShow = popups.find(p => p.showOnce === 0 || !seen.includes(p.id))
      if (!toShow) return

      setPopup(toShow)
      setVisible(true)

      // Mark as seen
      if (toShow.showOnce === 1) {
        const updated = [...seen, toShow.id]
        await storage.setItem(SEEN_KEY, JSON.stringify(updated))
      }

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start()
    } catch { /* silently skip */ }
  }

  function close() {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.85, duration: 180, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false))
  }

  async function copyCoupon(code: string) {
    await Clipboard.setStringAsync(code)
    Alert.alert('已复制！', `优惠码 ${code} 已复制到剪贴板`)
  }

  function handleAction() {
    if (!popup) return
    if (popup.linkType === 'article' && popup.linkValue && onNavigate) {
      close()
      setTimeout(() => onNavigate('article', popup.linkValue!), 300)
    } else if (popup.linkType === 'url' && popup.linkValue) {
      close()
    } else {
      close()
    }
  }

  if (!popup) return null

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Close button */}
          <TouchableOpacity style={s.closeBtn} onPress={close} activeOpacity={0.7}>
            <Feather name="x" size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Image */}
          {popup.image ? (
            <Image source={{ uri: popup.image }} style={s.image} resizeMode="cover" />
          ) : (
            <View style={s.imagePlaceholder}>
              <Text style={{ fontSize: RF(48) }}>🎁</Text>
            </View>
          )}

          {/* Content */}
          <View style={s.body}>
            <Text style={s.title}>{popup.title}</Text>
            {popup.content ? (
              <Text style={s.content}>{popup.content}</Text>
            ) : null}

            {/* Coupon card */}
            {popup.couponCode ? (
              <TouchableOpacity style={s.couponCard} onPress={() => copyCoupon(popup.couponCode!)} activeOpacity={0.85}>
                <View style={s.couponLeft}>
                  <Text style={s.couponLabel}>优惠码</Text>
                  <Text style={s.couponCode}>{popup.couponCode}</Text>
                  <Text style={s.couponHint}>点击复制</Text>
                </View>
                <View style={s.couponRight}>
                  <Feather name="copy" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* CTA button */}
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={popup.linkType !== 'none' ? handleAction : close}
              activeOpacity={0.85}>
              <Text style={s.ctaBtnTxt}>
                {popup.linkType === 'article' ? '查看详情' :
                 popup.linkType === 'url'     ? '了解更多' : '知道了'}
              </Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    width: '100%',
    overflow: 'hidden',
    ...shadow.lg,
  },
  closeBtn: {
    position: 'absolute', top: spacing[3], right: spacing[3],
    zIndex: 10, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: 180 },
  imagePlaceholder: {
    width: '100%', height: 140,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: spacing[5] },
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[2],
  },
  content: {
    fontSize: typography.size.base, color: colors.muted,
    lineHeight: 22, marginBottom: spacing[4],
  },
  couponCard: {
    flexDirection: 'row', borderRadius: radius.xl,
    overflow: 'hidden', marginBottom: spacing[4],
    borderWidth: 1.5, borderColor: colors.primary,
  },
  couponLeft: {
    flex: 1, padding: spacing[4],
    backgroundColor: colors.primaryLight,
  },
  couponLabel: { fontSize: RF(10), color: colors.primary, fontWeight: typography.weight.bold, letterSpacing: 0.5 },
  couponCode:  { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark, marginVertical: 2 },
  couponHint:  { fontSize: typography.size.xs, color: colors.muted },
  couponRight: {
    width: 56, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtn: {
    backgroundColor: colors.dark, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  ctaBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },
})
