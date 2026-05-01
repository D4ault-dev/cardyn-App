import React, { useRef, useState } from 'react'
import { View, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import Button from '../components/Button'
import Input from '../components/Input'
import StackHeader from '../components/StackHeader'
import Colors from '../constants/Colors'
import { useAuth } from '../context/AuthContext'

export default function PasswordResetScreen(props: StackScreenProps<RootStackParams, 'PasswordReset'>) {
  const emailRef = useRef('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  async function handleReset() {
    setLoading(true)
    try {
      await resetPassword(emailRef.current)
      Alert.alert('Done', 'If that email exists, a reset link has been sent.')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <StackHeader title="Recover" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding' })}>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Input onChangeText={t => emailRef.current = t} placeholder="Email" style={{ marginTop: 80 }} textInputProps={{ keyboardType: 'email-address' }} />
            <Button onPress={handleReset} style={{ width: '100%', marginTop: 60 }}>
              {loading ? 'Sending...' : 'Reset Password'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
