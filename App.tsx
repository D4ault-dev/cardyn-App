import 'react-native-gesture-handler'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Feather } from '@expo/vector-icons'
import { View, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Platform, StatusBar as RNStatusBar, AppState } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import * as ExpoLinking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  TAB_BAR_HEIGHT, TAB_BAR_SIDE_MARGIN, TAB_BAR_BORDER_RADIUS,
  FAB_SIZE, ICON_SIZE, sw, ms,
} from './src/util/responsive'

// ── Deep link config — module scope so RootNavigator can access it ────────────
const linking = {
  prefixes: [
    ExpoLinking.createURL('/'),
    'https://cardyn.net',
    'cardyn://',
  ],
  config: {
    screens: {
      Login: {
        path: 'ref/:inviteCode',
        parse: { inviteCode: (code: string) => code },
      },
      Signup: {
        path: 'invite/:inviteCode',
        parse: { inviteCode: (code: string) => code },
      },
    },
  },
}

import { AuthProvider, useAuth } from './src/context/AuthContext'
import { CountryProvider } from './src/context/CountryContext'
import { LoadingContextProvider } from './src/context/LoadingContext'
import { DrawerProvider } from './src/context/DrawerContext'
import { AppDrawer } from './src/components/AppDrawer'
import { BiometricLockScreen } from './src/components/BiometricLockScreen'
import { colors, spacing, radius, typography, shadow } from './src/theme'
import { prefetchCredentials } from './src/api/socialAuth'
import { setupNotificationListeners } from './src/util/pushNotifications'
import { initFirebase } from './src/firebaseInit'
import { Analytics } from './src/util/analytics'
import { fetchAdConfig, initializeAdSDKs } from './src/util/adManager'
import { BIOMETRIC_KEY } from './src/screens/auth/types'
import * as SecureStore from 'expo-secure-store'

import HomeScreen    from './src/screens/HomeScreen'
import AuthScreen    from './src/screens/AuthScreen'
import PasswordResetScreen from './src/screens/PasswordResetScreen'
import CardsScreen   from './src/screens/CardsScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import SellCardScreen from './src/screens/SellCardScreen'
import SellLandingScreen from './src/screens/SellLandingScreen'
import OrdersScreen  from './src/screens/OrdersScreen'
import DiscoveryScreen from './src/screens/DiscoveryScreen'
import WithdrawScreen from './src/screens/WithdrawScreen'
import SplashAnimationScreen from './src/screens/SplashAnimationScreen'

// ── Lazy-loaded screens — only bundled when first navigated to ────────────────
const WithdrawAmountScreen    = React.lazy(() => import('./src/screens/WithdrawAmountScreen'))
const WithdrawPinScreen       = React.lazy(() => import('./src/screens/WithdrawPinScreen'))
const OrderDetailScreen       = React.lazy(() => import('./src/screens/OrderDetailScreen'))
const AddBankScreen           = React.lazy(() => import('./src/screens/AddBankScreen'))
const SelectBankScreen        = React.lazy(() => import('./src/screens/SelectBankScreen'))
const WithdrawDetailScreen    = React.lazy(() => import('./src/screens/WithdrawDetailScreen'))
const WithdrawalHistoryScreen = React.lazy(() => import('./src/screens/WithdrawalHistoryScreen'))
const AccountSettingsScreen   = React.lazy(() => import('./src/screens/AccountSettingsScreen'))
// ProfileEditScreen eagerly imported — opened from drawer, must respond on first tap
import ProfileEditScreen from './src/screens/ProfileEditScreen'
const VerifyIdentityScreen    = React.lazy(() => import('./src/screens/VerifyIdentityScreen'))
const ModifyPasswordScreen    = React.lazy(() => import('./src/screens/ModifyPasswordScreen'))
const SecuritySettingsScreen  = React.lazy(() => import('./src/screens/SecuritySettingsScreen'))
const AccountDeletionScreen   = React.lazy(() => import('./src/screens/AccountDeletionScreen'))
const DeleteAccountConfirmScreen = React.lazy(() => import('./src/screens/DeleteAccountConfirmScreen'))
const WithdrawPasswordScreen  = React.lazy(() => import('./src/screens/WithdrawPasswordScreen'))
const UpdateEmailScreen       = React.lazy(() => import('./src/screens/UpdateEmailScreen'))
const LeaderboardScreen       = React.lazy(() => import('./src/screens/LeaderboardScreen'))
const DailyBonusScreen        = React.lazy(() => import('./src/screens/DailyBonusScreen'))
// CouponScreen eagerly imported — opened from drawer, must respond on first tap
import CouponScreen from './src/screens/CouponScreen'
const AlertsScreen            = React.lazy(() => import('./src/screens/AlertsScreen'))
const HelpScreen              = React.lazy(() => import('./src/screens/HelpScreen'))
const ChatScreen              = React.lazy(() => import('./src/screens/ChatScreen'))
const ArticleDetailScreen     = React.lazy(() => import('./src/screens/ArticleDetailScreen'))
const ReferralScreen          = React.lazy(() => import('./src/screens/ReferralScreen'))
const CardPickerScreen        = React.lazy(() => import('./src/screens/CardPickerScreen'))
const RateCalculatorScreen    = React.lazy(() => import('./src/screens/RateCalculatorScreen'))
const BindPhoneScreen         = React.lazy(() => import('./src/screens/BindPhoneScreen'))
const RateAlertScreen         = React.lazy(() => import('./src/screens/RateAlertScreen'))
const RateAlertListScreen     = React.lazy(() => import('./src/screens/RateAlertListScreen'))

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator<RootStackParams>()

