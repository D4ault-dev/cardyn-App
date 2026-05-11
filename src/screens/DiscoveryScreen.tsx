import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchArticles, Article } from '../api/discovery'
import { useDrawerSwipe } from '../hooks/useDrawerSwipe'
import { Spinner, AppRefreshControl } from '../components/Spinner'

// ── Article list card ─────────────────────────────────────────────────────────
function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  return (
    <TouchableOpacity style={ac.card} onPress={onPress} activeOpacity={0.82}>
      <View style={ac.thumbWrap}>
        {article.image ? (
          <Image source={{ uri: article.image }} style={ac.thumb} resizeMode="cover" />
        ) : (
          <View style={ac.thumbPlaceholder}>
            <Feather name="file-text" size={26} color={colors.muted} />
          </View>
        )}
      </View>
      <View style={ac.body}>
        <Text style={ac.title} numberOfLines={3}>{article.title}</Text>
        <View style={ac.meta}>
          <Feather name="file-text" size={13} color={colors.subtle} />
          <Text style={ac.metaDate}>{article.createDate || '—'}</Text>
          <View style={{ flex: 1 }} />
          <Text style={ac.metaReads}>{article.readCount}</Text>
          <Feather name="eye" size={13} color={colors.subtle} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const ac = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: colors.surface,
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    borderRadius: radius.xl, padding: spacing[3], gap: spacing[3], ...shadow.sm,
  },
  thumbWrap:       { borderRadius: radius.lg, overflow: 'hidden' },
  thumb:           { width: 90, height: 90 },
  thumbPlaceholder:{
    width: 90, height: 90, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg,
  },
  body:     { flex: 1, justifyContent: 'space-between', paddingVertical: spacing[1] },
  title:    { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.dark, lineHeight: 21 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2, marginTop: spacing[2] },
  metaDate: { fontSize: typography.size.sm, color: colors.subtle },
  metaReads:{ fontSize: typography.size.sm, color: colors.subtle, marginRight: 3 },
})

// ── Main list screen ──────────────────────────────────────────────────────────
export default function DiscoveryScreen(props: StackScreenProps<RootStackParams, 'Tabs'>) {
  const [articles,   setArticles]   = useState<Article[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try { setArticles(await fetchArticles()) }
    catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const onRefresh = useCallback(() => { setRefreshing(true); load(true) }, [load])

  const swipeHandlers = useDrawerSwipe()

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
    <View style={[s.safe, Platform.OS === 'android' && { paddingTop: getStatusBarHeight() }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Discover</Text>
      </View>

      {loading ? (
        <View style={s.centered}><Spinner size="large" /></View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={a => String(a.id)}
          renderItem={({ item }) => (
            <ArticleCard
              article={item}
              onPress={() => (props.navigation as any).navigate('ArticleDetail', { articleId: item.id })}
            />
          )}
          ListHeaderComponent={<View style={{ height: spacing[3] }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="compass" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptySub}>Posts and news will appear here</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
    </View>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.background },
  header:      { paddingHorizontal: spacing[5], paddingVertical: spacing[4], alignItems: 'center' },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.dark },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[8], paddingTop: spacing[12] },
  emptyTitle:  { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.muted },
  emptySub:    { fontSize: typography.size.base, color: colors.subtle, textAlign: 'center', lineHeight: 22 },
})
