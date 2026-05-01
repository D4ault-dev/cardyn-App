import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { WebView } from 'react-native-webview'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { fetchArticleDetail, ArticleDetail } from '../api/discovery'
import { fetchCoupon } from '../api/coupon'
import { CouponClaimModal } from '../components/CouponClaimModal'
import { BASE_URL } from '../api/client'

const { width: W } = Dimensions.get('window')

function isHtml(str: string) {
  return /<[a-z][\s\S]*>/i.test(str)
  // Coupon shortcodes disabled: || /\[coupon:/i.test(str)
}

function buildHtml(content: string, baseUrl: string): string {
  let fixed = content
    .replace(/src="\/dev-api\//g, `src="${baseUrl}/`)
    .replace(/src='\/dev-api\//g, `src='${baseUrl}/`)
    .replace(/src="\/profile\//g, `src="${baseUrl}/profile/`)
    .replace(/src='\/profile\//g, `src='${baseUrl}/profile/`)
    .replace(/src="\/(?!\/|http)/g, `src="${baseUrl}/`)
    .replace(/src='\/(?!\/|http)/g, `src='${baseUrl}/`)

  // Replace [coupon:CODE] — disabled for now
  // fixed = fixed.replace(/\[coupon:([A-Za-z0-9_-]+)\]/gi, (_match, code) =>
  //   `<div class="coupon-placeholder" ...></div>`
  // )
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.7; color: #374151; padding: 0 4px; background: #fff; }
    p { margin-bottom: 14px; }
    h1, h2, h3 { color: #111827; font-weight: 700; margin: 18px 0 10px; }
    h1 { font-size: 20px; } h2 { font-size: 18px; } h3 { font-size: 16px; }
    img { max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 12px 0; }
    video { max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 12px 0; }
    iframe { width: 100%; border-radius: 10px; margin: 12px 0; border: none; }
    ul, ol { padding-left: 20px; margin-bottom: 14px; }
    li { margin-bottom: 6px; }
    a { color: #1A7A5E; }
    blockquote { border-left: 3px solid #1A7A5E; padding-left: 12px; color: #6B7280; margin: 14px 0; }
    pre, code { background: #F3F4F6; border-radius: 6px; padding: 2px 6px; font-size: 13px; }
    pre { padding: 12px; overflow-x: auto; }
    strong, b { color: #111827; }

    /* Coupon ticket style */
    .coupon-card {
      display: flex;
      align-items: stretch;
      background: #1A7A5E;
      border-radius: 14px;
      margin: 16px 0;
      overflow: visible;
      position: relative;
      cursor: pointer;
      -webkit-tap-highlight-color: rgba(255,255,255,0.1);
    }
    .coupon-card:active { opacity: 0.9; }
    .coupon-left {
      width: 110px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px 12px;
      border-right: 2px dashed rgba(255,255,255,0.4);
      position: relative;
    }
    .coupon-left::before, .coupon-left::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      background: #fff;
      border-radius: 50%;
      right: -9px;
      z-index: 2;
    }
    .coupon-left::before { top: -9px; }
    .coupon-left::after  { bottom: -9px; }
    .coupon-amount {
      font-size: 28px;
      font-weight: 900;
      color: #fff;
      text-align: center;
      line-height: 1.1;
    }
    .coupon-right {
      flex: 1;
      padding: 16px 16px 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
    }
    .coupon-detail {
      font-size: 14px;
      color: rgba(255,255,255,0.92);
      font-weight: 500;
    }
    .coupon-copy-hint {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin-top: 4px;
    }
    .coupon-toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: #fff;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 999;
    }
  </style>
</head>
<body>
${fixed}
<div class="coupon-toast" id="globalToast">已复制！</div>
<script>
  function showToast(msg) {
    var t = document.getElementById('globalToast');
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(function(){ t.style.opacity = '0'; }, 1800);
  }

  function renderCoupon(el, data) {
    var code = el.getAttribute('data-code');
    var amount = data.discountType === 'percent'
      ? data.discountValue + '%'
      : '\\u20a6' + Number(data.discountValue).toLocaleString();
    var minOrder = data.minOrderAmount > 0
      ? 'Available for \\u20a6' + Number(data.minOrderAmount).toLocaleString() + ' order'
      : 'No minimum order';
    var expiry = data.endDate
      ? 'Valid until ' + data.endDate.replace('T',' ').slice(0,16)
      : 'No expiry';

    el.innerHTML =
      '<div class="coupon-card" onclick="copyCode(\\'' + code + '\\')">' +
        '<div class="coupon-left">' +
          '<div class="coupon-amount">' + amount + '</div>' +
        '</div>' +
        '<div class="coupon-right">' +
          '<div class="coupon-detail">' + minOrder + '</div>' +
          '<div class="coupon-detail">' + expiry + '</div>' +
          '<div class="coupon-copy-hint">Tap to copy code: ' + code + '</div>' +
        '</div>' +
      '</div>';
  }

  function copyCode(code) {
    // Post message to React Native to open claim modal
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'coupon', code: code }));
  }

  // Fetch and render all coupon placeholders
  var placeholders = document.querySelectorAll('.coupon-placeholder');
  placeholders.forEach(function(el) {
    var code = el.getAttribute('data-code');
    fetch('${baseUrl}/tuka/coupon/public/' + code)
      .then(function(r){ return r.json(); })
      .then(function(res){
        if (res.code === 200 && res.data) {
          renderCoupon(el, res.data);
        } else {
          el.innerHTML = '<div style="background:#fee2e2;border-radius:12px;padding:12px;color:#ef4444;font-size:13px;">Coupon ' + code + ' not found</div>';
        }
      })
      .catch(function(){
        el.innerHTML = '<div style="background:#fee2e2;border-radius:12px;padding:12px;color:#ef4444;font-size:13px;">Could not load coupon</div>';
      });
  });
<\/script>
</body>
</html>`
}

export default function ArticleDetailScreen(props: StackScreenProps<RootStackParams, 'ArticleDetail'>) {
  const { articleId } = props.route.params
  const [detail,  setDetail]  = useState<ArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimVisible, setClaimVisible] = useState(false)
  const [claimCode, setClaimCode] = useState<string | null>(null)

  useEffect(() => {
    fetchArticleDetail(articleId)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [articleId])

  const content     = detail?.content || ''
  const htmlContent = isHtml(content) ? buildHtml(content, BASE_URL) : null
  const paragraphs  = !htmlContent
    ? content.split(/\n+/).map(p => p.trim()).filter(Boolean)
    : []

  return (
    <>
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Discover Detail</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <Spinner size="large" />
        </View>
      ) : !detail ? (
        <View style={s.centered}>
          <Feather name="alert-circle" size={36} color={colors.muted} />
          <Text style={s.errTxt}>Could not load article</Text>
          <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.errBtn}>
            <Text style={s.errBtnTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={s.content}>
            <Text style={s.title}>{detail.title}</Text>
            <View style={s.metaCard}>
              <Feather name="file-text" size={14} color={colors.subtle} />
              <Text style={s.metaDate}>{detail.createDate || '—'}</Text>
              <View style={{ flex: 1 }} />
              <Text style={s.metaReads}>{detail.readCount}</Text>
              <Feather name="eye" size={14} color={colors.subtle} />
            </View>
          </View>

          {htmlContent ? (
            <View style={[s.bodyWrap, { flex: 1, marginHorizontal: spacing[4], marginBottom: spacing[4] }]}>
              <WebView
                source={{ html: htmlContent }}
                style={{ flex: 1, backgroundColor: colors.surface }}
                scrollEnabled
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                mixedContentMode="always"
                onMessage={async _e => {
                  // Coupon claim disabled for now
                }}
              />
            </View>
          ) : (
            <View style={[s.bodyWrap, { marginHorizontal: spacing[4], marginBottom: spacing[4] }]}>
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
        </View>
      )}
    </SafeAreaView>
    {/* CouponClaimModal disabled
    <CouponClaimModal
      visible={claimVisible}
      code={claimCode}
      onClose={() => setClaimVisible(false)}
      onClaimed={(_coupon, _amount) => { setClaimVisible(false) }}
    />
    */}
    </>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.background },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  backBtn:     { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.dark },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  errTxt:      { fontSize: typography.size.base, color: colors.muted },
  errBtn:      { backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  errBtnTxt:   { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.base },
  content:     { paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[3] },
  title:       { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.dark, lineHeight: 32, marginBottom: spacing[4] },
  metaCard:    {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2,
    marginBottom: spacing[2], ...shadow.sm,
  },
  metaDate:    { fontSize: typography.size.sm, color: colors.subtle },
  metaReads:   { fontSize: typography.size.sm, color: colors.subtle, marginRight: 3 },
  bodyWrap:    { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], ...shadow.sm },
  para:        { fontSize: typography.size.base, color: colors.body, lineHeight: 26 },
  bullet:      { paddingLeft: spacing[2] },
})
