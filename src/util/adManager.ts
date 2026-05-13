/**
 * adManager.ts — Ad SDK initialization and event tracking
 *
 * SDKs:
 *  - Firebase Analytics  → already wired in analytics.ts (Google Ads attribution)
 *  - Meta (Facebook)     → react-native-fbsdk-next
 *  - TikTok              → tiktok-business-react-native-plugin
 *
 * IDs come from the backend admin panel — no hardcoded IDs in the app.
 * app.json plugin config handles the native Meta SDK initialization.
 * TikTok SDK is initialized here after fetching config.
 */

import client from '../api/client'
import storage from './storage'
import { Platform } from 'react-native'

const CACHE_KEY = '@tuka_ad_config'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export type AdNetworkConfig = {
  enabled:         boolean
  appId:           string
  bannerId?:       string
  interstitialId?: string
  rewardedId?:     string
  pixelId?:        string
  clientToken?:    string
}

export type AdConfig = {
  google: AdNetworkConfig
  meta:   AdNetworkConfig
  tiktok: AdNetworkConfig
  links: {
    iosStoreUrl:     string
    androidStoreUrl: string
    websiteUrl:      string
  }
}

let _config: AdConfig | null = null
let _metaReady   = false
let _tiktokReady = false

const DEFAULT_CONFIG: AdConfig = {
  google: { enabled: false, appId: '' },
  meta:   { enabled: false, appId: '' },
  tiktok: { enabled: false, appId: '' },
  links: {
    iosStoreUrl:     'https://apps.apple.com/app/cardyn',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.cardyn.app',
    websiteUrl:      'https://cardyn.net',
  },
}

// ── Fetch config from backend ─────────────────────────────────────────────────

export async function fetchAdConfig(): Promise<AdConfig> {
  try {
    const res = await client.get('/tuka/adConfig/public')
    const data = res.data?.data
    if (data) {
      _config = {
        google: {
          enabled:        !!data.google?.enabled,
          appId:          data.google?.appId         || '',
          bannerId:       data.google?.bannerId       || '',
          interstitialId: data.google?.interstitialId || '',
          rewardedId:     data.google?.rewardedId     || '',
        },
        meta: {
          enabled:     !!data.meta?.enabled,
          appId:       data.meta?.appId       || '',
          clientToken: data.meta?.clientToken || '',
        },
        tiktok: {
          enabled: !!data.tiktok?.enabled,
          appId:   data.tiktok?.appId   || '',
          pixelId: data.tiktok?.pixelId || '',
        },
        links: {
          iosStoreUrl:     data.links?.iosStoreUrl     || DEFAULT_CONFIG.links.iosStoreUrl,
          androidStoreUrl: data.links?.androidStoreUrl || DEFAULT_CONFIG.links.androidStoreUrl,
          websiteUrl:      data.links?.websiteUrl      || DEFAULT_CONFIG.links.websiteUrl,
        },
      }
      await storage.setItem(CACHE_KEY, JSON.stringify({ config: _config, time: Date.now() }))
      return _config
    }
  } catch {
    try {
      const cached = await storage.getItem(CACHE_KEY)
      if (cached) {
        const { config, time } = JSON.parse(cached)
        if (Date.now() - time < CACHE_TTL) { _config = config; return config }
      }
    } catch { /* ignore */ }
  }
  _config = DEFAULT_CONFIG
  return DEFAULT_CONFIG
}

export function getAdConfig(): AdConfig { return _config ?? DEFAULT_CONFIG }

// ── Initialize SDKs ───────────────────────────────────────────────────────────

