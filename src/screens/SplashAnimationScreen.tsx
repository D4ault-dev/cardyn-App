import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet, Image } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'

interface Props {
  onFinish: () => void
}

export default function SplashAnimationScreen({ onFinish }: Props) {
  // Logo slides in from the left
  const logoX       = useRef(new Animated.Value(-80)).current
  const logoOpacity = useRef(new Animated.Value(0)).current

  // Text slides in from the right
  const textX       = useRef(new Animated.Value(60)).current
  const textOpacity = useRef(new Animated.Value(0)).current

  // Whole screen fades out at the end
  const screenOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Hide native splash immediately when this component mounts.
    // Both screens share the same #0D1F24 background — the transition is seamless,
    // no white flash, no double splash visible to the user.
    SplashScreen.hideAsync().catch(() => {})

    Animated.sequence([
      // 1. Logo slides in from left
      Animated.parallel([
        Animated.spring(logoX, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),

      // 2. Short pause — logo settles
      Animated.delay(100),

      // 3. Text slides in from right
      Animated.parallel([
        Animated.spring(textX, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),

      // 4. Hold — let user see the full logo for ~1.5 seconds total
      Animated.delay(800),

      // 5. Fade out
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish())
  }, [])

  return (
    <Animated.View style={[s.container, { opacity: screenOpacity }]}>
      <View style={s.row}>
        {/* Logo icon — slides in from left */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ translateX: logoX }],
          }}
        >
          <View style={s.logoBg}>
            <Image
              source={require('../../assets/icon.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* "Cardyn" text — slides in from right */}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateX: textX }],
          }}
        >
          <Text style={s.appName}>Cardyn</Text>
        </Animated.View>
      </View>

      {/* Version — fades in with the text */}
      <Animated.Text style={[s.version, { opacity: textOpacity }]}>
        v{Constants.expoConfig?.version ?? '1.0.0'}
      </Animated.Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 52,
    height: 52,
  },
  logoBg: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
})
