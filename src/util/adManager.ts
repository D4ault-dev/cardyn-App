/**
 * adManager.ts — Backend-controlled ad configuration
 *
 * All ad IDs and enable/disable flags come from the backend.
 * No hardcoded IDs in the app — admin pastes real IDs in the admin panel.
 *
 * Flow:
 *  1. App launches → fetchAdConfig() called in App.tsx
 *  2. Config stored in memory (and cached in SecureStore)
 *  3. Ad networks initialized only if enabled === true
 *  4. When admin enables/disables an ad network → next app launch picks it up
 *
 * SDK Integration Status:
 *  - Google AdMob:  Requires expo-ads-admob or react-native-google-mobile-ads
 *                   + AdMob account + app approval
 *  - Meta Ads:      Requires react-native-fbsdk-next + Facebook App ID
 *  - TikTok Ads:    Requires tiktok-business-react-native-plugin + TikTok for Business account
 *
 * For now: config is fetched and stored. SDK calls are stubbed with TODO markers.
 * When you have real accounts, uncomment the SDK calls and paste IDs in admin panel.
 */

import client from '../api/client'
import storage from './storage'
import { Platform } from 'react-native'

const CACHE_KEY = '@tuka_ad_config'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export type AdNetworkConfig = {
  enabled: boolean
  appId:   string
  bannerId?: string
  interstitialId?: string
  rewardedId?: string
  pixelId?: string
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

// In-memory config — set once on app launch
let _config: AdConfig | null = null

const DEFAULT_CONFIG: AdConfig = {
  google: { enabled: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  meta:   { enabled: false, appId: '', bannerId: '' },
  tiktok: { enabled: false, appId: '', pixelId: '' },
  links: {
    iosStoreUrl:     'https://apps.apple.com/app/tuka',
    androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.tuka.giftcard',
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
          enabled:         !!data.google?.enabled,
          appId:           data.google?.appId         || '',
          bannerId:        data.google?.bannerId       || '',
          interstitialId:  data.google?.interstitialId || '',
          rewardedId:      data.google?.rewardedId     || '',
        },
        meta: {
          enabled:  !!data.meta?.enabled,
          appId:    data.meta?.appId    || '',
          bannerId: data.meta?.bannerId || '',
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
      // Cache for offline use
      await storage.setItem(CACHE_KEY, JSON.stringify({ config: _config, time: Date.now() }))
      return _config
    }
  } catch {
    // Network error — try cache
    try {
      const cached = await storage.getItem(CACHE_KEY)
      if (cached) {
        const { config, time } = JSON.parse(cached)
        if (Date.now() - time < CACHE_TTL) {
          _config = config
          return config
        }
      }
    } catch { /* ignore */ }
  }
  _config = DEFAULT_CONFIG
  return DEFAULT_CONFIG
}

export function getAdConfig(): AdConfig {
  return _config ?? DEFAULT_CONFIG
}

// ── Initialize ad SDKs based on config ───────────────────────────────────────

export async function initializeAdSDKs(config: AdConfig): Promise<void> {
  // ── Google AdMob ──────────────────────────────────────────────────────────
  if (config.google.enabled && config.google.appId) {
    try {
      // TODO: Uncomment when expo-ads-admob or react-native-google-mobile-ads is installed
      // import MobileAds from 'react-native-google-mobile-ads'
      // await MobileAds().initialize()
      console.log('[Ads] Google AdMob initialized with app:', config.google.appId.slice(0, 20) + '...')
    } catch (e) {
      console.warn('[Ads] Google AdMob init failed:', e)
    }
  }

  // ── Meta (Facebook) Ads ───────────────────────────────────────────────────
  if (config.meta.enabled && config.meta.appId) {
    try {
      // TODO: Uncomment when react-native-fbsdk-next is installed
      // import { Settings } from 'react-native-fbsdk-next'
      // Settings.setAppID(config.meta.appId)
      // Settings.initializeSDK()
      console.log('[Ads] Meta Ads initialized with app:', config.meta.appId)
    } catch (e) {
      console.warn('[Ads] Meta Ads init failed:', e)
    }
  }

  // ── TikTok Ads ────────────────────────────────────────────────────────────
  if (config.tiktok.enabled && config.tiktok.appId) {
    try {
      // TODO: Uncomment when tiktok-business-react-native-plugin is installed
      // import TikTokBusiness from 'tiktok-business-react-native-plugin'
      // TikTokBusiness.initializeSdk({ appId: config.tiktok.appId })
      console.log('[Ads] TikTok Ads initialized with app:', config.tiktok.appId)
    } catch (e) {
      console.warn('[Ads] TikTok Ads init failed:', e)
    }
  }
}

// ── Ad event tracking ─────────────────────────────────────────────────────────

/**
 * Track a conversion event across all enabled ad networks.
 * Call this alongside Analytics.* events for ad attribution.
 */
export function trackAdEvent(
  eventName: 'AppInstall' | 'Registration' | 'Login' | 'Purchase' | 'ViewContent' | 'AddToCart',
  params?: Record<string, any>
) {
  const config = getAdConfig()

  // Google — via Firebase Analytics (already wired in analytics.ts)
  // No extra call needed — Firebase events are picked up by Google Ads automatically

  // Meta
  if (config.meta.enabled) {
    try {
      // TODO: import { AppEventsLogger } from 'react-native-fbsdk-next'
      // AppEventsLogger.logEvent(eventName, params)
    } catch { /* ignore */ }
  }

  // TikTok
  if (config.tiktok.enabled) {
    try {
      // TODO: import TikTokBusiness from 'tiktok-business-react-native-plugin'
      // TikTokBusiness.trackEvent(eventName, params)
    } catch { /* ignore */ }
  }
}

// ── Store URL helper ──────────────────────────────────────────────────────────

export function getStoreUrl(): string {
  const config = getAdConfig()
  return Platform.OS === 'ios'
    ? config.links.iosStoreUrl
    : config.links.androidStoreUrl
}
