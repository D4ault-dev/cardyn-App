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

export class ChatPoller {
  private sessionId:    number
  private lastId:       number
  private timer:        ReturnType<typeof setTimeout> | null = null
  private running:      boolean = false
  private onUpdate:     (result: PollResult) => void
  private emptyStreak:  number = 0   // consecutive empty polls — used for backoff

  // Intervals: fast when active, slow when idle
  private static readonly FAST_MS  = 1500   // 1.5s — active chat
  private static readonly SLOW_MS  = 4000   // 4s   — idle (no messages for a while)
  private static readonly IDLE_AFTER = 5    // switch to slow after 5 empty polls

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
    this.poll()
  }

  stop() {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
  }

  /** Call this after the user sends a message to immediately poll for the echo */
  kickPoll() {
    if (!this.running) return
    if (this.timer) clearTimeout(this.timer)
    this.emptyStreak = 0  // reset backoff — user is active
    this.timer = setTimeout(() => this.poll(), 300)  // poll in 300ms
  }

  private async poll() {
    if (!this.running) return
    try {
      const result = await pollSession(this.sessionId, this.lastId)
      if (result.messages.length > 0) {
        this.lastId = result.messages[result.messages.length - 1].id
        this.emptyStreak = 0  // reset backoff on activity
        this.onUpdate(result)
      } else {
        this.emptyStreak++
        // Still call onUpdate for status changes even with no messages
        if (result.status) this.onUpdate(result)
      }
    } catch { /* silently retry */ }

    if (this.running) {
      // Use fast interval when active, slow when idle
      const delay = this.emptyStreak >= ChatPoller.IDLE_AFTER
        ? ChatPoller.SLOW_MS
        : ChatPoller.FAST_MS
      this.timer = setTimeout(() => this.poll(), delay)
    }
  }

  updateLastId(id: number) {
    this.lastId = id
    this.emptyStreak = 0  // reset backoff — activity detected
  }
}

export async function submitReview(sessionId: number, rating: number, comment: string, userId?: number): Promise<void> {
  await client.post('/tuka/chat/review', { sessionId, rating, comment, userId })
}

export async function getReview(sessionId: number): Promise<{ rating: number; comment: string } | null> {
  const res = await client.get(`/tuka/chat/review/${sessionId}`)
  return res.data?.data || null
}
