import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform} from 'react-native'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { StackScreenProps } from '@react-navigation/stack'
import { colors, typography, spacing, radius } from '../theme'

// ── FAQ data ──────────────────────────────────────────────────────────────────
const TOPICS = [
  { id: 't1', question: 'How do I create a Cardyn account?' },
]

const FAQS = [
  {
    id: 'f1',
    question: 'I have not received the OTP',
    answer: 'OTP codes can take up to 2 minutes to arrive. Check your SMS inbox and make sure your phone number is correct. You can tap "Resend" after the countdown ends.',
  },
  {
    id: 'f2',
    question: 'My phone number already exists',
    answer: 'This means an account already exists with that phone number. Try logging in instead, or contact support if you believe this is an error.',
  },
  {
    id: 'f3',
    question: 'How do I sell a gift card?',
    answer: 'Tap "Sell Card" on the home screen, select your card type, enter the card details and amount, then submit. Our team will review and credit your wallet within minutes.',
  },
  {
    id: 'f4',
    question: 'How long does payment take?',
    answer: 'Payments are processed within 5–30 minutes after your card is verified. Funds are sent directly to your registered bank account.',
  },
  {
    id: 'f5',
    question: 'How do I withdraw my balance?',
    answer: 'Go to Wallet → Withdraw, enter your bank details and amount, then confirm. Withdrawals are processed instantly to your bank account.',
  },
  {
    id: 'f6',
    question: 'What gift cards do you accept?',
    answer: 'We accept Apple iTunes, Steam, Amazon, Google Play, Razer Gold, Xbox, PlayStation, Walmart, Nordstrom, and many more. Check the home screen for the full list.',
  },
]

export default function HelpScreen(props: StackScreenProps<any, any>) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>

      <AppHeader title="Help" onBack={() => props.navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.pageTitle}>How do you want us{'\n'}to help you?</Text>

        {/* Topics */}
        <Text style={s.sectionLabel}>Topics</Text>
        <View style={s.card}>
          {TOPICS.map((t, i) => (
            <TouchableOpacity key={t.id} style={[s.topicRow, i < TOPICS.length - 1 && s.rowBorder]}
              activeOpacity={0.7}>
              <Text style={s.topicTxt}>{t.question}</Text>
              <Feather name="chevron-right" size={18} color={colors.accent} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs */}
        <Text style={s.sectionLabel}>Frequently Asked Questions</Text>
        <View style={s.card}>
          {FAQS.map((faq, i) => (
            <View key={faq.id}>
              {i > 0 && <View style={s.divider} />}
              <TouchableOpacity style={s.faqRow} onPress={() => toggle(faq.id)} activeOpacity={0.7}>
                <Text style={s.faqQuestion}>{faq.question}</Text>
                <Feather
                  name={expanded === faq.id ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.accent}
                />
              </TouchableOpacity>
              {expanded === faq.id && (
                <View style={s.faqAnswer}>
                  <Text style={s.faqAnswerTxt}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>

      {/* Still Need Help button */}
      <View style={s.footer}>
        <TouchableOpacity style={s.stillHelpBtn} activeOpacity={0.8}
          onPress={() => props.navigation.navigate('Chat')}>
          <Text style={s.stillHelpTxt}>I Still Need Help</Text>
          <Feather name="chevron-right" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Content
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  pageTitle: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.dark,
    lineHeight: 34,
    marginBottom: spacing[6],
  },

  // Section label
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.muted,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing[6],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  // Topic row
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4] + 2,
  },
  topicTxt: {
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.dark,
    marginRight: spacing[3],
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // FAQ
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[4] },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4] + 2,
  },
  faqQuestion: {
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.dark,
    marginRight: spacing[3],
  },
  faqAnswer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  faqAnswerTxt: {
    fontSize: typography.size.base,
    color: colors.muted,
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: 'transparent',
  },
  stillHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  stillHelpTxt: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
})
