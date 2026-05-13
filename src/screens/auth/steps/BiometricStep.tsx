import React from 'react'
import {
  View, Text, TouchableOpacity, Animated, Alert, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import Svg, { Path } from 'react-native-svg'
import { colors } from '../../../theme'
import { s } from '../styles/authStyles'

export interface BiometricStepProps {
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
  pendingUsername: string
  password: string
  enableBiometric: (username: string, pass: string) => Promise<boolean>
  onSkip?: () => void
}

export function BiometricStep({
  fadeAnim,
  slideAnim,
  pendingUsername,
  password,
  enableBiometric,
  onSkip,
}: BiometricStepProps) {
  return (
    <View style={[s.safe, { backgroundColor: colors.background }, { paddingTop: getStatusBarHeight() }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Fingerprint icon — 3 concentric circles in green */}
        <View style={s.bioCenter}>
          {/* Outer ring — lightest green */}
          <View style={s.bioOuter}>
            {/* Middle ring */}
            <View style={s.bioMiddle}>
              {/* Inner circle — solid primary green */}
              <View style={s.bioInner}>
                {/* Real fingerprint SVG — white strokes on green */}
                <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                  <Path d="M7 16V11.3615C7 10.8518 7.10026 10.3624 7.28451 9.90769M17 16V12.8154M9.22222 7.73446C10.0167 7.27055 10.9721 7 12 7C14.2795 7 16.2027 8.33062 16.8046 10.15"
                    stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M10 17V14.8235M14 17V11.8529C14 10.8296 13.1046 10 12 10C10.8954 10 10 10.8296 10 11.8529V12.6471"
                    stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M6 3H3V6" stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18 3H21V6" stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M6 21H3V18" stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18 21H21V18" stroke={colors.primaryText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            </View>
          </View>

          <Text style={s.bioTitle}>Enable Biometrics</Text>
          <Text style={s.bioSub}>
            Make your login & transactions faster and more secure with Biometrics enabled
          </Text>
        </View>

        {/* Bottom buttons */}
        <View style={s.bioBtns}>
          <TouchableOpacity
            style={s.bioSkipBtn}
            onPress={() => {
              // Explicitly call onSkip so AuthContext navigates away on Android
              // The navigator auto-switches when user state is set, but this
              // ensures the button always responds on first tap
              onSkip?.()
            }}
            activeOpacity={0.8}>
            <Text style={s.bioSkipTxt}>Not Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.bioEnableBtn}
            onPress={async () => {
              const ok = await enableBiometric(pendingUsername, password)
              if (ok) {
                Alert.alert('✅ Biometrics Enabled', 'You can now log in with your fingerprint or Face ID.')
              }
              // Either way, AuthContext user state is set — navigator switches automatically
            }}
            activeOpacity={0.85}>
            <Text style={s.bioEnableTxt}>Enable</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </View>
  )
}
