import { RF } from '../util/responsive'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback,
  FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Alert, Animated, Dimensions, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../context/AuthContext'
import { colors, typography, spacing, radius, shadow } from '../theme'
import { resolveImageUrl } from '../api/cards'
import {
  ChatMessage, ChatSession, ChatPoller, PollResult,
  getOrCreateSession, getMessages, sendMessage, sendImageMessage,
} from '../api/chat'

const { width: W, height: SCREEN_H } = Dimensions.get('window')
const SHEET_H = SCREEN_H

type Props = {
  visible: boolean
  onClose: () => void
  orderId?: number
  orderNo?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(t: string | undefined) {
  if (!t) return ''
  const today = new Date().toISOString().slice(0, 10)
  return t.slice(0, 10) === today ? t.slice(11, 16) : t.slice(5, 16)
}

function shouldShowTime(msgs: ChatMessage[], idx: number) {
  if (idx === 0) return true
  const prev = msgs[idx - 1]
  const curr = msgs[idx]
  // Show time if > 5 min gap or different sender
  if (prev.senderType !== curr.senderType) return true
  const prevMs = new Date(prev.createTime?.replace(' ', 'T') || 0).getTime()
  const currMs = new Date(curr.createTime?.replace(' ', 'T') || 0).getTime()
  return (currMs - prevMs) > 5 * 60 * 1000
}

function shouldShowDateSep(msgs: ChatMessage[], idx: number) {
  if (idx === 0) return true
  return msgs[idx].createTime?.slice(0, 10) !== msgs[idx - 1].createTime?.slice(0, 10)
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ]))
    const a1 = anim(dot1, 0); const a2 = anim(dot2, 150); const a3 = anim(dot3, 300)
    a1.start(); a2.start(); a3.start()
    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [])
  return (
    <View style={ty.wrap}>
      <View style={ty.avatar}><Feather name="headphones" size={12} color={colors.primary} /></View>
      <View style={ty.bubble}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[ty.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </View>
  )
}
const ty = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing[2] },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, ...shadow.sm },
  dot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.muted },
})

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, myUserId, onQuickReply, quickRepliesUsed, onImagePress, showTime, showAvatar }: {
  msg: ChatMessage; myUserId: number
  onQuickReply: (t: string) => void; quickRepliesUsed: boolean
  onImagePress: (uri: string) => void; showTime: boolean; showAvatar: boolean
}) {
  const isMe     = msg.senderType === 'user' && msg.senderId === myUserId
  const isSystem = msg.senderType === 'system'
  const isAI     = msg.senderType === 'agent' && msg.senderName === 'AI Agent'

  if (isSystem && msg.msgType === 'quickreply') {
    if (quickRepliesUsed) return null
    return (
      <View style={b.chipsWrap}>
        {msg.content.split('|').map(o => (
          <TouchableOpacity key={o} style={b.chip} onPress={() => onQuickReply(o)} activeOpacity={0.75}>
            <Text style={b.chipTxt}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  if (isSystem) {
    return (
      <View style={b.systemWrap}>
        <View style={b.systemLine} />
        <Text style={b.systemTxt}>{msg.content}</Text>
        <View style={b.systemLine} />
      </View>
    )
  }

  return (
    <View style={[b.row, isMe && b.rowMe]}>
      {/* Avatar — only show for first message in a group */}
      {!isMe && (
        <View style={[b.avatar, !showAvatar && b.avatarHidden]}>
          {showAvatar && (
            isAI
              ? <Text style={{ fontSize: RF(14) }}>🤖</Text>
              : <LinearGradient colors={['#1A7A5E', '#0D5C45']} style={b.avatarGrad}>
                  <Feather name="headphones" size={13} color="#fff" />
                </LinearGradient>
          )}
        </View>
      )}

      <View style={[b.msgGroup, isMe && b.msgGroupMe]}>
        {/* Sender name — only for first in group */}
        {!isMe && showAvatar && (
          <Text style={b.name}>{isAI ? 'AI Agent' : (msg.senderName || 'Support')}</Text>
        )}

        <View style={[b.bubble, isMe ? b.bubbleMe : b.bubbleAgent,
          !isMe && !showAvatar && b.bubbleContinued]}>
          {msg.msgType === 'image'
            ? <TouchableOpacity onPress={() => onImagePress(msg.content)} activeOpacity={0.9}>
                <Image source={{ uri: resolveImageUrl(msg.content) || msg.content }}
                  style={b.image} resizeMode="cover" />
              </TouchableOpacity>
            : <Text style={[b.text, isMe && b.textMe]}>{msg.content}</Text>
          }
        </View>

        {/* Time — only show when needed */}
        {showTime && (
          <Text style={[b.time, isMe && b.timeMe]}>{formatTime(msg.createTime)}</Text>
        )}
      </View>
    </View>
  )
}

const b = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing[4], marginBottom: 2 },
  rowMe:         { flexDirection: 'row-reverse' },
  avatar:        { width: 28, height: 28, borderRadius: 14, marginRight: spacing[2], flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  avatarHidden:  { opacity: 0 },
  avatarGrad:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgGroup:      { maxWidth: '75%', gap: 2 },
  msgGroupMe:    { alignItems: 'flex-end' },
  name:          { fontSize: RF(11), color: colors.muted, fontWeight: typography.weight.semibold, marginBottom: 2, marginLeft: 2 },
  bubble:        { borderRadius: 18, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  bubbleAgent:   { backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow.sm },
  bubbleMe:      { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleContinued: { borderTopLeftRadius: 6 },
  text:          { fontSize: RF(15), color: colors.dark, lineHeight: 22 },
  textMe:        { color: '#fff' },
  time:          { fontSize: RF(10), color: colors.subtle, marginTop: 2, marginLeft: 2 },
  timeMe:        { textAlign: 'right', marginRight: 2 },
  image:         { width: 200, height: 200, borderRadius: 14 },
  systemWrap:    { flexDirection: 'row', alignItems: 'center', marginVertical: spacing[4], paddingHorizontal: spacing[6] },
  systemLine:    { flex: 1, height: 1, backgroundColor: colors.border },
  systemTxt:     { fontSize: RF(11), color: colors.muted, marginHorizontal: spacing[3], textAlign: 'center' },
  chipsWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[3], justifyContent: 'flex-end' },
  chip:          { borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.surface },
  chipTxt:       { fontSize: RF(13), color: colors.primary, fontWeight: typography.weight.semibold },
})

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ChatModal({ visible, onClose, orderId, orderNo }: Props) {
  const { user }   = useAuth()
  const insets     = useSafeAreaInsets()
  const myUserId   = user.isPresent() ? parseInt(user.getOrThrow().uid) : 0

  const [session,          setSession]          = useState<ChatSession | null>(null)
  const [messages,         setMessages]         = useState<ChatMessage[]>([])
  const [input,            setInput]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [sending,          setSending]          = useState(false)
  const [agentTyping,      setAgentTyping]      = useState(false)
  const [quickRepliesUsed, setQuickRepliesUsed] = useState(false)
  const [lightboxUri,      setLightboxUri]      = useState<string | null>(null)
  const [inputFocused,     setInputFocused]     = useState(false)

  const listRef      = useRef<FlatList>(null)
  const pollerRef    = useRef<ChatPoller | null>(null)
  const slideAnim    = useRef(new Animated.Value(SCREEN_H)).current
  const headerAnim   = useRef(new Animated.Value(0)).current

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [])

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start()
      initChat()
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 280, useNativeDriver: true }).start()
      pollerRef.current?.stop()
    }
  }, [visible])

  async function initChat() {
    pollerRef.current?.stop()
    setLoading(true); setMessages([]); setSession(null)
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
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id))
            const fresh = result.messages.filter(m => !ids.has(m.id))
            if (!fresh.length) return prev
            scrollToBottom()
            return [...prev, ...fresh]
          })
        }
        setSession(prev => {
          if (!prev) return prev
          if (prev.status !== result.status || prev.agentId !== result.agentId || prev.agentName !== result.agentName) {
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
      pollerRef.current?.kickPoll()
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

  async function handlePickImage() {
    if (!session) return
    // No READ_MEDIA_IMAGES permission needed — expo-image-picker uses system photo picker on Android 13+
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
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
      pollerRef.current?.kickPoll()
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      Alert.alert('Failed', e.message)
    } finally { setSending(false) }
  }

  const isOnline   = session?.status === 'claimed'
  const agentName  = session?.agentName || 'Support'
  const statusDot  = isOnline ? '#22c55e' : session?.status === 'closed' ? '#ef4444' : '#f59e0b'
  const statusText = isOnline ? `${agentName} · Online` : session?.status === 'closed' ? 'Conversation closed' : 'Connecting...'

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* ── Header with gradient ── */}
        <LinearGradient colors={['#1A7A5E', '#0D5C45']} style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={s.backBtn} activeOpacity={0.7}>
            <Feather name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={s.headerInfo}>
            {/* Agent avatar with online ring */}
            <View style={s.headerAvatarWrap}>
              <View style={s.headerAvatar}>
                <Feather name="headphones" size={20} color={colors.primary} />
              </View>
              <View style={[s.onlineRing, { backgroundColor: statusDot }]} />
            </View>
            <View>
              <Text style={s.headerTitle}>Customer Support</Text>
              <View style={s.headerStatusRow}>
                <View style={[s.statusDot, { backgroundColor: statusDot }]} />
                <Text style={s.headerStatus}>{statusText}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={s.moreBtn} activeOpacity={0.7}>
            <Feather name="more-vertical" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Order banner */}
        {orderNo && (
          <View style={s.orderBanner}>
            <Feather name="package" size={13} color={colors.primary} />
            <Text style={s.orderBannerTxt}>Regarding order: <Text style={{ fontWeight: '700' }}>{orderNo}</Text></Text>
          </View>
        )}

        {/* ── Messages ── */}
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F0F2F5' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>

          {loading ? (
            <View style={s.centered}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => String(m.id)}
              renderItem={({ item, index }) => {
                const showDateSep = shouldShowDateSep(messages, index)
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
                    />
                  </View>
                )
              }}
              contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[2] }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <View style={s.emptyIcon}>
                    <Feather name="message-circle" size={32} color={colors.primary} />
                  </View>
                  <Text style={s.emptyTitle}>How can we help?</Text>
                  <Text style={s.emptyTxt}>Our support team is here for you</Text>
                </View>
              }
              ListFooterComponent={agentTyping ? <TypingIndicator /> : null}
            />
          )}

          {/* ── Input bar ── */}
          {session?.status !== 'closed' ? (
            <View style={[s.inputWrap, inputFocused && s.inputWrapFocused]}>
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

          {/* Safe area bottom padding */}
          {session?.status !== 'closed' && <View style={{ height: insets.bottom }} />}
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Lightbox */}
      {lightboxUri && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
          <TouchableWithoutFeedback onPress={() => setLightboxUri(null)}>
            <View style={s.lightboxBg}>
              <Image source={{ uri: lightboxUri }} style={s.lightboxImg} resizeMode="contain" />
              <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUri(null)}>
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },

  sheet: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F0F2F5',
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingBottom: spacing[4],
    gap: spacing[3],
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  onlineRing: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#0D5C45',
  },
  headerTitle:     { fontSize: RF(16), fontWeight: '700', color: '#fff' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  headerStatus:    { fontSize: RF(12), color: 'rgba(255,255,255,0.8)' },
  moreBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Order banner
  orderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  orderBannerTxt: { fontSize: RF(12), color: colors.primary },

  // Date separator
  dateSep: { alignItems: 'center', marginVertical: spacing[3] },
  dateSepTxt: {
    fontSize: RF(11), color: colors.muted,
    backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
  },

  // Empty state
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:  { paddingTop: 80, alignItems: 'center', gap: spacing[3] },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: RF(18), fontWeight: '700', color: colors.dark },
  emptyTxt:   { fontSize: RF(14), color: colors.muted },

  // Input
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2],
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  inputWrapFocused: { borderTopColor: colors.primary + '40' },
  attachBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  input: {
    flex: 1, backgroundColor: '#F0F2F5',
    borderRadius: 22, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: RF(15), color: colors.dark, maxHeight: 120,
    borderWidth: 1, borderColor: 'transparent',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: colors.primary },

  // Closed
  closedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    padding: spacing[4], backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  closedTxt: { fontSize: RF(13), color: colors.muted },

  // Lightbox
  lightboxBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg:   { width: W, height: SCREEN_H * 0.75 },
  lightboxClose: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
})
