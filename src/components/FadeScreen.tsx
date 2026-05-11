/**
 * FadeScreen — wraps a tab screen with a smooth fade-in on first mount only.
 *
 * Behaviour:
 *  - First time the screen mounts → fades in from 0 → 1
 *  - Returning from a pushed stack screen (go back) → no fade, already visible
 *  - Switching between tabs → fades in (tab was unmounted/remounted)
 *
 * This prevents the "blink" that happens when useFocusEffect resets opacity
 * to 0 every time you pop back to this screen.
 *
 * Performance: useNativeDriver: true — runs entirely on the UI thread.
 */

import React, { useRef } from 'react'
import { Animated, ViewStyle } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

interface FadeScreenProps {
  children: React.ReactNode
  style?: ViewStyle
  duration?: number
}

export function FadeScreen({ children, style, duration = 220 }: FadeScreenProps) {
  const opacity    = useRef(new Animated.Value(0)).current
  // Track whether this is the very first focus event after mount
  const hasFadedIn = useRef(false)

  useFocusEffect(
    React.useCallback(() => {
      if (hasFadedIn.current) {
        // Already faded in once — returning from a child screen.
        // Ensure we're fully visible without re-triggering the fade.
        opacity.setValue(1)
        return
      }
      // First focus after mount — run the fade-in once
      hasFadedIn.current = true
      opacity.setValue(0)
      Animated.timing(opacity, {
        toValue:  1,
        duration,
        useNativeDriver: true,
      }).start()
    }, [])
  )

  return (
    <Animated.View style={[{ flex: 1 }, { opacity }, style]}>
      {children}
    </Animated.View>
  )
}
