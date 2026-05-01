import React, { createContext, useContext, useRef, useState, useCallback } from 'react'
import { Animated, Dimensions } from 'react-native'

const W = Dimensions.get('window').width
export const DRAWER_W = W * 0.80

type DrawerCtx = {
  drawerVisible: boolean
  drawerAnim:    Animated.Value
  overlayAnim:   Animated.Value
  open:          () => void
  close:         () => void
}

const DrawerContext = createContext<DrawerCtx | null>(null)

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [drawerVisible, setDrawerVisible] = useState(false)
  const drawerAnim  = useRef(new Animated.Value(-DRAWER_W)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  const open = useCallback(() => {
    setDrawerVisible(true)
    Animated.parallel([
      Animated.spring(drawerAnim,  { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start()
  }, [])

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerAnim,  { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0,         duration: 220, useNativeDriver: true }),
    ]).start(() => setDrawerVisible(false))
  }, [])

  return (
    <DrawerContext.Provider value={{ drawerVisible, drawerAnim, overlayAnim, open, close }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer must be used inside DrawerProvider')
  return ctx
}
