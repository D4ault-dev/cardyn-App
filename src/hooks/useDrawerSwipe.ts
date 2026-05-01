import { useRef } from 'react'
import { Animated, PanResponder } from 'react-native'
import { useDrawer, DRAWER_W } from '../context/DrawerContext'

/**
 * Returns panHandlers to attach to any screen's root view.
 * Swipe right from the left edge (first 40px) to open the drawer.
 */
export function useDrawerSwipe() {
  const { drawerVisible, drawerAnim, overlayAnim, open, close } = useDrawer()

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !drawerVisible &&
        g.dx > 8 &&
        g.dx > Math.abs(g.dy) * 1.5 &&
        g.moveX < 40,
      onPanResponderGrant: () => {
        // Make drawer visible immediately so it follows the finger
        open()
        // But reset to closed position so we can animate from finger position
        drawerAnim.setValue(-DRAWER_W)
        overlayAnim.setValue(0)
      },
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) {
          drawerAnim.setValue(Math.min(0, -DRAWER_W + g.dx))
          overlayAnim.setValue(Math.min(1, g.dx / DRAWER_W))
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > DRAWER_W * 0.35 || g.vx > 0.4) {
          Animated.parallel([
            Animated.spring(drawerAnim,  { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
            Animated.timing(overlayAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start()
        } else {
          Animated.parallel([
            Animated.timing(drawerAnim,  { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 0,          duration: 200, useNativeDriver: true }),
          ]).start(close)
        }
      },
    })
  ).current

  return pan.panHandlers
}
