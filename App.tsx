import 'react-native-gesture-handler'
import React, { useEffect, useRef } from 'react'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { Feather } from '@expo/vector-icons'
import { View, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import * as ExpoLinking from 'expo-linking'
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
    'https://fufucards.app',
    'tuka://',
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
import { LoadingContextProvider } from './src/context/LoadingContext'
import { DrawerProvider } from './src/context/DrawerContext'
import { AppDrawer } from './src/components/AppDrawer'
import { colors, spacing, radius, typography, shadow } from './src/theme'
import { prefetchCredentials } from './src/api/socialAuth'
import { setupNotificationListeners } from './src/util/pushNotifications'
import { initFirebase } from './src/firebaseInit'
import { Analytics } from './src/util/analytics'

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

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator<RootStackParams>()

function Tabs() {
  const insets = useSafeAreaInsets()
  // On Android with gesture nav: insets.bottom = 0 (gestures) or ~24-48 (3-button nav)
  // On iOS: insets.bottom = 34 (home indicator) or 0 (older devices)
  // We always add a minimum gap of 8px above the system nav area
  const bottomInset  = insets.bottom
  // Add 16px gap above Android nav bar so tab bar doesn't touch it
  const tabBarBottom = Platform.OS === 'android' ? Math.max(bottomInset + 16, 24) : 24

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
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, next, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width * 0.92, 0],
                  }),
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 0.9, 1],
              }),
            },
            ...(next ? {
              overlayStyle: {
                opacity: next.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.15],
                }),
              },
            } : {}),
          }
        },
        // Android: timing feels crisper than spring (no overshoot on low-end devices)
        // iOS: spring gives the native feel
        transitionSpec: Platform.OS === 'android' ? {
          open:  { animation: 'timing', config: { duration: 280 } },
          close: { animation: 'timing', config: { duration: 220 } },
        } : {
          open: {
            animation: 'spring',
            config: {
              stiffness: 280,
              damping: 32,
              mass: 1,
              overshootClamping: false,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
          close: {
            animation: 'spring',
            config: {
              stiffness: 280,
              damping: 32,
              mass: 1,
              overshootClamping: false,
              restDisplacementThreshold: 0.01,
              restSpeedThreshold: 0.01,
            },
          },
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
            <Stack.Screen name="WithdrawDetail"  component={WithdrawDetailScreen as any} />
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

function AppContent() {
  const { isLoading } = useAuth()
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }
  return (
    <>
      {/* expo-status-bar handles iOS */}
      <StatusBar style="light" backgroundColor="#003C8B" translucent={false} />
      {/* react-native StatusBar for Android runtime override */}
      {Platform.OS === 'android' && (
        <RNStatusBar backgroundColor="#000000" barStyle="light-content" translucent={false} />
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

    // ── Android system navigation bar ──────────────────────────────────────
    if (Platform.OS === 'android') {
      // Force status bar navy with white icons
      RNStatusBar.setBackgroundColor('#003C8B', true)
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
    <SafeAreaProvider>
      <LoadingContextProvider>
        <AuthProvider>
          <AppContent />
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
