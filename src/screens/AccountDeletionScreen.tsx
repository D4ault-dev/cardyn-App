import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { ms, RF } from '../util/responsive'

export default function AccountDeletionScreen(props: StackScreenProps<RootStackParams, 'AccountDeletion'>) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account Deletion</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={s.body}>
        <View style={s.card}>
          <View style={s.iconCircle}>
            <Text style={s.iconTxt}>!</Text>
          </View>

          <Text style={s.cardTitle}>Account Deletion</Text>
          <Text style={s.cardDesc}>
            Please read the following carefully before{'\n'}continuing.
          </Text>

          <View style={s.noticeBox}>
            <Text style={s.noticeTitle}>Important Notice</Text>
            <Text style={s.noticeTxt}>
              Once your account is deleted, you will immediately lose access to your account and all related data.
            </Text>
          </View>

          <Text style={s.cardFooter}>
            Proceed only if you're completely sure about this decision.
          </Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() => props.navigation.navigate('DeleteAccountConfirm')}
          activeOpacity={0.85}
        >
          <Text style={s.deleteBtnTxt}>Continue with Deletion</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => props.navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={s.cancelBtnTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark,
  },

  body: { flex: 1, paddingTop: spacing[5] },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    ...shadow.sm,
  },

  // Orange exclamation circle — matches reference exactly
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F5A623',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  iconTxt: {
    fontSize: RF(34), fontWeight: '900', color: '#fff', lineHeight: 40,
    marginTop: -2,
  },

  cardTitle: {
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold,
    color: colors.dark, marginBottom: spacing[2], textAlign: 'center',
  },
  cardDesc: {
    fontSize: typography.size.sm, color: colors.muted,
    lineHeight: 20, marginBottom: spacing[4],
    alignSelf: 'flex-start',
  },

  // Notice box — orange tint, matches reference
  noticeBox: {
    backgroundColor: '#FFF5E6',
    borderRadius: radius.lg,
    padding: spacing[4],
    width: '100%',
    marginBottom: spacing[4],
  },
  noticeTitle: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold,
    color: '#F5A623', marginBottom: spacing[1],
  },
  noticeTxt: {
    fontSize: typography.size.sm, color: '#F5A623', lineHeight: 20,
  },

  cardFooter: {
    fontSize: typography.size.sm, color: colors.muted,
    lineHeight: 20, alignSelf: 'flex-start',
  },

  // Buttons
  bottomBar: {
    paddingHorizontal: spacing[5], paddingBottom: spacing[6], paddingTop: spacing[3],
    gap: spacing[3],
  },
  deleteBtn: {
    backgroundColor: '#F05A5A',   // coral red — matches reference
    borderRadius: radius.full,
    paddingVertical: spacing[4] + 2, alignItems: 'center',
  },
  deleteBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff',
  },
  cancelBtn: {
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: '#D0D0D0',
    paddingVertical: spacing[4] + 2, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  cancelBtnTxt: {
    fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.dark,
  },
})
