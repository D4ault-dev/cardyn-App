import { RF } from '../util/responsive'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Alert, Animated, Dimensions, StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StackScreenProps } from '@react-navigation/stack'
import { AppHeader } from '../components/AppHeader'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import {
  ChatMessage, ChatSession, ChatPoller, PollResult,
  getOrCreateSession, getMessages, sendMessage, sendImageMessage,
  submitReview, getReview,
} from '../api/chat'

type Props = StackScreenProps<RootStackParams, 'Chat'>

const { width: W } = Dimensions.get('window')

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(t: string | undefined) {
  if (!t) return ''
  const today = new Date().toISOString().slice(0, 10)
  return t.slice(0, 10) === today ? t.slice(11, 16) : t.slice(5, 16)
}
function shouldShowTime(msgs: ChatMessage[], idx: number) {
  if (idx === 0) return true
  const prev = msgs[idx - 1], curr = msgs[idx]
  if (prev.senderType !== curr.senderType) return true
  const gap = new Date(curr.createTime?.replace(' ', 'T') || 0).getTime()
            - new Date(prev.createTime?.replace(' ', 'T') || 0).getTime()
  return gap > 5 * 60 * 1000
}
function shouldShowDate(msgs: ChatMessage[], idx: number) {
  if (idx === 0) return true
  return msgs[idx].createTime?.slice(0, 10) !== msgs[idx - 1].createTime?.slice(0, 10)
}

// ── Typing indicator (3 bouncing dots) ───────────────────────────────────────
function TypingBubble() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -7, duration: 280, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 280, useNativeDriver: true }),
        Animated.delay(500),
      ]))
    )
    anims.forEach(a => a.start())
    return () => anims.forEach(a => a.stop())
  }, [])
  return (
    <View style={ty.row}>
      <View style={ty.avatar}><Feather name="headphones" size={12} color={colors.primary} /></View>
      <View style={ty.bubble}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[ty.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </View>
  )
}
const ty = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing[2] },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 13, ...shadow.sm },
  dot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.muted },
})

