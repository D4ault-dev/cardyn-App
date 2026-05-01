import { RF } from '../util/responsive'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, ScrollView,
  Platform, Image,
} from 'react-native'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import Colors from '../constants/Colors'
import { useAuth } from '../context/AuthContext'

const BLUE = '#5B7BFE'

export default function LoginScreen(props: StackScreenProps<RootStackParams, 'Login'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  async function handleContinue() {
    setPasswordError(false)
    if (!email || !password) { setPasswordError(true); return }
    setLoading(true)
    try {
      await login(email.trim(), password)
      // Navigator auto-switches to authenticated stack — no manual navigation needed
    } catch {
      setPasswordError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding' })}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Tabs: Log in | Sign up on same line ── */}
          <View style={styles.tabs}>
            {/* Log in tab — active */}
            <TouchableOpacity style={styles.tabBtn}>
              <Text style={styles.tabActive}>Log in</Text>
              <View style={styles.tabUnderline} />
            </TouchableOpacity>

            {/* Sign up tab — inactive */}
            <TouchableOpacity
              style={styles.tabBtn}
              onPress={() => props.navigation.replace('Signup')}
            >
              <Text style={styles.tabInactive}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* ── Gap between tabs and form ── */}
          <View style={{ height: 36 }} />

          {/* ── Email ── */}
          <Text style={styles.label}>Your Email</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputText}
              placeholder="contact@example.com"
              placeholderTextColor="#BDBDBD"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* ── Password ── */}
          <View style={{ height: 16 }} />
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputBox, passwordError && styles.inputBoxError]}>
            <TextInput
              style={[styles.inputText, { flex: 1 }]}
              placeholder="••••••••••"
              placeholderTextColor="#BDBDBD"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={t => { setPassword(t); setPasswordError(false) }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#BDBDBD" />
            </TouchableOpacity>
          </View>

          {/* ── Wrong password + Forgot ── */}
          <View style={styles.belowPassword}>
            <Text style={styles.wrongText}>{passwordError ? 'Wrong password' : ''}</Text>
            <TouchableOpacity onPress={() => props.navigation.navigate('PasswordReset')}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Continue ── */}
          <TouchableOpacity
            style={[styles.continueBtn, loading && { opacity: 0.75 }]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {loading ? 'Please wait...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* ── Or divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>Or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Apple ── */}
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
            <Image
              source={require('../../assets/apple-logo.png')}
              style={styles.socialLogo}
              resizeMode="contain"
            />
            <Text style={styles.socialBtnText}>Login with Apple</Text>
          </TouchableOpacity>

          {/* ── Google ── */}
          <TouchableOpacity style={[styles.socialBtn, { marginTop: 14 }]} activeOpacity={0.8}>
            <Image
              source={require('../../assets/google-logo.png')}
              style={styles.socialLogo}
              resizeMode="contain"
            />
            <Text style={styles.socialBtnText}>Login with Google</Text>
          </TouchableOpacity>

          {/* ── Sign up link ── */}
          <View style={styles.signupRow}>
            <Text style={styles.signupGray}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => props.navigation.replace('Signup')}>
              <Text style={styles.signupBlue}>Sign up</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },

  // ── Tabs ──
  tabs: {
    flexDirection: 'row',
    alignItems: 'flex-end',        // align bottoms so underline sits on baseline
    justifyContent: 'center',      // centered on screen
    gap: 40,                       // space between Log in and Sign up
  },
  tabBtn: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  tabActive: {
    fontSize: RF(20),
    fontWeight: '700',
    color: BLUE,
    marginBottom: 5,
  },
  tabInactive: {
    fontSize: RF(20),
    fontWeight: '600',
    color: '#BDBDBD',
    marginBottom: 5,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: BLUE,
    borderRadius: 2,
  },

  // ── Inputs ──
  label: {
    fontSize: RF(14),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
  },
  inputBoxError: {
    borderColor: '#F44336',
  },
  inputText: {
    fontSize: RF(15),
    color: '#1A1A1A',
  },

  // ── Below password ──
  belowPassword: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
    marginBottom: 22,
  },
  wrongText: {
    fontSize: RF(13),
    color: '#9E9E9E',
  },
  forgotText: {
    fontSize: RF(13),
    fontWeight: '600',
    color: BLUE,
  },

  // ── Continue ──
  continueBtn: {
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 28,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: RF(16),
    fontWeight: '700',
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerLabel: {
    marginHorizontal: 14,
    fontSize: RF(14),
    color: '#BDBDBD',
  },

  // ── Social ──
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
  },
  socialLogo: {
    width: 20,
    height: 20,
  },
  socialBtnText: {
    fontSize: RF(15),
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ── Sign up ──
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  signupGray: {
    fontSize: RF(14),
    color: '#9E9E9E',
  },
  signupBlue: {
    fontSize: RF(14),
    fontWeight: '700',
    color: BLUE,
  },
})
