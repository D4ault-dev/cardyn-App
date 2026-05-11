import 'react-native-gesture-handler'
import React, { useEffect, useRef, useState } from 'react'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Feather } from '@expo/vector-icons'
import { View, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import * as ExpoLinking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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
import { colors, spacing, radius, typography, shadow } from './src/theme'
import { prefetchCredentials } from './src/api/socialAuth'
import { setupNotificationListeners } from './src/util/pushNotifications'
import { initFirebase } from './src/firebaseInit'
import { Analytics } from './src/util/analytics'
import { fetchAdConfig, initializeAdSDKs } from './src/util/adManager'

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
import WithdrawAmountScreen from './src/screens/WithdrawAmountScreen'
import WithdrawPinScreen from './src/screens/WithdrawPinScreen'
import OrderDetailScreen from './src/screens/OrderDetailScreen'
import AddBankScreen from './src/screens/AddBankScreen'
import SelectBankScreen from './src/screens/SelectBankScreen'
import WithdrawDetailScreen from './src/screens/WithdrawDetailScreen'
import WithdrawalHistoryScreen from './src/screens/WithdrawalHistoryScreen'
import AccountSettingsScreen from './src/screens/AccountSettingsScreen'
import ProfileEditScreen from './src/screens/ProfileEditScreen'
import VerifyIdentityScreen from './src/screens/VerifyIdentityScreen'
import ModifyPasswordScreen from './src/screens/ModifyPasswordScreen'
import SecuritySettingsScreen from './src/screens/SecuritySettingsScreen'
import AccountDeletionScreen from './src/screens/AccountDeletionScreen'
import DeleteAccountConfirmScreen from './src/screens/DeleteAccountConfirmScreen'
import WithdrawPasswordScreen from './src/screens/WithdrawPasswordScreen'
import UpdateEmailScreen from './src/screens/UpdateEmailScreen'
import LeaderboardScreen    from './src/screens/LeaderboardScreen'
import DailyBonusScreen     from './src/screens/DailyBonusScreen'
import CouponScreen         from './src/screens/CouponScreen'
import AlertsScreen         from './src/screens/AlertsScreen'
import HelpScreen           from './src/screens/HelpScreen'
import ChatScreen           from './src/screens/ChatScreen'
import ArticleDetailScreen  from './src/screens/ArticleDetailScreen'
import ReferralScreen       from './src/screens/ReferralScreen'
import CardPickerScreen     from './src/screens/CardPickerScreen'
import RateCalculatorScreen  from './src/screens/RateCalculatorScreen'
import BindPhoneScreen       from './src/screens/BindPhoneScreen'
import RateAlertScreen       from './src/screens/RateAlertScreen'
import RateAlertListScreen   from './src/screens/RateAlertListScreen'
import SplashAnimationScreen from './src/screens/SplashAnimationScreen'

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
    <NavigationContainer ref={navigationRef} linking={linking} theme={{ dark: true, colors: { background: colors.primary, card: colors.primary, text: '#fff', border: 'transparent', notification: colors.accent, primary: colors.accent } }}>
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

function AppContent() {
  const { isLoading } = useAuth()
  const [splashDone, setSplashDone] = useState(false)

  // While auth is loading, show dark background — no white flash
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
      <StatusBar style="light" translucent={true} />
      {Platform.OS === 'android' && (
        <RNStatusBar 
          backgroundColor="rgba(13, 31, 36, 0.85)" 
          barStyle="light-content" 
          translucent={true}
        />
      )}
      <RootNavigator />
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
      // Note: NavigationBar color/button APIs are no-ops in SDK 53+ (edge-to-edge)
      // The system handles nav bar appearance automatically
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
    <SafeAreaProvider style={{ backgroundColor: '#0D1F24' }}>
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
