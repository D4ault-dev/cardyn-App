import { RF } from '../util/responsive'
/**
 * DailyCheckInModal — shows once per day when user opens the app.
 *
 * Two-step flow:
 *  Step 1 — "Claim" screen: shows coins earned, user taps "Claim Coins"
 *  Step 2 — "Claimed" screen: confirms claim, offers "View Leaderboard" or "Close"
 *
 * This makes the reward feel earned rather than automatic.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import storage from '../util/storage'
import client from '../api/client'

const CHECKIN_KEY = '@tuka_last_checkin'

interface Props {
  visible: boolean
  points: number
  streak: number
  onClose: () => void
  onViewLeaderboard?: () => void
}

export function DailyCheckInModal({ visible, points, streak, onClose, onViewLeaderboard }: Props) {
  const [claimed, setClaimed] = useState(false)

  // Card animations
  const scaleAnim   = useRef(new Animated.Value(0.75)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  // Coin bounce
  const coinAnim    = useRef(new Animated.Value(0)).current
  // Coin scale pulse on claim
  const coinScale   = useRef(new Animated.Value(1)).current
  // Checkmark scale (step 2)
  const checkScale  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setClaimed(false)
      scaleAnim.setValue(0.75)
      opacityAnim.setValue(0)
      coinAnim.setValue(0)
      coinScale.setValue(1)
      checkScale.setValue(0)

      // Card entry: scale + fade
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1, useNativeDriver: true, tension: 80, friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 260, useNativeDriver: true,
        }),
      ]).start(() => {
        // Coin bounces up then settles
        Animated.sequence([
          Animated.timing(coinAnim, { toValue: -14, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.spring(coinAnim, { toValue: 0, useNativeDriver: true, tension: 140, friction: 6 }),
        ]).start()
      })
    } else {
      setClaimed(false)
    }
  }, [visible])

  function handleClaim() {
    setClaimed(true)

    // Coin explodes then shrinks
    Animated.sequence([
      Animated.spring(coinScale, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 5 }),
      Animated.timing(coinScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()

    // Checkmark pops in
    setTimeout(() => {
      Animated.spring(checkScale, {
        toValue: 1, useNativeDriver: true, tension: 120, friction: 7,
      }).start()
    }, 180)
  }

  if (!visible) return null

  const nextPts = Math.min(points + 2, 10)

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[m.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[m.card, { transform: [{ scale: scaleAnim }] }]}>

          {!claimed ? (
            /* ── Step 1: Claim screen ── */
            <>
              <Text style={m.title}>🎉 Daily Reward Ready!</Text>

              {/* Animated coin */}
              <Animated.View style={[m.coinWrap, { transform: [{ translateY: coinAnim }, { scale: coinScale }] }]}>
                <View style={m.coinCircle}>
                  <Text style={m.coinEmoji}>🪙</Text>
                </View>
                <Text style={m.pts}>+{points}</Text>
              </Animated.View>

              {/* Streak */}
              <View style={m.streakBadge}>
                <Text style={m.streakEmoji}>🔥</Text>
                <Text style={m.streakTxt}>Day {streak} streak</Text>
              </View>

              {/* Next day hint */}
              <Text style={m.nextTxt}>
                Come back tomorrow for +{nextPts} coins
              </Text>

              {/* Claim button — orange CTA */}
              <TouchableOpacity style={m.claimBtn} onPress={handleClaim} activeOpacity={0.85}>
                <Text style={m.claimBtnTxt}>Claim {points} Coins</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={m.skipBtn}>
                <Text style={m.skipTxt}>Skip</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ── Step 2: Claimed screen ── */
            <>
              {/* Animated checkmark */}
              <Animated.View style={[m.checkWrap, { transform: [{ scale: checkScale }] }]}>
                <View style={m.checkCircle}>
                  <Feather name="check" size={32} color="#fff" />
                </View>
              </Animated.View>

              <Text style={m.claimedTitle}>Coins Claimed! 🎊</Text>
              <Text style={m.claimedSub}>
                +{points} coins added to your balance.{'\n'}
                Keep your streak going!
              </Text>

              {/* View Leaderboard — primary action */}
              <TouchableOpacity
                style={m.leaderBtn}
                onPress={() => { onClose(); onViewLeaderboard?.() }}
                activeOpacity={0.85}>
                <Feather name="award" size={16} color="#fff" style={{ marginRight: spacing[2] }} />
                <Text style={m.leaderBtnTxt}>View Leaderboard</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={m.skipBtn}>
                <Text style={m.skipTxt}>Close</Text>
              </TouchableOpacity>
            </>
          )}

        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDailyCheckIn() {
  const [show, setShow]     = useState(false)
  const [points, setPoints] = useState(2)
  const [streak, setStreak] = useState(1)

  async function check() {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const last  = await storage.getItem(CHECKIN_KEY)
      if (last === today) return

      const streakRes = await client.get('/tuka/user/streak').catch(() => null)
      const streakData = streakRes?.data?.data || {}

      const storedPts = await storage.getItem('@tuka_login_points_awarded')
      const displayPts = storedPts ? parseInt(storedPts, 10) : (streakData.todayPoints || 2)
      await storage.removeItem('@tuka_login_points_awarded')

      // Only show if points were actually awarded
      if (displayPts <= 0) return

      setPoints(displayPts)
      setStreak(streakData.currentStreak || 1)
      setShow(true)
      await storage.setItem(CHECKIN_KEY, today)
    } catch { /* silently skip */ }
  }

  function dismiss() { setShow(false) }

  async function resetForTesting() {
    await storage.removeItem(CHECKIN_KEY)
  }

  return { show, points, streak, check, dismiss, resetForTesting }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[7],
    alignItems: 'center',
    width: '100%',
    ...shadow.lg,
  },

  // Step 1
  title: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[5], textAlign: 'center',
  },
  coinWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginBottom: spacing[4],
  },
  coinCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#FFF8E6',
    borderWidth: 3, borderColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
  },
  coinEmoji: { fontSize: RF(32) },
  pts: {
    fontSize: RF(52), fontWeight: typography.weight.extrabold,
    color: '#F59E0B', letterSpacing: -2,
  },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: '#FFF3E0', borderRadius: radius.full,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  streakEmoji: { fontSize: RF(16) },
  streakTxt: {
    fontSize: typography.size.base, color: '#E65100',
    fontWeight: typography.weight.semibold,
  },
  nextTxt: {
    fontSize: typography.size.sm, color: colors.muted,
    marginBottom: spacing[6], textAlign: 'center',
  },
  claimBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], width: '100%', alignItems: 'center',
    marginBottom: spacing[2],
  },
  claimBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: '#fff',
  },

  // Step 2
  checkWrap: { marginBottom: spacing[4] },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  claimedTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[3], textAlign: 'center',
  },
  claimedSub: {
    fontSize: typography.size.sm, color: colors.muted,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing[6],
  },
  leaderBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: spacing[4], width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  leaderBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },

  // Shared
  skipBtn: { paddingVertical: spacing[3], paddingHorizontal: spacing[6] },
  skipTxt: { fontSize: typography.size.sm, color: colors.muted },
})
