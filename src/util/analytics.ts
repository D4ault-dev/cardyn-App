/**
 * analytics.ts — Tuka unified analytics layer
 *
 * Wraps Firebase Analytics with:
 *  - Safe no-op fallback when Firebase isn't configured yet
 *  - Anonymous session tracking (users who install but never log in)
 *  - Attribution tracking (which ad → which install → which login)
 *  - Full funnel: install → onboarding → signup → login → trade → withdraw
 *  - Ad platform compatible event names (Facebook, TikTok, Google Ads)
 *
 * Usage:
 *   import { Analytics } from '../util/analytics'
 *   Analytics.login({ method: 'phone', country: 'Nigeria' })
 */

import { getFirebaseAnalytics } from '../firebaseInit'
import {
  logEvent,
  setUserId,
  setUserProperties,
  Analytics as FirebaseAnalytics,
} from 'firebase/analytics'
import storage from './storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { trackInstall, trackRegistration, trackLogin, trackPurchase } from './adManager'

// ── Session / attribution storage keys ───────────────────────────────────────
const ATTR_KEY        = '@tuka_attribution'      // { source, medium, campaign, content }
const SESSION_KEY     = '@tuka_session_start'    // ISO timestamp of first open
const ANON_ID_KEY     = '@tuka_anon_id'          // random ID for pre-login users
const FIRST_OPEN_KEY  = '@tuka_first_open_done'  // flag — fired only once

// ── Helpers ───────────────────────────────────────────────────────────────────

function ga(): FirebaseAnalytics | null {
  return getFirebaseAnalytics()
}

function safe(fn: () => void) {
  try { fn() } catch { /* never crash the app over analytics */ }
}

function fire(eventName: string, params?: Record<string, any>) {
  safe(() => {
    const instance = ga()
    if (!instance) return
    logEvent(instance, eventName, {
      platform: Platform.OS,           // 'ios' | 'android'
      app_version: Constants.expoConfig?.version ?? '1.0.0',
      ...params,
    })
  })
}

/** Generate a random anonymous ID for pre-login tracking */
async function getOrCreateAnonId(): Promise<string> {
  let id = await storage.getItem(ANON_ID_KEY)
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await storage.setItem(ANON_ID_KEY, id)
  }
  return id
}

// ── Attribution ───────────────────────────────────────────────────────────────

export type Attribution = {
  source?:   string   // 'facebook' | 'tiktok' | 'google' | 'organic'
  medium?:   string   // 'cpc' | 'social' | 'email'
  campaign?: string   // 'nigeria_launch' | 'ghana_q3' etc.
  content?:  string   // ad creative ID
}

/** Call this when the app opens via a deep link / dynamic link with UTM params */
export async function saveAttribution(attr: Attribution) {
  await storage.setItem(ATTR_KEY, JSON.stringify(attr))
}