function Tabs() {
  const insets = useSafeAreaInsets()
  // F8 app pattern: fixed bottom values — more reliable than SafeAreaInsets on Android.
  // Android gesture nav: system handles spacing; 3-button nav: 16px clearance is enough.
  // iOS: 24px works for all devices (SafeAreaProvider handles notch/home indicator).
  const tabBarBottom = Platform.OS === 'android'
    ? Math.max((insets.bottom ?? 0) + 8, 16)
    : 24

  return (
    <DrawerProvider>
      <AppDrawer />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#AAAAAA',
          tabBarStyle: [s.tabBar, { bottom: tabBarBottom }],
          // Smooth fade between tabs (v6 compatible)
          sceneStyle: { backgroundColor: colors.background },
          tabBarHideOnKeyboard: true,
        }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen as any}
        options={{
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={CardsScreen as any}
        options={{
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      {/* Center FAB — Sell Card */}
      <Tab.Screen
        name="Sell"
        component={SellLandingScreen as any}
        options={{
          tabBarIcon: () => (
            <View style={s.sellFab}>
              <Svg width={ms(26)} height={ms(26)} viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="5" width="16" height="11" rx="2" stroke="#fff" strokeWidth="1.8" />
                <Path d="M2 9h16" stroke="#fff" strokeWidth="1.8" />
                <Path d="M18 14c1.5 0 4 .5 4 2.5V19H6v-1.5C6 16 7 15 8.5 15H18z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
              </Svg>
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault()
            navigation.navigate('SellCard' as any)
          },
        })}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen as any}
        options={{
          tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Discovery"
        component={DiscoveryScreen as any}
        options={{
          tabBarIcon: ({ color }) => <Feather name="compass" size={22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen as any}
        options={{
          tabBarButton: () => null,  // hidden — drawer opens from HomeScreen menu icon
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tab.Navigator>
    </DrawerProvider>
  )
}

function RootNavigator() {
  const { user } = useAuth()
  const isLoggedIn = user.isPresent()
  const navigationRef = useRef<NavigationContainerRef<any>>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    const cleanup = setupNotificationListeners(navigationRef.current)
    return cleanup
  }, [isLoggedIn])

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={{ dark: false, colors: { background: '#F5F6FA', card: colors.primary, text: '#fff', border: 'transparent', notification: colors.accent, primary: colors.accent } }}>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        // ── Premium screen transition ──────────────────────────────────────
        // Incoming screen: slides in from the right with a subtle fade-in.
        // Outgoing screen: scales back slightly for depth — no opacity change
        // because containerStyle opacity bleeds into the iOS status bar area.
        cardStyleInterpolator: ({ current, next, layouts }) => ({
          cardStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange:  [0, 1],
                  outputRange: [layouts.screen.width, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
            opacity: current.progress.interpolate({
              inputRange:  [0, 0.15, 1],
              outputRange: [0, 1, 1],
              extrapolate: 'clamp',
            }),
          },
          // Previous screen scales back slightly — depth without status bar bleed
          ...(next
            ? {
                containerStyle: {
                  transform: [
                    {
                      scale: next.progress.interpolate({
                        inputRange:  [0, 1],
                        outputRange: [1, 0.96],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              }
            : {}),
        }),
        // iOS: spring for the native elastic feel
        // Android: fast timing — spring can feel laggy on mid-range devices
        transitionSpec: Platform.OS === 'ios'
          ? {
              open: {
                animation: 'spring',
                config: {
                  stiffness: 300,
                  damping: 38,
                  mass: 1,
                  overshootClamping: false,
                  restDisplacementThreshold: 0.001,
                  restSpeedThreshold: 0.001,
                },
              },
              close: {
                animation: 'spring',
                config: {
                  stiffness: 300,
                  damping: 38,
                  mass: 1,
                  overshootClamping: true,
                  restDisplacementThreshold: 0.001,
                  restSpeedThreshold: 0.001,
                },
              },
            }
          : {
              open:  { animation: 'timing', config: { duration: 260 } },
              close: { animation: 'timing', config: { duration: 200 } },
            },
      }}>
        {isLoggedIn ? (
          // Authenticated stack
          <>
            <Stack.Screen name="Tabs"           component={Tabs} />
            <Stack.Screen name="SellCard"        component={SellCardScreen as any} />
            <Stack.Screen name="OrderDetail"     component={OrderDetailScreen as any} />
            <Stack.Screen name="AddBank"         component={AddBankScreen as any} />
            <Stack.Screen name="SelectBank"      component={SelectBankScreen as any} />
            <Stack.Screen name="WithdrawDetail"      component={WithdrawDetailScreen as any} />
            <Stack.Screen name="WithdrawalHistory"   component={WithdrawalHistoryScreen as any} />
            <Stack.Screen name="Withdraw"        component={WithdrawScreen as any} />
            <Stack.Screen name="WithdrawAmount"  component={WithdrawAmountScreen as any} />
            <Stack.Screen name="WithdrawPin"     component={WithdrawPinScreen as any}
              options={{
                cardStyleInterpolator: Platform.OS === 'ios'
                  ? CardStyleInterpolators.forModalPresentationIOS
                  : CardStyleInterpolators.forVerticalIOS,
              }}
            />
            <Stack.Screen name="AccountSettings" component={AccountSettingsScreen as any} />
            <Stack.Screen name="ProfileEdit"     component={ProfileEditScreen as any} />
            <Stack.Screen name="VerifyIdentity"  component={VerifyIdentityScreen as any} />
            <Stack.Screen name="ModifyPassword"  component={ModifyPasswordScreen as any} />
            <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen as any} />
            <Stack.Screen name="AccountDeletion"       component={AccountDeletionScreen as any} />
            <Stack.Screen name="DeleteAccountConfirm"  component={DeleteAccountConfirmScreen as any} />
            <Stack.Screen name="WithdrawPassword" component={WithdrawPasswordScreen as any} />
            <Stack.Screen name="UpdateEmail"      component={UpdateEmailScreen as any} />
            <Stack.Screen name="Leaderboard"     component={LeaderboardScreen as any} />
            <Stack.Screen name="DailyBonus"      component={DailyBonusScreen  as any} />
            <Stack.Screen name="Coupon"          component={CouponScreen       as any} />
            <Stack.Screen name="Alerts"          component={AlertsScreen       as any} />
            <Stack.Screen name="Help"            component={HelpScreen         as any} />
            <Stack.Screen name="Chat"            component={ChatScreen         as any} />
            <Stack.Screen name="ArticleDetail"   component={ArticleDetailScreen as any} />
            <Stack.Screen name="Referral"        component={ReferralScreen as any} />
            <Stack.Screen name="CardPicker"      component={CardPickerScreen as any} />
            <Stack.Screen name="RateCalculator"  component={RateCalculatorScreen as any} />
            <Stack.Screen name="BindPhone"        component={BindPhoneScreen as any} />
            <Stack.Screen name="RateAlert"       component={RateAlertScreen as any} />
            <Stack.Screen name="RateAlertList"   component={RateAlertListScreen as any} />
          </>
        ) : (
          // Unauthenticated stack — always starts at Login
          <>
            <Stack.Screen name="Login"  component={AuthScreen} />
            <Stack.Screen name="Signup" component={AuthScreen as any} />
          </>
        )}
        {/* Always accessible */}
        <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

// Keep native splash visible until JS is ready
SplashScreen.preventAutoHideAsync().catch(() => {})

// How long the app can be in background before requiring biometric re-auth (5 minutes)
const LOCK_AFTER_MS = 5 * 60 * 1000

// ── Shared biometric lock check — used by both cold launch and AppState listener ──
async function shouldShowBiometricLock(): Promise<boolean> {
  try {
    // 1. Must be logged in
    const token = await AsyncStorage.getItem('@tuka_auth_token')
    if (!token) return false
    // 2. Must have biometric enabled
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEY)
    return enabled === 'true'
  } catch {
    return false  // storage error — don't lock, don't crash
  }
}

function AppContent() {
  const { isLoading, user } = useAuth()
  const [splashDone, setSplashDone]         = useState(false)
  const [biometricLocked, setBiometricLocked] = useState(false)

  // Refs — never cause re-renders, safe to read inside closures
  const biometricLockedRef = useRef(false)   // mirrors biometricLocked state
  const backgroundedAt     = useRef<number | null>(null)
  const appState           = useRef(AppState.currentState)
  const checkInProgress    = useRef(false)   // prevents duplicate concurrent checks

  // Keep ref in sync with state — single source of truth
  // useCallback ensures the AppState closure always calls the latest version
  const lock = useCallback(() => {
    biometricLockedRef.current = true
    setBiometricLocked(true)
  }, [])

  const unlock = useCallback(() => {
    biometricLockedRef.current = false
    setBiometricLocked(false)
    // Reset backgroundedAt so the 5-min timer starts fresh after unlock
    backgroundedAt.current = Date.now()
  }, [])

  // ── Cold launch check ─────────────────────────────────────────────────────
  // AppState 'change' never fires for the initial 'active' state on cold launch.
  // On cold launch (app fully closed/killed), always lock if biometric is enabled.
  // We don't check elapsed time here — a cold launch IS a lock event.
  useEffect(() => {
    if (isLoading) return  // wait for session restore to complete
    let cancelled = false
    ;(async () => {
      if (biometricLockedRef.current || checkInProgress.current) return
      checkInProgress.current = true
      try {
        if (!cancelled && await shouldShowBiometricLock()) {
          lock()
        }
      } finally {
        checkInProgress.current = false
      }
    })()
    return () => { cancelled = true }
  }, [isLoading])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background/foreground AppState listener ───────────────────────────────
  // Handles the case where app goes to background and comes back (not killed).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextState => {
      const prev = appState.current
      appState.current = nextState

      // Record when app goes to background
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now()
        return
      }

      // App came back to foreground from background (not a cold launch)
      if (nextState === 'active' && prev !== 'active') {
        if (biometricLockedRef.current || checkInProgress.current) return
        checkInProgress.current = true
        try {
          const elapsed = backgroundedAt.current != null
            ? Date.now() - backgroundedAt.current
            : LOCK_AFTER_MS + 1  // backgroundedAt not set = treat as long absence → lock

          if (elapsed < LOCK_AFTER_MS) return

          if (await shouldShowBiometricLock()) {
            lock()
          }
        } finally {
          checkInProgress.current = false
        }
      }
    })

    return () => sub.remove()
  }, [])  // empty deps — intentional, all state accessed via refs

  // While auth is loading, show dark background — matches native splash
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#0D1F24' }} />
  }

  // Show animated splash until it finishes
  if (!splashDone) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D1F24' }}>
        <SplashAnimationScreen onFinish={() => setSplashDone(true)} />
      </View>
    )
  }

  return (
    <>
      {/* Global status bar — dark background for main app screens.
          Auth screens override this individually with their own StatusBar. */}
      <StatusBar style="light" translucent={true} />
      {Platform.OS === 'android' && (
        <RNStatusBar
          backgroundColor="rgba(13, 31, 36, 0.85)"
          barStyle="light-content"
          translucent={true}
        />
      )}
      <RootNavigator />
      {/* Biometric lock overlay — shown on top of everything when app returns from background */}
      {biometricLocked && (
        <BiometricLockScreen onUnlocked={unlock} />
      )}
    </>
  )
}

