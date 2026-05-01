import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Animated,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import client from '../api/client'
import { ms } from '../util/responsive'

const GREEN = '#2E7D5E'
const GREEN_LIGHT = '#E8F5EE'

type RateAlert = {
  id: number
  categoryId: number
  categoryName: string
  currency: string
  faceValue: string
  inputType: string
  currentRate: number
  targetRate: number
  createdAt?: string
}

function formatDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function RateAlertListScreen(props: StackScreenProps<RootStackParams, 'RateAlertList'>) {
  const insets = useSafeAreaInsets()
  const params = (props.route?.params as any) || {}

  const [alerts, setAlerts]     = useState<RateAlert[]>([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [toastVisible, setToastVisible] = useState(false)
  const toastAnim = React.useRef(new Animated.Value(0)).current

  const showToast = useCallback(() => {
    setToastVisible(true)
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false))
  }, [toastAnim])

  useEffect(() => {
    if (params.success) showToast()
    loadAlerts()
  }, [])

  async function loadAlerts() {
    setLoading(true)
    try {
      const res = await client.get('/tuka/rateAlert/my')
      setAlerts(res.data?.data || [])
      setLastUpdate(new Date())
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  function renderItem({ item }: { item: RateAlert }) {
    const title = `${item.categoryName} -${item.currency}-${item.inputType}(${item.faceValue})`
    return (
      <TouchableOpacity style={s.alertRow} activeOpacity={0.7}>
        <View style={s.alertInfo}>
          <Text style={s.alertTitle} numberOfLines={2}>{title}</Text>
          <View style={s.alertRates}>
            <Text style={s.currentRate}>
              Current Rate: {item.currentRate?.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '—'}
            </Text>
            <Text style={s.setRate}>
              Set Rate: {item.targetRate?.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '—'}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.border} />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => props.navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rate Alert List</Text>
        <TouchableOpacity style={s.infoBtn}>
          <Feather name="info" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Update row */}
      <View style={s.updateRow}>
        <Text style={s.lastUpdate}>Last update: {formatDate(lastUpdate)}</Text>
        <TouchableOpacity onPress={loadAlerts}>
          <Text style={s.updateRealtime}>Update Real-time</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: spacing[8] }} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={a => String(a.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={alerts.length === 0 ? s.emptyContainer : { paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="bell-off" size={48} color={colors.border} />
              <Text style={s.emptyTxt}>No rate alerts yet</Text>
            </View>
          }
        />
      )}

      {/* Bottom button */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={s.newAlertBtn}
          activeOpacity={0.85}
          onPress={() => props.navigation.navigate('RateAlert' as any)}>
          <Text style={s.newAlertBtnTxt}>Set New Rate Alert</Text>
        </TouchableOpacity>
      </View>

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[s.toast, { opacity: toastAnim }]}>
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={s.toastTxt}>Rate target created successfully.</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark,
  },
  infoBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.sm,
  },

  updateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
  },
  lastUpdate: { fontSize: typography.size.xs, color: colors.muted },
  updateRealtime: { fontSize: typography.size.xs, color: GREEN, fontWeight: typography.weight.semibold },

  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    borderRadius: radius.xl, padding: spacing[4],
    ...shadow.sm,
  },
  alertInfo: { flex: 1 },
  alertTitle: {
    fontSize: typography.size.base, fontWeight: typography.weight.semibold,
    color: colors.dark, marginBottom: spacing[2],
  },
  alertRates: { flexDirection: 'row', gap: spacing[3] },
  currentRate: { fontSize: typography.size.sm, color: GREEN, fontWeight: typography.weight.medium },
  setRate:     { fontSize: typography.size.sm, color: colors.warning, fontWeight: typography.weight.medium },

  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTxt: { fontSize: typography.size.base, color: colors.muted, marginTop: spacing[3] },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing[4], paddingBottom: spacing[8], paddingTop: spacing[3],
    backgroundColor: colors.background,
  },
  newAlertBtn: {
    backgroundColor: GREEN, borderRadius: radius.full,
    paddingVertical: spacing[4], alignItems: 'center', justifyContent: 'center',
  },
  newAlertBtnTxt: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: '#fff' },

  toast: {
    position: 'absolute', bottom: 100, left: spacing[4], right: spacing[4],
    backgroundColor: GREEN, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[4],
    ...shadow.md,
  },
  toastTxt: { fontSize: typography.size.sm, color: '#fff', fontWeight: typography.weight.medium },
})
