/**
 * Spinner — cross-platform loading indicator
 *
 * Simple, reliable wrapper around ActivityIndicator that:
 * - Always uses the app's primary color (no more default Android blue)
 * - Consistent sizing across iOS and Android
 * - Works in Expo Go AND production builds
 *
 * Usage:
 *   <Spinner />                        // medium, primary color
 *   <Spinner size="large" />
 *   <Spinner size="small" color="#fff" />  // inside dark buttons
 *   <Spinner style={{ marginTop: 24 }} />
 */

import React from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  RefreshControlProps,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { colors } from '../theme'

type SpinnerSize = 'small' | 'medium' | 'large'

interface SpinnerProps {
  size?:  SpinnerSize
  color?: string
  style?: StyleProp<ViewStyle>
}

// ActivityIndicator only accepts 'small' | 'large' — map 'medium' to 'small'
// but with a slightly larger hit via style
const NATIVE_SIZE: Record<SpinnerSize, 'small' | 'large'> = {
  small:  'small',
  medium: 'small',
  large:  'large',
}

// Extra scale for 'medium' since native only has two sizes
const EXTRA_STYLE: Record<SpinnerSize, ViewStyle> = {
  small:  {},
  medium: { transform: [{ scale: 1.3 }] },
  large:  {},
}

export function Spinner({ size = 'medium', color, style }: SpinnerProps) {
  const c = color ?? colors.primary
  return (
    <ActivityIndicator
      size={NATIVE_SIZE[size]}
      color={c}
      style={[EXTRA_STYLE[size], style]}
    />
  )
}

/**
 * AppRefreshControl — drop-in replacement for RefreshControl.
 * Sets consistent colors on both iOS and Android so pull-to-refresh
 * always uses the app's primary color instead of the system default.
 *
 * Usage:
 *   refreshControl={<AppRefreshControl refreshing={r} onRefresh={fn} />}
 */
export function AppRefreshControl(props: RefreshControlProps) {
  return (
    <RefreshControl
      {...props}
      tintColor={props.tintColor ?? colors.primary}
      colors={props.colors ?? [colors.primary, colors.accent]}
      progressBackgroundColor={props.progressBackgroundColor ?? '#FFFFFF'}
    />
  )
}