// ── Animated text (types in character by character) ───────────────────────────
function AnimatedText({ text, style, onDone }: { text: string; style: any; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) { clearInterval(interval); onDone?.() }
    }, 18)
    return () => clearInterval(interval)
  }, [text])
  return <Text style={style}>{displayed}</Text>
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, myUserId, onQuickReply, quickRepliesUsed, onImagePress, showTime, showAvatar, isNew }: {
  msg: ChatMessage; myUserId: number
  onQuickReply: (t: string) => void; quickRepliesUsed: boolean
  onImagePress: (uri: string) => void; showTime: boolean; showAvatar: boolean
  isNew?: boolean
}) {
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(12)).current
  const isMe     = msg.senderType === 'user' && msg.senderId === myUserId
  const isSystem = msg.senderType === 'system'
  // AI Agent messages render as agent bubbles (not system pills)
  const isAI     = msg.senderName === 'AI Agent'
  const isAgent  = msg.senderType === 'agent' || isAI

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])

  if (isSystem && msg.msgType === 'quickreply') {
    if (quickRepliesUsed) return null
    return (
      <Animated.View style={[b.chipsWrap, { opacity: fadeAnim }]}>
        {msg.content.split('|').map(o => (
          <TouchableOpacity key={o} style={b.chip} onPress={() => onQuickReply(o)} activeOpacity={0.75}>
            <Text style={b.chipTxt}>{o}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    )
  }

  // Pure system messages (not AI) — show as centered pill
  if (isSystem && !isAI) {
    return (
      <Animated.View style={[b.systemWrap, { opacity: fadeAnim }]}>
        <View style={b.systemLine} />
        <Text style={b.systemTxt}>{msg.content}</Text>
        <View style={b.systemLine} />
      </Animated.View>
    )
  }

  // Agent avatar — use staff photo if available, else icon
  const avatarUri = msg.senderAvatar ? resolveImageUrl(msg.senderAvatar) : null

  return (
    <Animated.View style={[
      b.row, isMe && b.rowMe,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      {!isMe && (
        <View style={[b.avatar, !showAvatar && b.avatarHidden]}>
          {showAvatar && (
            avatarUri
              ? <Image source={{ uri: avatarUri }} style={b.avatarImg} />
              : isAI
                ? <View style={b.avatarGrad}><Text style={{ fontSize: RF(14) }}>🤖</Text></View>
                : <LinearGradient colors={['#1A7A5E', '#0D5C45']} style={b.avatarGrad}>
                    <Feather name="headphones" size={12} color="#fff" />
                  </LinearGradient>
          )}
        </View>
      )}

      <View style={[b.group, isMe && b.groupMe]}>
        {!isMe && showAvatar && (
          <Text style={b.senderName}>{isAI ? 'AI Agent' : (msg.senderName || 'Support')}</Text>
        )}
        <View style={[b.bubble, isMe ? b.bubbleMe : b.bubbleAgent, !isMe && !showAvatar && b.bubbleCont]}>
          {msg.msgType === 'image'
            ? <TouchableOpacity onPress={() => onImagePress(msg.content)} activeOpacity={0.9}>
                <Image source={{ uri: resolveImageUrl(msg.content) || msg.content }} style={b.image} resizeMode="cover" />
              </TouchableOpacity>
            : isNew && !isMe
              ? <AnimatedText text={msg.content} style={[b.text, b.textAgent]} />
              : <Text style={[b.text, isMe ? b.textMe : b.textAgent]}>{msg.content}</Text>
          }
        </View>
        {showTime && <Text style={[b.time, isMe && b.timeMe]}>{formatTime(msg.createTime)}</Text>}
      </View>
    </Animated.View>
  )
}

const b = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing[4], marginBottom: 3 },
  rowMe:       { flexDirection: 'row-reverse' },
  avatar:      { width: 28, height: 28, borderRadius: 14, marginRight: spacing[2], flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  avatarHidden:{ opacity: 0 },
  avatarGrad:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarImg:   { width: 28, height: 28, borderRadius: 14 },
  group:       { maxWidth: '76%', gap: 2 },
  groupMe:     { alignItems: 'flex-end' },
  senderName:  { fontSize: RF(11), color: colors.muted, fontWeight: typography.weight.semibold, marginBottom: 2, marginLeft: 2 },
  bubble:      { borderRadius: 20, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleAgent: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, ...shadow.sm },
  bubbleMe:    { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  bubbleCont:  { borderTopLeftRadius: 6 },
  text:        { fontSize: RF(15), lineHeight: 22 },
  textAgent:   { color: colors.dark },
  textMe:      { color: '#fff' },
  time:        { fontSize: RF(10), color: colors.subtle, marginTop: 2, marginLeft: 2 },
  timeMe:      { textAlign: 'right', marginRight: 2 },
  image:       { width: 200, height: 200, borderRadius: 14 },
  systemWrap:  { flexDirection: 'row', alignItems: 'center', marginVertical: spacing[4], paddingHorizontal: spacing[6] },
  systemLine:  { flex: 1, height: 1, backgroundColor: colors.border },
  systemTxt:   { fontSize: RF(11), color: colors.muted, marginHorizontal: spacing[3], textAlign: 'center' },
  chipsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[3], justifyContent: 'flex-end' },
  chip:        { borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.surface },
  chipTxt:     { fontSize: RF(13), color: colors.primary, fontWeight: typography.weight.semibold },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatScreen(props: Props) {
  const { user }  = useAuth()
  const insets    = useSafeAreaInsets()
  const myUserId  = user.isPresent() ? parseInt(user.getOrThrow().uid) : 0
  const orderId   = props.route?.params?.orderId
  const orderNo   = props.route?.params?.orderNo

  const [session,          setSession]          = useState<ChatSession | null>(null)
  const [messages,         setMessages]         = useState<ChatMessage[]>([])
  const [newMsgIds,        setNewMsgIds]        = useState<Set<number>>(new Set())
  const [input,            setInput]            = useState('')
  const [loading,          setLoading]          = useState(true)
  const [sending,          setSending]          = useState(false)
  const [agentTyping,      setAgentTyping]      = useState(false)
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(false)
  const [lightboxUri,      setLightboxUri]      = useState<string | null>(null)
  const [inputFocused,     setInputFocused]     = useState(false)
  // Review state
  const [showReview,       setShowReview]       = useState(false)
  const [reviewRating,     setReviewRating]     = useState(5)
  const [reviewComment,    setReviewComment]    = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDone,       setReviewDone]       = useState(false)

  const listRef   = useRef<FlatList>(null)
  const pollerRef = useRef<ChatPoller | null>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  useEffect(() => {
    initChat()
    return () => pollerRef.current?.stop()
  }, [])

  async function initChat() {
    setLoading(true)
    try {
      const sess = await getOrCreateSession({ orderId, orderNo })
      setSession(sess)
      const msgs = await getMessages(sess.sessionId)
      setMessages(msgs)
      setQuickRepliesUsed(msgs.some(m => m.senderType === 'user'))
      scrollToBottom()
      const lastId = msgs.length ? msgs[msgs.length - 1].id : 0
      const poller = new ChatPoller(sess.sessionId, lastId, (result: PollResult) => {
        if (result.messages.length > 0) {
          const incoming = result.messages
          // Show typing indicator for agent messages before displaying them
          const hasAgent = incoming.some(m => m.senderType === 'agent')
          if (hasAgent) {
            setAgentTyping(true)
            setTimeout(() => {
              setAgentTyping(false)
              setMessages(prev => {
                const ids = new Set(prev.map(m => m.id))
                const fresh = incoming.filter(m => !ids.has(m.id))
                if (!fresh.length) return prev
                // Mark agent messages as "new" for animation
                setNewMsgIds(prev2 => {
                  const next = new Set(prev2)
                  fresh.filter(m => m.senderType === 'agent').forEach(m => next.add(m.id))
                  return next
                })
                scrollToBottom()
                return [...prev, ...fresh]
              })
            }, 1200 + Math.random() * 600)
          } else {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id))
              const fresh = incoming.filter(m => !ids.has(m.id))
              if (!fresh.length) return prev
              scrollToBottom()
              return [...prev, ...fresh]
            })
          }
        }
        setSession(prev => {
          if (!prev) return prev
          if (prev.status !== result.status || prev.agentId !== result.agentId || prev.agentName !== result.agentName) {
            // Show review modal when session closes (only if it was claimed by an agent)
            if (result.status === 'closed' && prev.status === 'claimed' && !reviewDone) {
              setTimeout(() => setShowReview(true), 800)
            }
            return { ...prev, status: result.status, agentId: result.agentId, agentName: result.agentName }
          }
          return prev
        })
      })
      poller.start()
      pollerRef.current = poller
    } catch {}
    finally { setLoading(false) }
  }

  async function handleSend(text = input.trim()) {
    if (!text || !session || sending) return
    setInput(''); setSending(true)
    const optimistic: ChatMessage = {
      id: Date.now(), sessionId: session.sessionId,
      senderId: myUserId, senderType: 'user', senderName: 'You',
      content: text, msgType: 'text',
      createTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()
    try {
      const sent = await sendMessage(session.sessionId, text)
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m))
      pollerRef.current?.updateLastId(sent.id)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(text)
    } finally { setSending(false) }
  }

  function handleQuickReply(text: string) {
    if (quickRepliesUsed) return
    setQuickRepliesUsed(true)
    handleSend(text)
  }

  async function handleSubmitReview() {
    if (!session) return
    setReviewSubmitting(true)
    try {
      await submitReview(session.sessionId, reviewRating, reviewComment, myUserId)
      setReviewDone(true)
      setTimeout(() => setShowReview(false), 1500)
    } catch {}
    finally { setReviewSubmitting(false) }
  }

  async function handlePickImage() {
    if (!session) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setSending(true)
    const optimistic: ChatMessage = {
      id: Date.now(), sessionId: session.sessionId,
      senderId: myUserId, senderType: 'user', senderName: 'You',
      content: asset.uri, msgType: 'image',
      createTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }
    setMessages(prev => [...prev, optimistic])
    scrollToBottom()
    try {
      const sent = await sendImageMessage(session.sessionId, asset.uri, asset.fileName || 'image.jpg')
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m))
      pollerRef.current?.updateLastId(sent.id)
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      Alert.alert('Failed', e.message)
    } finally { setSending(false) }
  }

  const isOnline   = session?.status === 'claimed'
  const statusDot  = isOnline ? '#22c55e' : session?.status === 'closed' ? '#ef4444' : '#f59e0b'
  const statusText = isOnline
    ? `${session?.agentName || 'Agent'} · Online`
    : session?.status === 'closed' ? 'Conversation closed' : 'Connecting...'

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Gradient header ── */}
      <LinearGradient colors={['#1A7A5E', '#0D5C45']} style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => props.navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <View style={s.avatarWrap}>
            <View style={s.headerAvatar}>
              <Feather name="headphones" size={18} color={colors.primary} />
            </View>
            <View style={[s.onlineDot, { backgroundColor: statusDot }]} />
          </View>
          <View>
            <Text style={s.headerTitle}>Customer Support</Text>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: statusDot }]} />
              <Text style={s.statusTxt}>{statusText}</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Order banner */}
      {orderNo && (
        <View style={s.orderBanner}>
          <Feather name="package" size={13} color={colors.primary} />
          <Text style={s.orderBannerTxt}>Order: <Text style={{ fontWeight: '700' }}>{orderNo}</Text></Text>
        </View>
      )}

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>

        {loading ? (
          <View style={s.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => String(m.id)}
            style={s.list}
            contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[2] }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            renderItem={({ item, index }) => {
              const showDateSep = shouldShowDate(messages, index)
              const showTime    = shouldShowTime(messages, index) || index === messages.length - 1
              const isMe        = item.senderType === 'user' && item.senderId === myUserId
              const nextMsg     = messages[index + 1]
              const showAvatar  = !isMe && (!nextMsg || nextMsg.senderType !== item.senderType || shouldShowTime(messages, index + 1))
              return (
                <View>
                  {showDateSep && item.createTime && (
                    <View style={s.dateSep}>
                      <Text style={s.dateSepTxt}>{item.createTime.slice(0, 10)}</Text>
                    </View>
                  )}
                  <Bubble
                    msg={item} myUserId={myUserId}
                    onQuickReply={handleQuickReply}
                    quickRepliesUsed={quickRepliesUsed}
                    onImagePress={uri => setLightboxUri(resolveImageUrl(uri))}
                    showTime={showTime} showAvatar={showAvatar}
                    isNew={newMsgIds.has(item.id)}
                  />
                </View>
              )
            }}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Feather name="message-circle" size={36} color={colors.primary} />
                </View>
                <Text style={s.emptyTitle}>How can we help?</Text>
                <Text style={s.emptyTxt}>Our support team is ready for you</Text>
              </View>
            }
            ListFooterComponent={agentTyping ? <TypingBubble /> : null}
          />
        )}

        {/* ── Input bar ── */}
        {session?.status !== 'closed' ? (
          <View style={[s.inputBar, inputFocused && s.inputBarFocused]}>
            <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} activeOpacity={0.7}>
              <Feather name="image" size={20} color={inputFocused ? colors.primary : colors.muted} />
            </TouchableOpacity>
            <TextInput
              style={s.input}
              placeholder="Message..."
              placeholderTextColor={colors.subtle}
              value={input}
              onChangeText={setInput}
              multiline maxLength={500}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <TouchableOpacity
              style={[s.sendBtn, input.trim() && s.sendBtnActive]}
              onPress={() => handleSend()}
              disabled={!input.trim() || sending}
              activeOpacity={0.85}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="send" size={17} color={input.trim() ? '#fff' : colors.muted} />
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.closedBar, { paddingBottom: insets.bottom + spacing[3] }]}>
            <Feather name="lock" size={14} color={colors.muted} />
            <Text style={s.closedTxt}>This conversation has been closed</Text>
          </View>
        )}
        {session?.status !== 'closed' && <View style={{ height: insets.bottom }} />}
      </KeyboardAvoidingView>

      {/* ── Review Modal ── */}
      {showReview && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={rv.overlay} activeOpacity={1} onPress={() => !reviewSubmitting && setShowReview(false)} />
          <View style={rv.sheet}>
            <View style={rv.handle} />
            {reviewDone ? (
              <View style={rv.doneWrap}>
                <Text style={rv.doneIcon}>🎉</Text>
                <Text style={rv.doneTitle}>Thank you!</Text>
                <Text style={rv.doneSub}>Your feedback helps us improve</Text>
              </View>
            ) : (
              <>
                <Text style={rv.title}>Rate your experience</Text>
                <Text style={rv.sub}>How was your support session?</Text>
                {/* Agent info */}
                {session?.agentName && (
                  <View style={rv.agentRow}>
                    <View style={rv.agentAvatar}>
                      <Feather name="headphones" size={16} color={colors.primary} />
                    </View>
                    <Text style={rv.agentName}>with {session.agentName}</Text>
                  </View>
                )}
                {/* Stars */}
                <View style={rv.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setReviewRating(star)} activeOpacity={0.7}>
                      <Text style={[rv.star, star <= reviewRating && rv.starActive]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={rv.ratingLabel}>
                  {reviewRating === 5 ? 'Excellent!' : reviewRating === 4 ? 'Good' : reviewRating === 3 ? 'Average' : reviewRating === 2 ? 'Poor' : 'Very Poor'}
                </Text>
                {/* Comment */}
                <TextInput
                  style={rv.commentInput}
                  placeholder="Leave a comment (optional)..."
                  placeholderTextColor={colors.subtle}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  maxLength={200}
                />
                {/* Buttons */}
                <TouchableOpacity style={rv.submitBtn} onPress={handleSubmitReview} disabled={reviewSubmitting} activeOpacity={0.85}>
                  {reviewSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={rv.submitTxt}>Submit Review</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={rv.skipBtn} onPress={() => setShowReview(false)}>
                  <Text style={rv.skipTxt}>Skip</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Lightbox */}
      {lightboxUri && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={s.lightboxBg} activeOpacity={1} onPress={() => setLightboxUri(null)}>
            <Image source={{ uri: lightboxUri }} style={s.lightboxImg} resizeMode="contain" />
            <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUri(null)}>
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F0F2F5' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatarWrap:  { position: 'relative' },
  headerAvatar:{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  onlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 5.5, borderWidth: 2, borderColor: '#0D5C45' },
  headerTitle: { fontSize: RF(16), fontWeight: '700', color: '#fff' },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: RF(12), color: 'rgba(255,255,255,0.8)' },

  // Order banner
  orderBanner:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.primaryLight, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  orderBannerTxt: { fontSize: RF(12), color: colors.primary },

  // Messages
  list:    { flex: 1 },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateSep: { alignItems: 'center', marginVertical: spacing[3] },
  dateSepTxt: { fontSize: RF(11), color: colors.muted, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  emptyWrap:  { paddingTop: 80, alignItems: 'center', gap: spacing[3] },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: RF(18), fontWeight: '700', color: colors.dark },
  emptyTxt:   { fontSize: RF(14), color: colors.muted },

  // Input
  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2], backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  inputBarFocused: { borderTopColor: colors.primary + '40' },
  attachBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F5' },
  input:           { flex: 1, backgroundColor: 'transparent', borderRadius: 22, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: RF(15), color: colors.dark, maxHeight: 120 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },
  sendBtnActive:   { backgroundColor: colors.accent },
  closedBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[4], backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  closedTxt:       { fontSize: RF(13), color: colors.muted },

  // Lightbox
  lightboxBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg:   { width: W, height: '75%' as any },
  lightboxClose: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
})

