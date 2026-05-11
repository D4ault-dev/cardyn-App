import React, { useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, Image, Dimensions, Animated, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../../../util/statusBar'
import { ONBOARDING_SLIDES } from '../types'
import { ob } from '../styles/authStyles'
import { SCREEN_H, isSmallPhone } from '../../../util/responsive'
import { Analytics } from '../../../util/analytics'
import storage from '../../../util/storage'
import { Country } from '../../../api/country'

const { width: W } = Dimensions.get('window')

// Pre-load onboarding images at module level — prevents flash/reload on each render
const ILLUS_IMAGES: Record<string, any> = {
  cards:  require('../../../../assets/onboard-sell.png'),
  money:  require('../../../../assets/onboard-payments.png'),
  wallet: require('../../../../assets/onboard-earnings.png'),
}

function SlideIllustration({ type }: { type: string }) {
  const illustHeight = isSmallPhone ? SCREEN_H * 0.36 : SCREEN_H * 0.42
  return (
    <View style={{ width: W, height: illustHeight, overflow: 'hidden' }}>
      <Image
        source={ILLUS_IMAGES[type]}
        style={{ width: W, height: '100%' }}
        resizeMode="cover"
        fadeDuration={0}
      />
    </View>
  )
}

export interface OnboardingStepProps {
  fadeAnim: Animated.Value
  selectedCountry: Country
  onGoToSignup: () => void
  onGoToLogin: () => void
}

export function OnboardingStep({
  fadeAnim,
  selectedCountry,
  onGoToSignup,
  onGoToLogin,
}: OnboardingStepProps) {
  const [slideIndex, setSlideIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const isLast = slideIndex === ONBOARDING_SLIDES.length - 1

  return (
    <View style={[{ flex: 1 }, { backgroundColor: '#FFFFFF' }, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* Skip button */}
        <TouchableOpacity style={ob.skipBtn}
          onPress={() => { Analytics.onboardingSkipped(slideIndex); onGoToLogin() }}>
          <Text style={ob.skipTxt}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_SLIDES}
          keyExtractor={i => i.id}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / W)
            setSlideIndex(idx)
            Analytics.onboardingSlideView(idx, ONBOARDING_SLIDES[idx]?.title ?? '')
          }}
          renderItem={({ item }) => (
            <View style={{ width: W, flex: 1 }}>
              {/* Illustration */}
              <SlideIllustration type={item.illustration} />

              {/* Text */}
              <View style={ob.textWrap}>
                <Text style={ob.title}>{item.title}</Text>
                <Text style={ob.subtitle}>{item.subtitle}</Text>
              </View>
            </View>
          )}
        />

        {/* Bottom */}
        <View style={ob.bottom}>
          {/* Dots */}
          <View style={ob.dotsRow}>
            {ONBOARDING_SLIDES.map((_, i) => (
              <View key={i} style={[ob.obDot, i === slideIndex && ob.obDotActive]} />
            ))}
          </View>

          {/* GET STARTED */}
          <TouchableOpacity style={ob.startBtn} activeOpacity={0.85}
            onPress={() => {
              storage.setItem('@tuka_onboarding_done', 'true').catch(() => {})
              Analytics.onboardingCompleted()
              Analytics.signupStarted('phone', selectedCountry.name)
              onGoToSignup()
            }}>
            <Text style={ob.startTxt}>GET STARTED</Text>
          </TouchableOpacity>

          {/* LOG IN */}
          <TouchableOpacity style={ob.loginBtn} activeOpacity={0.8}
            onPress={() => {
              storage.setItem('@tuka_onboarding_done', 'true').catch(() => {})
              Analytics.onboardingCompleted()
              onGoToLogin()
            }}>
            <Text style={ob.loginTxt}>LOG IN</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </View>
  )
}