async function loadAttribution(): Promise<Attribution> {
  try {
    const raw = await storage.getItem(ATTR_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── Core Analytics object ─────────────────────────────────────────────────────

export const Analytics = {

  // ── App lifecycle ────────────────────────────────────────────────────────

  /**
   * Call once on app start (in App.tsx or root component).
   * Tracks anonymous users who install but never log in.
   */
  async appOpen() {
    const anonId = await getOrCreateAnonId()
    const attr   = await loadAttribution()

    // Set anonymous user ID so Firebase can track pre-login funnel
    safe(() => {
      const instance = ga()
      if (!instance) return
      setUserId(instance, anonId)
    })

    // First open ever — fire once per install
    const firstOpenDone = await storage.getItem(FIRST_OPEN_KEY)
    if (!firstOpenDone) {
      await storage.setItem(FIRST_OPEN_KEY, 'true')
      await storage.setItem(SESSION_KEY, new Date().toISOString())
      fire('first_open', {
        anon_id:  anonId,
        source:   attr.source   ?? 'organic',
        medium:   attr.medium   ?? 'none',
        campaign: attr.campaign ?? 'none',
        content:  attr.content  ?? 'none',
      })
      // Fire install event on Meta + TikTok (once per install)
      trackInstall().catch(() => {})
    }

    // Every open
    fire('app_open', {
      anon_id:  anonId,
      source:   attr.source   ?? 'organic',
      campaign: attr.campaign ?? 'none',
    })
  },

  // ── Onboarding ───────────────────────────────────────────────────────────

  onboardingSlideView(slideIndex: number, slideTitle: string) {
    fire('onboarding_slide_view', { slide_index: slideIndex, slide_title: slideTitle })
  },

  onboardingCompleted() {
    fire('tutorial_complete')   // standard Firebase event — maps to Facebook CompleteRegistration
  },

  onboardingSkipped(atSlide: number) {
    fire('onboarding_skipped', { at_slide: atSlide })
  },

  // ── Auth funnel ──────────────────────────────────────────────────────────

  signupStarted(method: 'phone' | 'email' | 'google' | 'apple', country: string) {
    fire('sign_up_started', { method, country })
  },

  otpRequested(country: string) {
    fire('otp_requested', { country })
  },

  otpVerified(country: string) {
    fire('otp_verified', { country })
  },

  otpFailed(country: string) {
    fire('otp_failed', { country })
  },

  /**
   * Fired on successful signup — maps to:
   *  - Firebase: sign_up
   *  - Facebook: CompleteRegistration
   *  - TikTok:   Registration
   *  - Google:   sign_up conversion
   */
  async signup(params: {
    method:  'phone' | 'email' | 'google' | 'apple'
    country: string
    userId:  string
  }) {
    const attr = await loadAttribution()

    // Switch from anon ID to real user ID
    safe(() => {
      const instance = ga()
      if (!instance) return
      setUserId(instance, params.userId)
      setUserProperties(instance, {
        country:      params.country,
        signup_method: params.method,
        user_type:    'registered',
      })
    })

    fire('sign_up', {
      method:   params.method,
      country:  params.country,
      source:   attr.source   ?? 'organic',
      campaign: attr.campaign ?? 'none',
    })

    // Facebook-compatible alias
    fire('CompleteRegistration', {
      method:  params.method,
      country: params.country,
    })

    // Fire on Meta + TikTok
    trackRegistration({ method: params.method, country: params.country, userId: params.userId }).catch(() => {})
  },

  /**
   * Fired on successful login — maps to:
   *  - Firebase: login
   *  - Facebook: custom login event
   *  - TikTok:   Login
   */
  async login(params: {
    method:  'phone' | 'email' | 'google' | 'apple' | 'biometric'
    country: string
    userId:  string
  }) {
    const attr = await loadAttribution()

    // Upgrade from anon ID to real user ID
    safe(() => {
      const instance = ga()
      if (!instance) return
      setUserId(instance, params.userId)
      setUserProperties(instance, {
        country:      params.country,
        login_method: params.method,
        user_type:    'registered',
      })
    })

    fire('login', {
      method:   params.method,
      country:  params.country,
      source:   attr.source   ?? 'organic',
      campaign: attr.campaign ?? 'none',
    })
  },

  logout() {
    fire('logout')
    // Reset to anon ID after logout
    safe(async () => {
      const anonId = await getOrCreateAnonId()
      const instance = ga()
      if (!instance) return
      setUserId(instance, anonId)
      setUserProperties(instance, { user_type: 'anonymous' })
    })
  },

  loginFailed(method: string, reason: string) {
    fire('login_failed', { method, reason })
  },

  passwordResetRequested() {
    fire('password_reset_requested')
  },

  // ── Trading funnel ───────────────────────────────────────────────────────

  /**
   * User taps "Sell" on a card — top of trade funnel
   * Maps to Facebook: ViewContent / TikTok: ViewContent
   */
  cardViewed(params: { cardId: number; cardName: string; country: string }) {
    fire('view_item', {
      item_id:       String(params.cardId),
      item_name:     params.cardName,
      item_category: 'gift_card',
      country:       params.country,
    })
    fire('ViewContent', { content_name: params.cardName, country: params.country })
  },

  /**
   * User fills in amount — mid funnel
   * Maps to Facebook: AddToCart / TikTok: AddToCart
   */
  tradeAmountEntered(params: {
    cardId:   number
    cardName: string
    amount:   number
    currency: string
    country:  string
  }) {
    fire('add_to_cart', {
      item_id:   String(params.cardId),
      item_name: params.cardName,
      value:     params.amount,
      currency:  params.currency,
      country:   params.country,
    })
  },

  /**
   * User submits a trade — conversion event
   * Maps to Facebook: Purchase / TikTok: PlaceAnOrder / Google: purchase
   */
  tradeSubmitted(params: {
    orderId:   string
    cardId:    number
    cardName:  string
    amount:    number      // face value in USD
    payout:    number      // local currency payout
    currency:  string      // 'NGN' | 'GHS' etc.
    country:   string
    mode:      'Fast' | 'Slow'
  }) {
    fire('purchase', {
      transaction_id: params.orderId,
      value:          params.payout,
      currency:       params.currency,
      items: [{
        item_id:   String(params.cardId),
        item_name: params.cardName,
        quantity:  1,
        price:     params.amount,
      }],
      country:  params.country,
      trade_mode: params.mode,
    })

    // Facebook / TikTok alias
    fire('Purchase', {
      content_ids:  [String(params.cardId)],
      content_name: params.cardName,
      value:        params.payout,
      currency:     params.currency,
      country:      params.country,
    })
  },

  tradeApproved(params: { orderId: string; country: string }) {
    fire('trade_approved', params)
  },

  tradeRejected(params: { orderId: string; reason: string; country: string }) {
    fire('trade_rejected', params)
  },

  // ── Wallet / withdrawal ──────────────────────────────────────────────────

  withdrawInitiated(params: { amount: number; currency: string; country: string }) {
    fire('withdraw_initiated', params)
  },

  withdrawCompleted(params: { amount: number; currency: string; country: string }) {
    fire('withdraw_completed', params)
  },

  // ── Engagement ───────────────────────────────────────────────────────────

  screenView(screenName: string) {
    fire('screen_view', { screen_name: screenName, screen_class: screenName })
  },

  dailyCheckIn(params: { streak: number; points: number; country: string }) {
    fire('daily_check_in', params)
  },

  couponApplied(params: { code: string; discount: number }) {
    fire('coupon_applied', params)
  },

  referralShared(params: { code: string; country: string }) {
    fire('share', { method: 'referral', content_type: 'referral_code', ...params })
  },

  notificationReceived(params: { type: string }) {
    fire('notification_received', params)
  },

  // ── Ad attribution deep link ─────────────────────────────────────────────

  /**
   * Call this when the app opens from a deep link.
   * Parses UTM params and saves attribution for the full session.
   *
   * Example link: tuka://open?utm_source=facebook&utm_campaign=nigeria_launch
   */
  async handleDeepLink(url: string) {
    try {
      const parsed = new URL(url)
      const attr: Attribution = {
        source:   parsed.searchParams.get('utm_source')   ?? undefined,
        medium:   parsed.searchParams.get('utm_medium')   ?? undefined,
        campaign: parsed.searchParams.get('utm_campaign') ?? undefined,
        content:  parsed.searchParams.get('utm_content')  ?? undefined,
      }
      if (attr.source) {
        await saveAttribution(attr)
        fire('deep_link_open', {
          source:   attr.source,
          medium:   attr.medium   ?? 'none',
          campaign: attr.campaign ?? 'none',
          url,
        })
      }
    } catch { /* malformed URL — ignore */ }
  },
}