export async function initializeAdSDKs(config: AdConfig): Promise<void> {

  // ── Meta (Facebook) ───────────────────────────────────────────────────────
  // The react-native-fbsdk-next Expo plugin handles native init via app.json.
  // We just need to confirm the SDK is ready and set advertiser tracking.
  if (config.meta.enabled && config.meta.appId) {
    try {
      const { Settings } = await import('react-native-fbsdk-next')
      // Enable advertiser tracking (required for iOS 14+ ATT — add ATT prompt separately)
      Settings.setAdvertiserTrackingEnabled(true)
      _metaReady = true
      console.log('[Ads] Meta SDK ready, appId:', config.meta.appId)
    } catch (e) {
      console.warn('[Ads] Meta SDK init failed:', e)
    }
  }

  // ── TikTok ────────────────────────────────────────────────────────────────
  if (config.tiktok.enabled && config.tiktok.appId) {
    try {
      const TikTokBusiness = (await import('tiktok-business-react-native-plugin')).default
      await TikTokBusiness.initializeSdk({
        appId:   config.tiktok.appId,
        tiktokAppId: config.tiktok.appId,
        // debug mode — set to false in production
        debugMode: __DEV__,
      })
      _tiktokReady = true
      console.log('[Ads] TikTok SDK ready, appId:', config.tiktok.appId)
    } catch (e) {
      console.warn('[Ads] TikTok SDK init failed:', e)
    }
  }
}

// ── Event tracking ────────────────────────────────────────────────────────────

type AdEventName =
  | 'INSTALL_APP'
  | 'REGISTER'
  | 'LOGIN'
  | 'PURCHASE'
  | 'VIEW_CONTENT'
  | 'ADD_TO_CART'

/**
 * Track a conversion event across Meta + TikTok.
 * Firebase/Google Ads attribution is handled automatically via analytics.ts.
 *
 * Call this alongside Analytics.* events.
 */
export async function trackAdEvent(
  eventName: AdEventName | string,
  params?: Record<string, any>
): Promise<void> {

  // ── Meta ──────────────────────────────────────────────────────────────────
  if (_metaReady) {
    try {
      const { AppEventsLogger } = await import('react-native-fbsdk-next')
      // Map to Facebook standard events
      const fbEventMap: Record<string, string> = {
        INSTALL_APP:  'fb_mobile_activate_app',
        REGISTER:     'fb_mobile_complete_registration',
        LOGIN:        'fb_mobile_login',
        PURCHASE:     'fb_mobile_purchase',
        VIEW_CONTENT: 'fb_mobile_content_view',
        ADD_TO_CART:  'fb_mobile_add_to_cart',
      }
      const fbEvent = fbEventMap[eventName] || eventName
      AppEventsLogger.logEvent(fbEvent, params)
    } catch (e) {
      console.warn('[Ads] Meta event failed:', e)
    }
  }

  // ── TikTok ────────────────────────────────────────────────────────────────
  if (_tiktokReady) {
    try {
      const TikTokBusiness = (await import('tiktok-business-react-native-plugin')).default
      // Map to TikTok standard events
      const ttEventMap: Record<string, string> = {
        INSTALL_APP:  'InstallApp',
        REGISTER:     'Registration',
        LOGIN:        'Login',
        PURCHASE:     'PlaceAnOrder',
        VIEW_CONTENT: 'ViewContent',
        ADD_TO_CART:  'AddToCart',
      }
      const ttEvent = ttEventMap[eventName] || eventName
      TikTokBusiness.trackEvent(ttEvent, params || {})
    } catch (e) {
      console.warn('[Ads] TikTok event failed:', e)
    }
  }
}

// ── Specific event helpers ────────────────────────────────────────────────────

/** Call once on first app open — tracks install attribution */
export async function trackInstall(): Promise<void> {
  await trackAdEvent('INSTALL_APP')
}

/** Call after successful registration */
export async function trackRegistration(params: {
  method: string
  country: string
  userId: string
}): Promise<void> {
  await trackAdEvent('REGISTER', {
    fb_registration_method: params.method,
    country: params.country,
  })
}

/** Call after successful login */
export async function trackLogin(params: {
  method: string
  country: string
}): Promise<void> {
  await trackAdEvent('LOGIN', {
    fb_login_method: params.method,
    country: params.country,
  })
}

/** Call after a trade is submitted */
export async function trackPurchase(params: {
  orderId:  string
  value:    number
  currency: string
  cardName: string
}): Promise<void> {
  await trackAdEvent('PURCHASE', {
    fb_order_id:      params.orderId,
    fb_content_type:  'gift_card',
    fb_content:       params.cardName,
    value:            params.value,
    currency:         params.currency,
  })
}

export function getStoreUrl(): string {
  const config = getAdConfig()
  return Platform.OS === 'ios'
    ? config.links.iosStoreUrl
    : config.links.androidStoreUrl
}