export default function App() {
  // Init Firebase + track anonymous app open on every launch
  useEffect(() => {
    initFirebase().then(() => Analytics.appOpen())
    prefetchCredentials()
    // Fetch ad config from backend and initialize SDKs
    fetchAdConfig().then(config => initializeAdSDKs(config)).catch(() => {})

    // ── Android system navigation bar ──────────────────────────────────────
    if (Platform.OS === 'android') {
      // Translucent status bar with semi-transparent navy — F8 app pattern
      RNStatusBar.setTranslucent(true)
      RNStatusBar.setBackgroundColor('rgba(13, 31, 36, 0.85)', true)
      RNStatusBar.setBarStyle('light-content', true)
      // Set navigation bar to black with light (white) buttons
      // Note: NavigationBar APIs are no-ops in SDK 53+ edge-to-edge on some devices.
      // The app.json androidNavigationBar config handles this at build time.
      try {
        const { NavigationBar } = require('expo-navigation-bar')
        NavigationBar.setBackgroundColorAsync('#000000').catch(() => {})
        NavigationBar.setButtonStyleAsync('light').catch(() => {})
      } catch { /* expo-navigation-bar not available */ }
    }
  }, [])

  // Handle deep links for ad attribution (UTM params)
  useEffect(() => {
    // App opened from a link while already running
    const sub = Linking.addEventListener('url', ({ url }) => {
      Analytics.handleDeepLink(url)
    })
    // App opened cold from a link
    Linking.getInitialURL().then(url => {
      if (url) Analytics.handleDeepLink(url)
    })
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider style={{ backgroundColor: '#F5F6FA' }}>
      <LoadingContextProvider>
        <AuthProvider>
          <CountryProvider>
            <AppContent />
          </CountryProvider>
        </AuthProvider>
      </LoadingContextProvider>
    </SafeAreaProvider>
  )
}

const s = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: TAB_BAR_SIDE_MARGIN,
    right: TAB_BAR_SIDE_MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_BORDER_RADIUS,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    ...shadow.lg,
    paddingBottom: 0,
    paddingTop: 0,
  },
  sellFab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(20),
    ...shadow.lg,
  },
})
