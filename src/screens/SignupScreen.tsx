import React, { useRef, useState } from 'react'
import { View, KeyboardAvoidingView, ScrollView, Platform, Alert } from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import Button from '../components/Button'
import Input from '../components/Input'
import StackHeader from '../components/StackHeader'
import TextButton from '../components/TextButton'
import Colors from '../constants/Colors'
import { useAuth } from '../context/AuthContext'

export default function SignupScreen(props: StackScreenProps<RootStackParams, 'Signup'>) {
  const inputRef = useRef({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()

  async function handleSignup() {
    setLoading(true)
    try {
      await signup(inputRef.current.name, inputRef.current.email, inputRef.current.password)
      // Navigator auto-switches to authenticated stack
    } catch (e: any) {
      Alert.alert('Signup Failed', e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <StackHeader title="Sign Up" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding' })}>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Input onChangeText={t => inputRef.current.name = t} placeholder="Full Name" style={{ marginTop: 80 }} />
            <Input onChangeText={t => inputRef.current.email = t} placeholder="Email" style={{ marginTop: 20 }} textInputProps={{ keyboardType: 'email-address' }} />
            <Input onChangeText={t => inputRef.current.password = t} placeholder="Password" style={{ marginTop: 20 }} secureTextEntry />
            <Button onPress={handleSignup} style={{ width: '100%', marginTop: 60 }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </View>
          <TextButton onPress={() => props.navigation.navigate('Login')} style={{ marginTop: 20 }}>
            Already have an account? Login
          </TextButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
