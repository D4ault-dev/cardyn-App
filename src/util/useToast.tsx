import React, { useState, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius } from '../theme'

type ToastType = 'success' | 'error'

export function useToast() {
  const opacity  = useRef(new Animated.Value(0)).current
  const [visible, setVisible] = useState(false)
  const [msg, setMsg]         = useState('')
  const [type, setType]       = useState<ToastType>('success')

  function show(message: string, toastType: ToastType = 'success') {
    setMsg(message)
    setType(toastType)
    setVisible(true)
    opacity.setValue(0)
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setVisible(false))
  }

  function showSuccess(message = 'Update successful') { show(message, 'success') }
  function showError(message = 'Something went wrong') { show(message, 'error') }

  const Toast = visible ? (
    <Animated.View style={[
      s.toast,
      { opacity },
      type === 'error' && s.toastError,
    ]}>
      <View style={[s.iconCircle, type === 'error' && s.iconCircleError]}>
        <Feather
          name={type === 'success' ? 'check' : 'x'}
          size={16}
          color="#fff"
        />
      </View>
      <Text style={s.toastTxt}>{msg}</Text>
    </Animated.View>
  ) : null

  return { show, showSuccess, showError, Toast }
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '40%',
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 160,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  toastError: {
    backgroundColor: 'rgba(220,38,38,0.92)',
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[1],
  },
  iconCircleError: {
    borderColor: '#fff',
  },
  toastTxt: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: '#fff',
    textAlign: 'center',
  },
})
