/**
 * useAuthStatusBar
 *
 * Sets the status bar to dark-content (dark icons) on a light background
 * for auth screens. Restores the app default (light-content on dark) when
 * the screen loses focus.
 *
 * IMPORTANT: We keep translucent={true} always — toggling translucency
 * causes layout shifts on Android because the system adds/removes the
 * status bar height from the layout. Instead we just change the style
 * and background color.
 *
 * Usage: call once in AuthScreen.tsx — covers all auth steps.
 *   useAuthStatusBar()
 */
import { Platform, StatusBar } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback } from 'react'
import { setStatusBarStyle, setStatusBarBackgroundColor } from 'expo-status-bar'

export function useAuthStatusBar() {
  useFocusEffect(
    useCallback(() => {
      // Auth screens: light background → dark icons, semi-transparent light bar
      setStatusBarStyle('dark')
      if (Platform.OS === 'android') {
        setStatusBarBackgroundColor('rgba(245, 246, 250, 0.95)', false)
        StatusBar.setBarStyle('dark-content', true)
        StatusBar.setBackgroundColor('rgba(245, 246, 250, 0.95)', true)
        // Keep translucent=true — do NOT toggle this, it causes layout shifts
      }

      return () => {
        // Restore app default: dark bar for main app screens
        setStatusBarStyle('light')
        if (Platform.OS === 'android') {
          StatusBar.setBarStyle('light-content', true)
          StatusBar.setBackgroundColor('rgba(13, 31, 36, 0.85)', true)
        }
      }
    }, [])
  )
}