const rv = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[6], paddingBottom: spacing[10],
    alignItems: 'center',
  },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing[5] },
  title:        { fontSize: RF(22), fontWeight: typography.weight.extrabold, color: colors.dark, marginBottom: spacing[2] },
  sub:          { fontSize: RF(14), color: colors.muted, marginBottom: spacing[4] },
  agentRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4], backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  agentAvatar:  { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  agentName:    { fontSize: RF(13), color: colors.primary, fontWeight: typography.weight.semibold },
  starsRow:     { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[2] },
  star:         { fontSize: RF(44), color: colors.border },
  starActive:   { color: '#FBBF24' },
  ratingLabel:  { fontSize: RF(15), fontWeight: typography.weight.bold, color: colors.dark, marginBottom: spacing[4] },
  commentInput: {
    width: '100%', backgroundColor: colors.background,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: RF(14), color: colors.dark, minHeight: 80,
    textAlignVertical: 'top', marginBottom: spacing[4],
  },
  submitBtn:    { width: '100%', backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: spacing[4], alignItems: 'center', marginBottom: spacing[3] },
  submitTxt:    { fontSize: RF(16), fontWeight: typography.weight.bold, color: '#fff' },
  skipBtn:      { paddingVertical: spacing[2] },
  skipTxt:      { fontSize: RF(14), color: colors.muted },
  doneWrap:     { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[3] },
  doneIcon:     { fontSize: RF(56) },
  doneTitle:    { fontSize: RF(22), fontWeight: typography.weight.extrabold, color: colors.dark },
  doneSub:      { fontSize: RF(14), color: colors.muted },
})
