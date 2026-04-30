<script setup lang="ts">
const props = defineProps<{
  type: 'task' | 'support' | 'chat'
}>()

const { syncFromList } = useCabinetUnread()

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  type: 'task' | 'support' | 'chat'
  title: string
  status: 'open' | 'closed'
  createdAt: string
  updatedAt: string
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
}

interface Message {
  id: string
  conversationId: string
  senderType: 'candidate' | 'admin' | 'system'
  senderId: string | null
  senderName: string
  content: string
  readAt: string | null
  createdAt: string
}

// ─── State ────────────────────────────────────────────────────────────────────

const conversations = ref<Conversation[]>([])
const activeConvId = ref<string | null>(null)
const activeMessages = ref<Message[]>([])
const activeConv = computed(() => conversations.value.find(c => c.id === activeConvId.value) ?? null)
const showThread = ref(false)

const loadingConvs = ref(true)
const loadingThread = ref(false)
const sendingMsg = ref(false)
const newMsgContent = ref('')
const sendError = ref('')

const msgListEl = ref<HTMLElement | null>(null)

// ─── Search & filter (tasks / support only) ───────────────────────────────────
const searchQuery  = ref('')
const filterStatus = ref<'all' | 'open' | 'closed'>('all')

const filteredConversations = computed(() => {
  let list = conversations.value
  if (filterStatus.value !== 'all') list = list.filter(c => c.status === filterStatus.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(c => c.title.toLowerCase().includes(q) || (c.lastMessage?.toLowerCase().includes(q) ?? false))
  return list
})

// Reset filters when switching type
watch(() => props.type, () => { searchQuery.value = ''; filterStatus.value = 'all' })

// Chat is two-panel on desktop; tasks/support are always single-column
const isTwoPanel = computed(() => props.type === 'chat')

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchConversations() {
  loadingConvs.value = true
  try {
    const data = await $fetch<Conversation[]>('/api/cabinet/messages/conversations', {
      query: { type: props.type },
    })
    conversations.value = data
    syncFromList(data)
  } finally {
    loadingConvs.value = false
  }
}

watch(() => props.type, () => {
  activeConvId.value = null
  activeMessages.value = []
  showThread.value = false
  fetchConversations()
})

async function openConversation(convId: string) {
  if (activeConvId.value === convId) { showThread.value = true; return }
  activeConvId.value = convId
  showThread.value = true
  activeMessages.value = []
  loadingThread.value = true
  sendError.value = ''
  newMsgContent.value = ''
  try {
    const data = await $fetch<{ conversation: Conversation; messages: Message[] }>(
      `/api/cabinet/messages/conversations/${convId}`
    )
    activeMessages.value = data.messages
    await $fetch(`/api/cabinet/messages/conversations/${convId}/read`, { method: 'POST' })
    const c = conversations.value.find(x => x.id === convId)
    if (c) c.unreadCount = 0
    syncFromList(conversations.value)
  } finally {
    loadingThread.value = false
    nextTick(scrollToBottom)
  }
}

function scrollToBottom() {
  if (msgListEl.value) msgListEl.value.scrollTop = msgListEl.value.scrollHeight
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendMessage() {
  const content = newMsgContent.value.trim()
  if (!content || !activeConvId.value || sendingMsg.value) return
  sendError.value = ''
  sendingMsg.value = true
  try {
    const msg = await $fetch<Message>(
      `/api/cabinet/messages/conversations/${activeConvId.value}/send`,
      { method: 'POST', body: { content } }
    )
    if (!activeMessages.value.find(m => m.id === msg.id)) activeMessages.value.push(msg)
    newMsgContent.value = ''
    updateLastMessage(activeConvId.value, msg.content, msg.createdAt)
    nextTick(scrollToBottom)
  } catch (e: any) {
    sendError.value = e?.data?.statusMessage ?? 'Failed to send.'
  } finally {
    sendingMsg.value = false
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function updateLastMessage(convId: string, content: string, createdAt: string) {
  const c = conversations.value.find(x => x.id === convId)
  if (c) { c.lastMessage = content; c.lastMessageAt = createdAt; c.updatedAt = createdAt }
  conversations.value.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// no modal — new tickets go to /cabinet/support/new page

// ─── Browser notifications ────────────────────────────────────────────────────

const router = useRouter()

async function requestNotifPermission() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') await Notification.requestPermission()
}

function showNotification(msg: Message, conv: Conversation | undefined) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const senderTitle = conv?.title ?? msg.senderName
  const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content

  const notif = new Notification(senderTitle, {
    body: preview,
    icon: '/favicon.ico',
    // tag groups notifications per conversation — new message replaces old one
    tag: `conv-${msg.conversationId}`,
    renotify: true,
  })

  notif.onclick = () => {
    window.focus()
    const page = conv?.type === 'task' ? '/cabinet/tasks'
      : conv?.type === 'support'       ? '/cabinet/support'
      : '/cabinet/chat'
    router.push(page)
    notif.close()
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/api/ws/messages`)
  ws.onmessage = (e) => { try { handleWsEvent(JSON.parse(e.data)) } catch {} }
  ws.onclose = () => setTimeout(connectWs, 3000)
  ws.onerror = () => ws?.close()
}

function handleWsEvent(data: any) {
  if (data.type === 'new_message') {
    const msg: Message = data.message
    const isActiveConv  = msg.conversationId === activeConvId.value
    // Candidate is actively reading this exact conversation
    const isReading     = isActiveConv && !document.hidden

    if (isReading) {
      if (!activeMessages.value.find(m => m.id === msg.id)) {
        activeMessages.value.push(msg)
        nextTick(scrollToBottom)
      }
      $fetch(`/api/cabinet/messages/conversations/${msg.conversationId}/read`, { method: 'POST' })
    } else {
      const c = conversations.value.find(x => x.id === msg.conversationId)
      if (c && msg.senderType === 'admin') c.unreadCount++
    }

    if (msg.senderType === 'admin' && !isReading) {
      const conv = conversations.value.find(x => x.id === msg.conversationId)
      showNotification(msg, conv)
    }

    updateLastMessage(msg.conversationId, msg.content, msg.createdAt)
    syncFromList(conversations.value)
  }
  if (data.type === 'new_conversation' && data.conversation?.type === props.type) {
    ws?.send(JSON.stringify({ type: 'subscribe_conv', conversationId: data.conversation.id }))
    fetchConversations()
  }
  if (data.type === 'status_changed' && data.conversationId === activeConvId.value) {
    const c = conversations.value.find(x => x.id === data.conversationId)
    if (c) c.status = data.status
    if (data.message) activeMessages.value.push(data.message)
    nextTick(scrollToBottom)
  }
}

onMounted(() => {
  fetchConversations()
  connectWs()
  requestNotifPermission()
})

onUnmounted(() => {
  ws?.close()
  ws = null
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetters(title: string) {
  const words = title.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return title.slice(0, 2).toUpperCase()
}

// Deterministic hue from string for chat avatars
function avatarHue(title: string) {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff
  return h % 360
}

const statusPill: Record<string, string> = {
  open_task:    'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  open_support: 'bg-amber-100  dark:bg-amber-900/50  text-amber-700  dark:text-amber-300',
  closed:       'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400',
}

function statusClass(conv: Conversation) {
  if (conv.status === 'closed') return statusPill.closed
  return statusPill[`open_${conv.type}`] ?? statusPill.open_task
}

function relativeTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso), diff = Date.now() - d.getTime()
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- ══════════════════════════════════════════════════════════════════════════
         CHAT — Facebook Messenger style
    ═══════════════════════════════════════════════════════════════════════════ -->
    <template v-if="type === 'chat'">
      <div class="flex flex-1 min-h-0 bg-surface-50 dark:bg-surface-950">
        <div class="flex flex-1 min-h-0 max-w-xl w-full mx-auto bg-white dark:bg-surface-900 sm:border-x border-surface-200 dark:border-surface-800">

          <!-- LEFT: people list -->
          <aside
            class="flex flex-col w-full sm:w-48 flex-shrink-0 border-r border-surface-100 dark:border-surface-800 overflow-y-auto"
            :class="showThread ? 'hidden sm:flex' : 'flex'"
          >
            <!-- List header -->
            <div class="px-3 pt-4 pb-2 shrink-0">
              <h2 class="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">People</h2>
            </div>

            <!-- Loading skeletons -->
            <div v-if="loadingConvs" class="flex flex-col gap-0.5 px-1.5 py-1">
              <div v-for="i in 6" :key="i" class="flex items-center gap-2.5 px-2 py-2">
                <div class="size-9 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
                <div class="h-3 rounded bg-surface-100 dark:bg-surface-800 animate-pulse flex-1" />
              </div>
            </div>

            <!-- Empty -->
            <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center flex-1 p-6 gap-2 text-center">
              <div class="flex size-12 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                <svg class="size-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <p class="text-xs font-medium text-surface-400">No contacts</p>
            </div>

            <!-- People list — compact contact style -->
            <ul v-else class="flex flex-col gap-0.5 px-1.5 py-1">
              <li
                v-for="conv in conversations"
                :key="conv.id"
                class="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors"
                :class="activeConvId === conv.id
                  ? 'bg-brand-50 dark:bg-brand-950/40'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-800/60'"
                :title="conv.title"
                @click="openConversation(conv.id)"
              >
                <!-- Avatar with unread ring -->
                <div class="relative shrink-0">
                  <div
                    class="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white select-none transition-all"
                    :class="activeConvId === conv.id ? 'ring-2 ring-brand-400 ring-offset-1 ring-offset-white dark:ring-offset-surface-900' : ''"
                    :style="`background: hsl(${avatarHue(conv.title)}, 55%, 50%)`"
                  >
                    {{ avatarLetters(conv.title) }}
                  </div>
                  <!-- Unread dot on avatar -->
                  <span
                    v-if="conv.unreadCount > 0"
                    class="absolute -top-0.5 -right-0.5 flex items-center justify-center size-4 rounded-full bg-brand-600 text-white text-[9px] font-bold ring-1 ring-white dark:ring-surface-900"
                  >
                    {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
                  </span>
                </div>

                <!-- Name only -->
                <span
                  class="text-sm truncate leading-tight"
                  :class="conv.unreadCount > 0
                    ? 'font-bold text-surface-900 dark:text-surface-100'
                    : activeConvId === conv.id
                      ? 'font-semibold text-brand-700 dark:text-brand-300'
                      : 'font-medium text-surface-700 dark:text-surface-300'"
                >
                  {{ conv.title }}
                </span>
              </li>
            </ul>
          </aside>

          <!-- RIGHT: thread -->
          <div class="flex flex-col flex-1 min-w-0" :class="showThread ? 'flex' : 'hidden sm:flex'">
            <!-- Empty state -->
            <div v-if="!activeConvId" class="flex flex-col items-center justify-center flex-1 gap-3 text-center p-8">
              <svg class="size-12 text-surface-200 dark:text-surface-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              <p class="text-sm text-surface-400">Select a chat to read messages</p>
            </div>

            <template v-else>
              <!-- Thread header — person style -->
              <div class="flex items-center gap-3 px-3 py-2.5 border-b border-surface-100 dark:border-surface-800 shrink-0">
                <button
                  type="button"
                  class="sm:hidden flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer shrink-0"
                  @click="showThread = false"
                >
                  <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <!-- Avatar -->
                <div
                  class="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white select-none shadow-sm"
                  :style="`background: hsl(${avatarHue(activeConv?.title ?? '')}, 55%, 50%)`"
                >
                  {{ avatarLetters(activeConv?.title ?? '') }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-semibold text-surface-400 uppercase tracking-wide leading-none mb-0.5">Chat with</p>
                  <p class="text-sm font-bold text-surface-900 dark:text-surface-100 truncate leading-tight">{{ activeConv?.title }}</p>
                  <div class="flex items-center gap-1 mt-0.5">
                    <span
                      class="inline-block size-1.5 rounded-full"
                      :class="activeConv?.status === 'closed' ? 'bg-surface-300 dark:bg-surface-600' : 'bg-green-400'"
                    />
                    <span class="text-[11px] text-surface-400">{{ activeConv?.status === 'closed' ? 'Conversation closed' : 'Active' }}</span>
                  </div>
                </div>
              </div>

              <!-- Messages -->
              <div ref="msgListEl" class="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-3">
                <div v-if="loadingThread" class="flex items-center justify-center flex-1">
                  <svg class="size-5 text-surface-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <template v-else>
                  <div
                    v-for="msg in activeMessages"
                    :key="msg.id"
                    class="flex flex-col"
                    :class="msg.senderType === 'candidate' ? 'items-end' : msg.senderType === 'system' ? 'items-center' : 'items-start'"
                  >
                    <div v-if="msg.senderType === 'system'" class="text-xs text-surface-400 dark:text-surface-500 italic px-3 py-1">
                      {{ msg.content }}
                    </div>
                    <template v-else>
                      <!-- Admin / member message: mini avatar + name above bubble -->
                      <div v-if="msg.senderType !== 'candidate'" class="flex items-end gap-2 max-w-[82%]">
                        <div
                          class="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white select-none"
                          :style="`background: hsl(${avatarHue(msg.senderName)}, 55%, 50%)`"
                        >
                          {{ avatarLetters(msg.senderName) }}
                        </div>
                        <div class="flex flex-col items-start min-w-0">
                          <span class="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1 px-0.5 leading-none">{{ msg.senderName }}</span>
                          <div class="rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100">
                            {{ msg.content }}
                          </div>
                          <span class="text-[10px] text-surface-400 mt-1 px-0.5">{{ formatTime(msg.createdAt) }}</span>
                        </div>
                      </div>
                      <!-- Candidate's own messages: right-aligned, no avatar -->
                      <div v-else class="flex flex-col items-end max-w-[82%]">
                        <div class="rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-brand-600 text-white">
                          {{ msg.content }}
                        </div>
                        <span class="text-[10px] text-surface-400 mt-1 px-0.5">{{ formatTime(msg.createdAt) }}</span>
                      </div>
                    </template>
                  </div>
                </template>
              </div>

              <!-- Input -->
              <div class="shrink-0 px-4 pb-4 pt-2 border-t border-surface-100 dark:border-surface-800">
                <div v-if="sendError" class="mb-2 text-xs text-danger-600 dark:text-danger-400">{{ sendError }}</div>
                <div v-if="activeConv?.status === 'closed'" class="flex items-center justify-center py-3 rounded-xl bg-surface-50 dark:bg-surface-800 text-sm text-surface-400">
                  This conversation is closed.
                </div>
                <div v-else class="flex gap-2">
                  <textarea
                    v-model="newMsgContent"
                    rows="2"
                    placeholder="Aa"
                    class="flex-1 resize-none rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-4 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    @keydown="handleEnter"
                  />
                  <button
                    type="button"
                    :disabled="!newMsgContent.trim() || sendingMsg"
                    class="flex items-center justify-center size-10 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shrink-0 self-end"
                    @click="sendMessage"
                  >
                    <svg v-if="sendingMsg" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <svg v-else class="size-4 translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>

        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════════════════════════════
         TASKS / SUPPORT — List → detail with back button
    ═══════════════════════════════════════════════════════════════════════════ -->
    <template v-else>
      <div class="flex flex-col flex-1 min-h-0 bg-surface-50 dark:bg-surface-950">
        <div class="flex flex-col flex-1 min-h-0 max-w-xl w-full mx-auto bg-white dark:bg-surface-900 sm:border-x border-surface-200 dark:border-surface-800">

          <!-- LIST VIEW -->
          <div v-if="!showThread" class="flex flex-col flex-1 min-h-0">

            <!-- ── Toolbar: title + new ticket button ── -->
            <div class="flex items-center justify-between gap-3 px-4 pt-4 pb-3 shrink-0">
              <h2 class="text-base font-bold text-surface-900 dark:text-surface-100">
                {{ type === 'task' ? 'Tasks' : 'Support Tickets' }}
              </h2>
              <NuxtLink
                v-if="type === 'support'"
                to="/cabinet/support/new"
                class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors shrink-0"
              >
                <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Ticket
              </NuxtLink>
            </div>

            <!-- ── Search ── -->
            <div class="px-4 pb-2 shrink-0">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-surface-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  v-model="searchQuery"
                  type="search"
                  :placeholder="type === 'task' ? 'Search tasks…' : 'Search tickets…'"
                  class="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <button
                  v-if="searchQuery"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  @click="searchQuery = ''"
                >
                  <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- ── Status filters ── -->
            <div class="flex items-center gap-1.5 px-4 pb-3 shrink-0">
              <button
                v-for="f in ([['all','All'],['open','Open'],['closed','Closed']] as const)"
                :key="f[0]"
                class="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer"
                :class="filterStatus === f[0]
                  ? type === 'task'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'"
                @click="filterStatus = f[0]"
              >
                {{ f[1] }}
                <span
                  v-if="f[0] !== 'all'"
                  class="inline-flex items-center justify-center min-w-[16px] h-4 rounded px-0.5 text-[9px] font-bold"
                  :class="filterStatus === f[0] ? 'bg-white/20' : 'bg-surface-100 dark:bg-surface-800 text-surface-500'"
                >
                  {{ conversations.filter(c => c.status === f[0]).length }}
                </span>
              </button>
              <!-- Result count when searching -->
              <span v-if="searchQuery" class="ml-auto text-xs text-surface-400">
                {{ filteredConversations.length }} result{{ filteredConversations.length !== 1 ? 's' : '' }}
              </span>
            </div>

            <!-- Loading -->
            <div v-if="loadingConvs" class="flex flex-col gap-3 px-4 pb-4 overflow-y-auto">
              <div v-for="i in 3" :key="i" class="rounded-lg border border-surface-200 dark:border-surface-800 p-4 flex flex-col gap-2.5 animate-pulse">
                <div class="flex items-center gap-2">
                  <div class="h-5 w-14 rounded bg-surface-100 dark:bg-surface-800" />
                  <div class="flex-1" />
                  <div class="h-4 w-20 rounded bg-surface-100 dark:bg-surface-800" />
                </div>
                <div class="h-4 w-3/4 rounded bg-surface-100 dark:bg-surface-800" />
                <div class="h-3 w-full rounded bg-surface-100 dark:bg-surface-800" />
                <div class="h-3 w-2/3 rounded bg-surface-100 dark:bg-surface-800" />
              </div>
            </div>

            <!-- Empty (no conversations at all) -->
            <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center flex-1 p-10 gap-4 text-center">
              <div class="flex size-14 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800">
                <svg v-if="type === 'task'" class="size-7 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                <svg v-else class="size-7 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 00-1.652 1.306A9.025 9.025 0 004.33 7.288" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">
                  {{ type === 'task' ? 'No tasks assigned yet' : 'No support tickets' }}
                </p>
                <p v-if="type === 'support'" class="text-xs text-surface-400 mt-1">Open a ticket and we'll get back to you shortly.</p>
              </div>
              <NuxtLink v-if="type === 'support'" to="/cabinet/support/new" class="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors">
                <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
                Open a ticket
              </NuxtLink>
            </div>

            <!-- No search results -->
            <div v-else-if="filteredConversations.length === 0" class="flex flex-col items-center justify-center flex-1 p-10 gap-2 text-center">
              <svg class="size-8 text-surface-300 dark:text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p class="text-sm font-medium text-surface-500">No results for "{{ searchQuery }}"</p>
              <button class="text-xs text-brand-600 dark:text-brand-400 hover:underline cursor-pointer" @click="searchQuery = ''">Clear search</button>
            </div>

            <!-- ── Cards ── -->
            <ul v-else class="flex flex-col gap-3 px-4 pb-4 overflow-y-auto">
              <li
                v-for="conv in filteredConversations"
                :key="conv.id"
                class="flex flex-col rounded-xl border bg-white dark:bg-surface-900 shadow-sm cursor-pointer transition-all hover:shadow-md group overflow-hidden"
                :class="conv.unreadCount > 0
                  ? 'border-brand-200 dark:border-brand-800'
                  : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'"
                @click="openConversation(conv.id)"
              >
                <!-- Accent top border -->
                <div
                  class="h-0.5 w-full shrink-0"
                  :class="conv.status === 'closed'
                    ? 'bg-surface-200 dark:bg-surface-700'
                    : type === 'task' ? 'bg-purple-500' : 'bg-amber-500'"
                />

                <div class="px-4 pt-3.5 pb-4 flex flex-col gap-2.5">
                  <!-- Row 1: status pill + unread badge + time -->
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                      :class="statusClass(conv)"
                    >
                      <span
                        class="inline-block size-1.5 rounded-full"
                        :class="conv.status === 'closed' ? 'bg-surface-400' : type === 'task' ? 'bg-purple-500' : 'bg-amber-500'"
                      />
                      {{ conv.status === 'closed' ? 'Closed' : 'Open' }}
                    </span>
                    <span
                      v-if="conv.unreadCount > 0"
                      class="inline-flex items-center justify-center h-4 min-w-[24px] rounded bg-brand-600 text-white text-[9px] font-bold px-1"
                    >
                      {{ conv.unreadCount }} new
                    </span>
                    <span class="ml-auto text-[10px] text-surface-400">{{ relativeTime(conv.lastMessageAt ?? conv.updatedAt) }}</span>
                  </div>

                  <!-- Row 2: title -->
                  <h3
                    class="text-sm font-bold leading-snug line-clamp-2"
                    :class="conv.unreadCount > 0 ? 'text-surface-900 dark:text-surface-100' : 'text-surface-800 dark:text-surface-200'"
                  >
                    {{ conv.title }}
                  </h3>

                  <!-- Row 3: last message preview -->
                  <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 leading-relaxed">
                    {{ conv.lastMessage ?? 'No messages yet.' }}
                  </p>

                  <!-- Row 4: footer meta -->
                  <div class="flex items-center justify-between gap-3 pt-0.5 border-t border-surface-100 dark:border-surface-800 mt-0.5">
                    <div class="flex items-center gap-3 text-[11px] text-surface-400">
                      <span class="flex items-center gap-1">
                        <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                        </svg>
                        {{ formatDateShort(conv.createdAt) }}
                      </span>
                      <span v-if="conv.lastMessageAt" class="flex items-center gap-1">
                        <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Updated {{ relativeTime(conv.lastMessageAt) }}
                      </span>
                    </div>
                    <svg class="size-3.5 text-surface-300 dark:text-surface-600 group-hover:text-surface-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <!-- THREAD VIEW -->
          <div v-else class="flex flex-col flex-1 min-h-0">

            <!-- Thread header with always-visible back button -->
            <div class="flex items-center gap-2 px-3 py-3 border-b border-surface-100 dark:border-surface-800 shrink-0">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer shrink-0"
                @click="showThread = false"
              >
                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <!-- Status icon small -->
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-lg"
                :class="activeConv?.status === 'closed'
                  ? 'bg-surface-100 dark:bg-surface-800'
                  : type === 'task'
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'bg-amber-100 dark:bg-amber-900/40'"
              >
                <svg v-if="type === 'task'" class="size-4" :class="activeConv?.status === 'closed' ? 'text-surface-400' : 'text-purple-600 dark:text-purple-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                <svg v-else class="size-4" :class="activeConv?.status === 'closed' ? 'text-surface-400' : 'text-amber-600 dark:text-amber-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 00-1.652 1.306A9.025 9.025 0 004.33 7.288" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{{ activeConv?.title }}</p>
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full" :class="statusClass(activeConv!)">
                  {{ activeConv?.status === 'closed' ? 'Closed' : 'Open' }}
                </span>
              </div>
            </div>

            <!-- Messages -->
            <div ref="msgListEl" class="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-3">
              <div v-if="loadingThread" class="flex items-center justify-center flex-1">
                <svg class="size-5 text-surface-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <template v-else>
                <div
                  v-for="msg in activeMessages"
                  :key="msg.id"
                  class="flex flex-col"
                  :class="msg.senderType === 'candidate' ? 'items-end' : msg.senderType === 'system' ? 'items-center' : 'items-start'"
                >
                  <div v-if="msg.senderType === 'system'" class="text-xs text-surface-400 dark:text-surface-500 italic px-3 py-1">
                    {{ msg.content }}
                  </div>
                  <template v-else>
                    <!-- Admin / member message: mini avatar + name above bubble -->
                    <div v-if="msg.senderType !== 'candidate'" class="flex items-end gap-2 max-w-[82%]">
                      <div
                        class="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white select-none"
                        :style="`background: hsl(${avatarHue(msg.senderName)}, 55%, 50%)`"
                      >
                        {{ avatarLetters(msg.senderName) }}
                      </div>
                      <div class="flex flex-col items-start min-w-0">
                        <span class="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1 px-0.5 leading-none">{{ msg.senderName }}</span>
                        <div class="rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100">
                          {{ msg.content }}
                        </div>
                        <span class="text-[10px] text-surface-400 mt-1 px-0.5">{{ formatTime(msg.createdAt) }}</span>
                      </div>
                    </div>
                    <!-- Candidate's own messages: right-aligned, no avatar -->
                    <div v-else class="flex flex-col items-end max-w-[82%]">
                      <div class="rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-brand-600 text-white">
                        {{ msg.content }}
                      </div>
                      <span class="text-[10px] text-surface-400 mt-1 px-0.5">{{ formatTime(msg.createdAt) }}</span>
                    </div>
                  </template>
                </div>
              </template>
            </div>

            <!-- Input -->
            <div class="shrink-0 px-4 pb-4 pt-2 border-t border-surface-100 dark:border-surface-800">
              <div v-if="sendError" class="mb-2 text-xs text-danger-600 dark:text-danger-400">{{ sendError }}</div>
              <div v-if="activeConv?.status === 'closed'" class="flex items-center justify-center py-3 rounded-xl bg-surface-50 dark:bg-surface-800 text-sm text-surface-400">
                This conversation is closed.
              </div>
              <div v-else class="flex gap-2">
                <textarea
                  v-model="newMsgContent"
                  rows="2"
                  placeholder="Type a message…"
                  class="flex-1 resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  @keydown="handleEnter"
                />
                <button
                  type="button"
                  :disabled="!newMsgContent.trim() || sendingMsg"
                  class="flex items-center justify-center size-10 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shrink-0 self-end"
                  @click="sendMessage"
                >
                  <svg v-if="sendingMsg" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </template>

  </div>
</template>

