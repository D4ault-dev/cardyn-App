/**
 * BottomSheet — reusable animated bottom sheet
 *
 * Two modes:
 *  - autoHeight (default): sheet sizes to content — no empty space
 *  - heightFraction: fixed height as fraction of screen
 *
 * Entry:  slides up + backdrop fades in + sheet scales 0.97→1
 * Exit:   slides down + backdrop fades out
 * Performance: useNativeDriver: true throughout (60fps)
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  Modal, View, TouchableOpacity, Animated, StyleSheet,
  Dimensions, Platform, KeyboardAvoidingView, LayoutChangeEvent,
} from 'react-native'
import { colors, radius } from '../theme'
import { ms } from '../util/responsive'

const SCREEN_H = Dimensions.get('screen').height

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /** Fixed height as fraction of screen. If omitted, sheet auto-sizes to content. */
  heightFraction?: number
  /** If true, tapping backdrop closes the sheet */
  closeOnBackdrop?: boolean
  /** If true, wraps content in KeyboardAvoidingView for forms */
  avoidKeyboard?: boolean
}

export function BottomSheet({
  visible,
  onClose,
  children,
  heightFraction,
  closeOnBackdrop = true,
  avoidKeyboard = false,
}: BottomSheetProps) {
  const [mounted, setMounted]         = useState(false)
  const [contentHeight, setContentHeight] = useState(0)

  const slideAnim    = useRef(new Animated.Value(SCREEN_H)).current
  const backdropAnim = useRef(new Animated.Value(0)).current
  const scaleAnim    = useRef(new Animated.Value(0.97)).current

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, tension: 72, friction: 14,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1, duration: 260, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, useNativeDriver: true, tension: 80, friction: 12,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_H, duration: 240, useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.97, duration: 200, useNativeDriver: true,
        }),
      ]).start(() => setMounted(false))
    }
  }, [visible])

  if (!mounted && !visible) return null

  // Fixed height mode
  const fixedHeight = heightFraction ? SCREEN_H * heightFraction : null

  function onContentLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height
    if (h > 0) setContentHeight(h)
  }

  const sheetContent = (
    <Animated.View
      style={[
        st.sheetWrap,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <View
        style={[
          st.sheet,
          fixedHeight ? { height: fixedHeight } : undefined,
        ]}
        onLayout={!fixedHeight ? onContentLayout : undefined}
      >
        <View style={st.handle} />
        {children}
      </View>
      {/* White fill covers Android nav bar gap */}
      <View style={st.bottomFill} />
    </Animated.View>
  )

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Full-screen container anchors everything to the true screen bounds */}
      <View style={st.container} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[st.backdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
          {closeOnBackdrop && (
            <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
          )}
        </Animated.View>

        {avoidKeyboard ? (
          <KeyboardAvoidingView
            style={st.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            pointerEvents="box-none"
          >
            {sheetContent}
          </KeyboardAvoidingView>
        ) : sheetContent}
      </View>
    </Modal>
  )
}

const st = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardAvoid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: ms(28),
    borderTopRightRadius: ms(28),
    overflow: 'hidden',
  },
  handle: {
    width: ms(40), height: ms(4),
    backgroundColor: colors.border,
    borderRadius: ms(2),
    alignSelf: 'center',
    marginTop: ms(12), marginBottom: ms(8),
  },
  bottomFill: {
    backgroundColor: colors.surface,
    height: 80,
  },
})
