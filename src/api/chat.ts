import client from './client'

export type ChatMessage = {
  id: number
  sessionId: number
  senderId: number
  senderType: 'user' | 'agent' | 'system'
  senderName: string
  senderAvatar?: string | null
  content: string
  msgType: 'text' | 'image' | 'order' | 'quickreply'
  createTime: string
  isRead?: number
}

export type ChatSession = {
  sessionId: number
  status: 'open' | 'claimed' | 'closed'
  agentId: number | null
  agentName: string | null
}

export type PollResult = {
  messages: ChatMessage[]
  status: 'open' | 'claimed' | 'closed'
  agentId: number | null
  agentName: string | null
}

export async function getOrCreateSession(params?: {
  orderId?: number
  orderNo?: string
}): Promise<ChatSession> {
  const res = await client.post('/tuka/chat/session', params || {})
  return res.data?.data
}

export async function getMessages(sessionId: number, pageNum = 1): Promise<ChatMessage[]> {
  const res = await client.get(`/tuka/chat/messages/${sessionId}`, {
    params: { pageNum, pageSize: 50 },
  })
  return res.data?.data || []
}

export async function sendMessage(sessionId: number, content: string, msgType = 'text'): Promise<ChatMessage> {
  const res = await client.post('/tuka/chat/send', { sessionId, content, msgType })
  return res.data?.data
}

export async function sendImageMessage(sessionId: number, uri: string, fileName: string): Promise<ChatMessage> {
  const formData = new FormData()
  formData.append('sessionId', String(sessionId))
  formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any)
  const res = await client.post('/tuka/chat/sendImage', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data?.data
}

export async function pollSession(sessionId: number, lastId: number): Promise<PollResult> {
  const res = await client.get(`/tuka/chat/poll/${sessionId}`, { params: { lastId } })
  const d = res.data?.data || {}
  return {
    messages:  d.messages  || [],
    status:    d.status    || 'open',
    agentId:   d.agentId   ?? null,
    agentName: d.agentName ?? null,
  }
}

// Backward compat
export async function pollMessages(sessionId: number, lastId: number): Promise<ChatMessage[]> {
  const r = await pollSession(sessionId, lastId)
  return r.messages
}

// ── WebSocket-based real-time chat poller ─────────────────────────────────────
// Connects via WebSocket for instant delivery.
// Falls back to HTTP polling automatically if WS is unavailable.

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]

export class ChatPoller {
  private sessionId:    number
  private lastId:       number
  private onUpdate:     (result: PollResult) => void
  private running:      boolean = false

  // WebSocket
  private ws:           WebSocket | null = null
  private wsConnected:  boolean = false
  private reconnectIdx: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // HTTP fallback poll
  private pollTimer:    ReturnType<typeof setTimeout> | null = null
  private emptyStreak:  number = 0
  private static readonly FAST_MS   = 1500
  private static readonly SLOW_MS   = 4000
  private static readonly IDLE_AFTER = 5

  constructor(
    sessionId: number,
    lastId: number,
    onUpdate: ((result: PollResult) => void) | ((msgs: ChatMessage[]) => void)
  ) {
    this.sessionId = sessionId
    this.lastId    = lastId
    this.onUpdate  = onUpdate as (result: PollResult) => void
  }

  start() {
    this.running = true
    this.emptyStreak = 0
    this.connectWs()
    // Always start fallback poll — it skips itself when WS is connected
    this.schedulePoll(ChatPoller.FAST_MS)
  }

  stop() {
    this.running = false
    if (this.pollTimer)    clearTimeout(this.pollTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  kickPoll() {
    if (!this.running) return
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.emptyStreak = 0
    if (!this.wsConnected) this.schedulePoll(300)
  }

  updateLastId(id: number) {
    this.lastId = id
    this.emptyStreak = 0
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  private connectWs() {
    if (!this.running) return
    try {
      const token = this.getToken()
      if (!token) { this.wsConnected = false; return }

      const base = this.getWsBase()
      const url  = `${base}/ws/chat?token=${encodeURIComponent(token)}`
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.wsConnected = true
        this.reconnectIdx = 0
        // Subscribe to this session
        this.ws?.send(JSON.stringify({ type: 'join', sessionId: this.sessionId }))
      }

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data)
          if (frame.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }))
            return
          }
          if (frame.type === 'message') {
            const msg = frame.data as ChatMessage
            this.lastId = msg.id
            this.emptyStreak = 0
            this.onUpdate({ messages: [msg], status: 'open', agentId: null, agentName: null })
          } else if (frame.type === 'status') {
            const { status, agentId, agentName } = frame.data
            this.onUpdate({ messages: [], status, agentId, agentName })
          }
        } catch { /* ignore */ }
      }

      this.ws.onclose = () => {
        this.wsConnected = false
        if (this.running) this.scheduleWsReconnect()
      }

      this.ws.onerror = () => {
        this.wsConnected = false
        // onclose fires after onerror
      }
    } catch {
      this.wsConnected = false
    }
  }

  private scheduleWsReconnect() {
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectIdx, RECONNECT_DELAYS.length - 1)]
    this.reconnectIdx++
    this.reconnectTimer = setTimeout(() => {
      if (this.running) this.connectWs()
    }, delay)
  }

  // ── HTTP fallback poll ────────────────────────────────────────────────────

  private schedulePoll(delay: number) {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => this.poll(), delay)
  }

  private async poll() {
    if (!this.running) return
    // Skip HTTP poll when WebSocket is delivering messages
    if (this.wsConnected) {
      this.schedulePoll(ChatPoller.SLOW_MS)
      return
    }
    try {
      const result = await pollSession(this.sessionId, this.lastId)
      if (result.messages.length > 0) {
        this.lastId = result.messages[result.messages.length - 1].id
        this.emptyStreak = 0
        this.onUpdate(result)
      } else {
        this.emptyStreak++
        if (result.status) this.onUpdate(result)
      }
    } catch { /* silently retry */ }

    if (this.running) {
      const delay = this.emptyStreak >= ChatPoller.IDLE_AFTER
        ? ChatPoller.SLOW_MS
        : ChatPoller.FAST_MS
      this.schedulePoll(delay)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getToken(): string | null {
    try {
      // React Native AsyncStorage is async — token is stored in memory by client.ts
      // Access it via the module-level variable exported from client
      const { getStoredToken } = require('./client')
      return getStoredToken?.() || null
    } catch { return null }
  }

  private getWsBase(): string {
    try {
      const { BASE_URL } = require('./client')
      const base = BASE_URL || 'https://api.cardyn.net'
      return base
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://')
    } catch { return 'wss://api.cardyn.net' }
  }
}

export async function submitReview(sessionId: number, rating: number, comment: string, userId?: number): Promise<void> {
  await client.post('/tuka/chat/review', { sessionId, rating, comment, userId })
}

export async function getReview(sessionId: number): Promise<{ rating: number; comment: string } | null> {
  const res = await client.get(`/tuka/chat/review/${sessionId}`)
  return res.data?.data || null
}
