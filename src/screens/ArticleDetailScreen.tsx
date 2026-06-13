import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet,
  TouchableOpacity, Dimensions, Animated,
} from 'react-native'
import { getStatusBarHeight } from '../util/statusBar'
import { StackScreenProps } from '@react-navigation/stack'
import { Feather } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchArticleDetail, ArticleDetail } from '../api/discovery'
import { BASE_URL } from '../api/client'
import { swrFetch, TTL } from '../util/cache'
import { Skeleton } from '../components/Skeleton'
import { BottomBackButton } from '../components/BottomBackButton'

const { width: W } = Dimensions.get('window')

function isHtml(str: string) {
  return /<[a-z][\s\S]*>/i.test(str)
}

function buildHtml(content: string, baseUrl: string): string {
  const fixed = content
    .replace(/src="\/dev-api\//g, `src="${baseUrl}/`)
    .replace(/src='\/dev-api\//g, `src='${baseUrl}/`)
    .replace(/src="\/profile\//g, `src="${baseUrl}/files/`)
    .replace(/src='\/profile\//g, `src='${baseUrl}/files/`)
    .replace(/src="http[^"]*\/profile\//g, (m) => m.replace('/profile/', '/files/'))
    .replace(/src='http[^']*\/profile\//g, (m) => m.replace('/profile/', '/files/'))
    .replace(/src="https?:\/\/localhost:\d+\//g, `src="${baseUrl}/`)
    .replace(/src='https?:\/\/localhost:\d+\//g, `src='${baseUrl}/`)
    .replace(/src="\/(?!\/|http)/g, `src="${baseUrl}/`)
    .replace(/src='\/(?!\/|http)/g, `src='${baseUrl}/`)

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #F3F5F7; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px; line-height: 1.75; color: #374151;
      padding: 0 2px 24px;
    }
    p { margin-bottom: 14px; }
    h1, h2, h3 { color: #111827; font-weight: 700; margin: 18px 0 10px; }
    h1 { font-size: 20px; } h2 { font-size: 18px; } h3 { font-size: 16px; }
    img { max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 12px 0; }
    video { max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 12px 0; }
    iframe { width: 100%; border-radius: 10px; margin: 12px 0; border: none; }
    ul, ol { padding-left: 20px; margin-bottom: 14px; }
    li { margin-bottom: 6px; }
    a { color: #00C2B4; }
    blockquote { border-left: 3px solid #00C2B4; padding-left: 12px; color: #6B7280; margin: 14px 0; }
    pre, code { background: #F3F4F6; border-radius: 6px; padding: 2px 6px; font-size: 13px; }
    pre { padding: 12px; overflow-x: auto; }
    strong, b { color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #E5E7EB; padding: 8px 10px; font-size: 13px; }
    th { background: #F9FAFB; font-weight: 600; }
  </style>
</head>
<body>
${fixed}
</body>
</html>`
}

// ── Skeleton for article detail ───────────────────────────────────────────────
function ArticleDetailSkeleton() {
  return (
    <View style={{ flex: 1, padding: spacing[4] }}>
      <Skeleton width="88%" height={26} radius={8} style={{ marginBottom: spacing[2] }} />
      <Skeleton width="60%" height={26} radius={8} style={{ marginBottom: spacing[4] }} />
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing[2],
        backgroundColor: colors.surface, borderRadius: radius.lg,
        paddingHorizontal: spacing[4], paddingVertical: spacing[3],
        marginBottom: spacing[4], ...shadow.sm,
      }}>
        <Skeleton width={14} height={14} radius={7} />
        <Skeleton width={80} height={11} radius={5} />
        <View style={{ flex: 1 }} />
        <Skeleton width={28} height={11} radius={5} />
        <Skeleton width={14} height={14} radius={7} />
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], gap: spacing[3], ...shadow.sm }}>
        {[100, 92, 96, 78, 88, 70, 94, 62, 85, 75].map((w, i) => (
          <Skeleton key={i} width={`${w}%`} height={13} radius={6} />
        ))}
      </View>
    </View>
  )
}

export default function ArticleDetailScreen(props: StackScreenProps<RootStackParams, 'ArticleDetail'>) {
  const { articleId } = props.route.params
  const [detail,      setDetail]      = useState<ArticleDetail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    swrFetch(
      `article:${articleId}`,
      TTL.countries,
      () => fetchArticleDetail(articleId),
      fresh => { setDetail(fresh); setLoading(false) }
    )
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [articleId])

  // Fade in content once detail is loaded
  useEffect(() => {
    if (!loading && detail) {
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 220, useNativeDriver: true,
      }).start()
    }
  }, [loading, detail])

  const content     = detail?.content || ''
  const htmlContent = isHtml(content) ? buildHtml(content, BASE_URL) : null
  const paragraphs  = !htmlContent
    ? content.split(/\n+/).map(p => p.trim()).filter(Boolean)
    : []

  function fmtViews(n: number) {
    if (!n) return '0'
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(n)
  }

  return (
    <View style={[s.safe, { paddingTop: getStatusBarHeight() }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          Discover Detail
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Loading skeleton ── */}
      {loading && <ArticleDetailSkeleton />}

      {/* ── Error state ── */}
      {!loading && !detail && (
        <View style={s.centered}>
          <Feather name="alert-circle" size={36} color={colors.muted} />
          <Text style={s.errTxt}>Could not load article</Text>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.errBtn}>
            <Text style={s.errBtnTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content — fades in ── */}
      {!loading && detail && (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

          {/* Title + meta — always visible immediately */}
          <View style={s.titleSection}>
            <Text style={s.title}>{detail.title}</Text>
            <View style={s.metaRow}>
              <Feather name="calendar" size={13} color={colors.subtle} />
              <Text style={s.metaDate}>{detail.createDate || '—'}</Text>
              <View style={s.metaDot} />
              <Feather name="eye" size={13} color={colors.subtle} />
              <Text style={s.metaReads}>{fmtViews(detail.readCount)} views</Text>
            </View>
          </View>

          {/* Body */}
          {htmlContent ? (
            <View style={s.webWrap}>
              <WebView
                source={{ html: htmlContent }}
                style={s.webView}
                scrollEnabled
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                mixedContentMode="always"
                onMessage={() => {}}
              />
            </View>
          ) : (
            <View style={s.plainBody}>
              {paragraphs.map((para, i) => (
                <Text
                  key={i}
                  style={[s.para, /^[•\-–]\s/.test(para) && s.bullet,
                    i < paragraphs.length - 1 && { marginBottom: spacing[3] }]}
                >
                  {para}
                </Text>
              ))}
            </View>
          )}

        </Animated.View>
      )}

      {/* Bottom back button */}
      {!loading && (
        <BottomBackButton onPress={() => props.navigation.goBack()} />
      )}

    </View>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.dark, textAlign: 'center', marginHorizontal: spacing[2],
  },

  // Title section
  titleSection: {
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3],
  },
  title: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold,
    color: colors.dark, lineHeight: 32, marginBottom: spacing[3],
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  metaDate:  { fontSize: typography.size.sm, color: colors.subtle },
  metaDot:   { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border },
  metaReads: { fontSize: typography.size.sm, color: colors.subtle },

  // WebView
  webWrap: {
    flex: 1,
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Plain text body
  plainBody: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    marginHorizontal: spacing[4], marginBottom: spacing[4],
    padding: spacing[5], ...shadow.sm,
  },
  para:   { fontSize: typography.size.base, color: colors.body, lineHeight: 26 },
  bullet: { paddingLeft: spacing[2] },

  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errTxt:   { fontSize: typography.size.base, color: colors.muted },
  errBtn:   { backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  errBtnTxt:{ color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.base },
})
