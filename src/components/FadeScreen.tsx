/**
 * FadeScreen — wraps a tab screen with a smooth fade-in on mount.
 *
 * Usage: wrap your screen's root view with this component.
 * The fade runs once when the screen first becomes active.
 *
 * Performance: useNativeDriver: true — runs on UI thread.
 */

import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, ViewStyle } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

interface FadeScreenProps {
  children: React.ReactNode
  style?: ViewStyle
  duration?: number
}

export function FadeScreen({ children, style, duration = 220 }: FadeScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current

  useFocusEffect(
    React.useCallback(() => {
      // Reset and fade in every time this tab gains focus
      opacity.setValue(0)
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start()
    }, [])
  )

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }, style]}>
      {children}
    </Animated.View>
  )
}
