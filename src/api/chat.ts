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
  private sessionId: number
  private lastId:    number
  private timer:     ReturnType<typeof setTimeout> | null = null
  private running:   boolean = false
  private onUpdate:  (result: PollResult) => void

  constructor(
    sessionId: number,
    lastId: number,
    // Accept both old (msgs only) and new (full result) callbacks
    onUpdate: ((result: PollResult) => void) | ((msgs: ChatMessage[]) => void)
  ) {
    this.sessionId = sessionId
    this.lastId    = lastId
    this.onUpdate  = onUpdate as (result: PollResult) => void
  }

  start() {
    this.running = true
    this.poll()
  }

  stop() {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
  }

  private async poll() {
    if (!this.running) return
    try {
      const result = await pollSession(this.sessionId, this.lastId)
      if (result.messages.length > 0) {
        this.lastId = result.messages[result.messages.length - 1].id
      }
      this.onUpdate(result)
    } catch { /* silently retry */ }
    if (this.running) {
      this.timer = setTimeout(() => this.poll(), 3000)
    }
  }

  updateLastId(id: number) {
    this.lastId = id
  }
}

export async function submitReview(sessionId: number, rating: number, comment: string, userId?: number): Promise<void> {
  await client.post('/tuka/chat/review', { sessionId, rating, comment, userId })
}

export async function getReview(sessionId: number): Promise<{ rating: number; comment: string } | null> {
  const res = await client.get(`/tuka/chat/review/${sessionId}`)
  return res.data?.data || null
}
