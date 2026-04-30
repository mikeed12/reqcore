<script setup lang="ts">
import { MessageSquare, X, Minus, Plus, Trash2, ChevronLeft, Search } from 'lucide-vue-next'

const { isOpen, isMinimized, totalUnread, close, minimize } = useConversationsPanel()

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  id: string
  type: 'task' | 'support' | 'chat'
  title: string
  status: 'open' | 'closed'
  candidateId: string
  candidateFirstName: string | null
  candidateLastName: string | null
  candidateEmail: string | null
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

interface ActiveThread {
  conversation: ConversationRow & { candidateName: string; candidateEmail: string }
  messages: Message[]
}

// ─── Candidates (lazy) ───────────────────────────────────────────────────────

const candidates = ref<{ id: string; firstName: string; lastName: string; email: string }[]>([])
const candidatesLoading = ref(false)
const candidatesLoaded = ref(false)

async function ensureCandidates() {
  if (candidatesLoaded.value || candidatesLoading.value) return
  candidatesLoading.value = true
  try {
    const pages = await Promise.all([1, 2, 3].map(page =>
      $fetch<{ data: typeof candidates.value }>('/api/candidates', { query: { limit: 100, page } })
    ))
    candidates.value = pages.flatMap(p => p.data ?? [])
    candidatesLoaded.value = true
  } catch (e) {
    console.error('[ConversationsPanel] failed to load candidates:', e)
  } finally {
    candidatesLoading.value = false
  }
}

const candidateOptions = computed(() =>
  candidates.value.map(c => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName} — ${c.email}`,
  }))
)

// ─── State ────────────────────────────────────────────────────────────────────

const conversations = ref<ConversationRow[]>([])
const activeConvId = ref<string | null>(null)
const activeThread = ref<ActiveThread | null>(null)
const showThread = ref(false)

const loadingConvs = ref(false)
const loadingThread = ref(false)
const sendingMsg = ref(false)
const newMsgContent = ref('')

const search = ref('')

const showNewModal = ref(false)
const newCandidateId = ref('')
const newMessage = ref('')
const creatingConv = ref(false)
const createError = ref('')

const confirmDeleteId = ref<string | null>(null)
const deletingConv = ref(false)

const msgListEl = ref<HTMLElement | null>(null)

// Keep totalUnread in sync with the composable
watch(conversations, (list) => {
  totalUnread.value = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
}, { deep: true })

// Filtered list by search
const filteredConversations = computed(() => {
  if (!search.value.trim()) return conversations.value
  const q = search.value.toLowerCase()
  return conversations.value.filter(c =>
    `${c.candidateFirstName} ${c.candidateLastName}`.toLowerCase().includes(q) ||
    (c.lastMessage ?? '').toLowerCase().includes(q)
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchConversations() {
  loadingConvs.value = true
  try {
    conversations.value = await $fetch<ConversationRow[]>('/api/conversations', {
      query: { type: 'chat' },
    })
  } finally {
    loadingConvs.value = false
  }
}

// Fetch when the panel opens for the first time
const hasFetched = ref(false)
watch(isOpen, (val) => {
  if (val && !hasFetched.value) {
    fetchConversations()
    hasFetched.value = true
  }
})

async function openConversation(convId: string) {
  if (activeConvId.value === convId) { showThread.value = true; return }
  activeConvId.value = convId
  showThread.value = true
  activeThread.value = null
  loadingThread.value = true
  newMsgContent.value = ''
  confirmDeleteId.value = null
  try {
    const data = await $fetch<ActiveThread>(`/api/conversations/${convId}`)
    activeThread.value = data
    await $fetch(`/api/conversations/${convId}/read`, { method: 'POST' })
    const c = conversations.value.find(x => x.id === convId)
    if (c) c.unreadCount = 0
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
  sendingMsg.value = true
  try {
    const msg = await $fetch<Message>(`/api/conversations/${activeConvId.value}/send`, {
      method: 'POST', body: { content },
    })
    if (activeThread.value && !activeThread.value.messages.find(m => m.id === msg.id)) {
      activeThread.value.messages.push(msg)
    }
    newMsgContent.value = ''
    updateLastMessage(activeConvId.value, msg.content, msg.createdAt)
    nextTick(scrollToBottom)
  } finally {
    sendingMsg.value = false
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function updateLastMessage(convId: string, content: string, at: string) {
  const c = conversations.value.find(x => x.id === convId)
  if (c) { c.lastMessage = content; c.lastMessageAt = at; c.updatedAt = at }
  conversations.value.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteConversation() {
  const id = confirmDeleteId.value
  if (!id || deletingConv.value) return
  deletingConv.value = true
  try {
    await $fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    conversations.value = conversations.value.filter(c => c.id !== id)
    if (activeConvId.value === id) {
      activeConvId.value = null
      activeThread.value = null
      showThread.value = false
    }
  } finally {
    deletingConv.value = false
    confirmDeleteId.value = null
  }
}

// ─── New chat ─────────────────────────────────────────────────────────────────

function openNewModal() {
  showNewModal.value = true
  newCandidateId.value = ''
  newMessage.value = ''
  createError.value = ''
  ensureCandidates()
}

async function createConversation() {
  if (!newCandidateId.value || !newMessage.value.trim()) return
  creatingConv.value = true
  createError.value = ''
  try {
    const { id } = await $fetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: {
        candidateId: newCandidateId.value,
        type: 'chat',
        title: '',
        initialMessage: newMessage.value.trim(),
      },
    })
    showNewModal.value = false
    await fetchConversations()
    await openConversation(id)
  } catch (e: any) {
    createError.value = e?.data?.statusMessage ?? 'Failed to create.'
  } finally {
    creatingConv.value = false
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
    if (msg.conversationId === activeConvId.value) {
      if (activeThread.value && !activeThread.value.messages.find(m => m.id === msg.id)) {
        activeThread.value.messages.push(msg)
        nextTick(scrollToBottom)
      }
      $fetch(`/api/conversations/${msg.conversationId}/read`, { method: 'POST' })
    } else {
      const c = conversations.value.find(x => x.id === msg.conversationId)
      if (c && msg.senderType === 'candidate') c.unreadCount++
    }
    updateLastMessage(msg.conversationId, msg.content, msg.createdAt)
  }
  if (data.type === 'new_conversation' && data.conversation?.type === 'chat') {
    ws?.send(JSON.stringify({ type: 'subscribe_conv', conversationId: data.conversation.id }))
    fetchConversations()
  }
  if (data.type === 'conversation_deleted') {
    conversations.value = conversations.value.filter(c => c.id !== data.conversationId)
    if (activeConvId.value === data.conversationId) {
      activeConvId.value = null; activeThread.value = null; showThread.value = false
    }
  }
}

onMounted(() => {
  connectWs()
  fetchConversations()
  hasFetched.value = true
})
onUnmounted(() => { ws?.close(); ws = null })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(conv: ConversationRow) {
  const f = conv.candidateFirstName?.[0] ?? ''
  const l = conv.candidateLastName?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

function candidateName(conv: ConversationRow | ActiveThread['conversation']) {
  const f = 'candidateName' in conv ? conv.candidateName : `${conv.candidateFirstName ?? ''} ${conv.candidateLastName ?? ''}`.trim()
  return f || 'Unknown'
}

function relativeTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso), diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Consistent avatar colour per candidate (cycles through a palette)
const avatarColors = [
  'bg-brand-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
]
function avatarBg(conv: ConversationRow) {
  let h = 0
  for (const ch of conv.candidateId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
  return avatarColors[h % avatarColors.length]
}
</script>

<template>
  <ClientOnly>
    <!-- ── Floating panel ────────────────────────────────────────────────────── -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-x-4 translate-y-4"
      enter-to-class="opacity-100 translate-x-0 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-x-0 translate-y-0"
      leave-to-class="opacity-0 translate-x-4 translate-y-4"
    >
      <div
        v-if="isOpen"
        class="fixed bottom-4 right-4 z-50 flex flex-col rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl shadow-surface-900/20 dark:shadow-surface-950/60 overflow-hidden"
        :class="isMinimized
          ? 'w-72'
          : 'w-[calc(100vw-2rem)] sm:w-[46rem] h-[calc(100vh-6rem)] sm:h-[36rem]'"
        style="max-width: calc(100vw - 2rem); max-height: calc(100vh - 2rem)"
      >
        <!-- Title bar -->
        <div class="flex items-center gap-2 px-4 h-11 shrink-0 border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-950/60 cursor-default select-none">
          <MessageSquare class="size-4 text-brand-500 shrink-0" />
          <span class="text-sm font-semibold text-surface-900 dark:text-surface-100 flex-1 truncate">Messages</span>

          <span
            v-if="totalUnread > 0 && isMinimized"
            class="flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold px-1"
          >
            {{ totalUnread > 99 ? '99+' : totalUnread }}
          </span>

          <div class="flex items-center gap-0.5 ml-1">
            <!-- New chat -->
            <button
              v-if="!isMinimized"
              type="button"
              class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer"
              title="New message"
              @click="openNewModal"
            >
              <Plus class="size-3.5" />
            </button>
            <!-- Minimize -->
            <button
              type="button"
              class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              :title="isMinimized ? 'Restore' : 'Minimize'"
              @click="minimize()"
            >
              <component :is="isMinimized ? Plus : Minus" class="size-3.5" />
            </button>
            <!-- Close -->
            <button
              type="button"
              class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/40 transition-colors cursor-pointer"
              title="Close"
              @click="close()"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>

        <!-- Panel body -->
        <div v-if="!isMinimized" class="flex flex-1 min-h-0">

          <!-- ── LEFT: contact list ─────────────────────────────────────────── -->
          <aside
            class="flex flex-col w-full sm:w-60 flex-shrink-0 border-r border-surface-100 dark:border-surface-800"
            :class="showThread ? 'hidden sm:flex' : 'flex'"
          >
            <!-- Search -->
            <div class="px-3 py-2 border-b border-surface-100 dark:border-surface-800 shrink-0">
              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-surface-400 pointer-events-none" />
                <input
                  v-model="search"
                  type="search"
                  placeholder="Search…"
                  class="w-full rounded-lg bg-surface-100 dark:bg-surface-800 pl-7 pr-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <!-- List -->
            <div v-if="loadingConvs" class="flex flex-col gap-0 overflow-y-auto">
              <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-3 py-3 border-b border-surface-50 dark:border-surface-800/60">
                <div class="size-9 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
                <div class="flex-1 flex flex-col gap-1.5">
                  <div class="h-2.5 w-24 rounded bg-surface-100 dark:bg-surface-800 animate-pulse" />
                  <div class="h-2 w-36 rounded bg-surface-100 dark:bg-surface-800 animate-pulse" />
                </div>
              </div>
            </div>

            <div v-else-if="filteredConversations.length === 0" class="flex flex-col items-center justify-center flex-1 p-4 gap-2 text-center">
              <MessageSquare class="size-6 text-surface-200 dark:text-surface-700" />
              <p class="text-xs text-surface-400">{{ search ? 'No results' : 'No chats yet' }}</p>
            </div>

            <ul v-else class="flex-1 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-800/60">
              <li
                v-for="conv in filteredConversations"
                :key="conv.id"
                class="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                :class="activeConvId === conv.id
                  ? 'bg-brand-50 dark:bg-brand-950/30'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'"
                @click="openConversation(conv.id)"
              >
                <!-- Avatar -->
                <div
                  class="size-9 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                  :class="avatarBg(conv)"
                >
                  {{ initials(conv) }}
                </div>
                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <p class="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                      {{ conv.candidateFirstName }} {{ conv.candidateLastName }}
                    </p>
                    <span class="text-[10px] text-surface-400 shrink-0">{{ relativeTime(conv.lastMessageAt ?? conv.updatedAt) }}</span>
                  </div>
                  <div class="flex items-center gap-1 mt-0.5">
                    <p class="text-[11px] text-surface-500 dark:text-surface-400 truncate flex-1">
                      {{ conv.lastMessage ?? 'No messages yet' }}
                    </p>
                    <span
                      v-if="conv.unreadCount > 0"
                      class="shrink-0 flex items-center justify-center size-4 rounded-full bg-brand-600 text-white text-[9px] font-bold leading-none"
                    >
                      {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </aside>

          <!-- ── RIGHT: chat ────────────────────────────────────────────────── -->
          <div class="flex flex-col flex-1 min-w-0" :class="showThread ? 'flex' : 'hidden sm:flex'">

            <!-- Empty state -->
            <div v-if="!activeConvId" class="flex flex-col items-center justify-center flex-1 gap-2 text-center p-6">
              <MessageSquare class="size-8 text-surface-200 dark:text-surface-700" />
              <p class="text-xs text-surface-400">Select a chat to start messaging</p>
            </div>

            <template v-else>
              <!-- Chat header -->
              <div class="flex items-center gap-2 px-3 py-2 border-b border-surface-100 dark:border-surface-800 shrink-0">
                <!-- Back (mobile) -->
                <button
                  type="button"
                  class="sm:hidden flex size-6 items-center justify-center rounded-md text-surface-400 hover:text-surface-700 transition-colors"
                  @click="showThread = false"
                >
                  <ChevronLeft class="size-4" />
                </button>

                <!-- Avatar -->
                <div
                  v-if="activeThread"
                  class="size-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                  :class="avatarBg(activeThread.conversation as any)"
                >
                  {{ (activeThread.conversation.candidateName[0] ?? '?').toUpperCase() }}
                </div>

                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                    {{ activeThread ? candidateName(activeThread.conversation) : '…' }}
                  </p>
                  <p v-if="activeThread" class="text-[10px] text-surface-400 truncate">
                    {{ activeThread.conversation.candidateEmail }}
                  </p>
                </div>

                <!-- Delete -->
                <div v-if="activeThread" class="flex items-center gap-1 shrink-0">
                  <div v-if="confirmDeleteId === activeConvId" class="flex items-center gap-1">
                    <span class="text-[11px] text-surface-400">Delete?</span>
                    <button
                      type="button"
                      :disabled="deletingConv"
                      class="text-[11px] rounded-md border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 px-2 py-1 font-medium cursor-pointer disabled:opacity-50"
                      @click="deleteConversation"
                    >
                      <svg v-if="deletingConv" class="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span v-else>Yes</span>
                    </button>
                    <button
                      type="button"
                      class="text-[11px] rounded-md border border-surface-200 dark:border-surface-700 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 px-2 py-1 font-medium cursor-pointer"
                      @click="confirmDeleteId = null"
                    >
                      No
                    </button>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="flex size-6 items-center justify-center rounded-md text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
                    title="Delete chat"
                    @click="confirmDeleteId = activeConvId"
                  >
                    <Trash2 class="size-3.5" />
                  </button>
                </div>
              </div>

              <!-- Messages -->
              <div ref="msgListEl" class="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-2">
                <div v-if="loadingThread" class="flex items-center justify-center flex-1">
                  <svg class="size-4 text-surface-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <template v-else-if="activeThread">
                  <div
                    v-for="msg in activeThread.messages"
                    :key="msg.id"
                    class="flex"
                    :class="msg.senderType === 'admin' ? 'justify-end' : msg.senderType === 'system' ? 'justify-center' : 'justify-start'"
                  >
                    <div v-if="msg.senderType === 'system'" class="text-[10px] text-surface-400 italic px-2 py-0.5">
                      {{ msg.content }}
                    </div>
                    <div
                      v-else
                      class="group flex flex-col max-w-[78%]"
                      :class="msg.senderType === 'admin' ? 'items-end' : 'items-start'"
                    >
                      <div
                        class="rounded-2xl px-3 py-2 text-xs leading-relaxed"
                        :class="msg.senderType === 'admin'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-sm'"
                      >
                        {{ msg.content }}
                      </div>
                      <span class="text-[9px] text-surface-400 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {{ formatTime(msg.createdAt) }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>

              <!-- Input -->
              <div class="shrink-0 px-3 pb-3 pt-2 border-t border-surface-100 dark:border-surface-800">
                <div class="flex gap-2">
                  <textarea
                    v-model="newMsgContent"
                    rows="2"
                    placeholder="Reply…"
                    class="flex-1 resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-xs text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    @keydown="handleEnter"
                  />
                  <button
                    type="button"
                    :disabled="!newMsgContent.trim() || sendingMsg"
                    class="flex items-center justify-center size-9 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shrink-0 self-end"
                    @click="sendMessage"
                  >
                    <svg v-if="sendingMsg" class="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <svg v-else class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── New message modal ──────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNewModal"
          class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          @click.self="showNewModal = false"
        >
          <div class="w-full sm:max-w-md rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden">
            <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <p class="text-base font-semibold text-surface-900 dark:text-surface-100">New Message</p>
              <button type="button" class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors cursor-pointer" @click="showNewModal = false">
                <X class="size-5" />
              </button>
            </div>
            <div class="px-5 py-4 flex flex-col gap-4">
              <!-- Candidate -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">To</label>
                <select
                  v-model="newCandidateId"
                  :disabled="candidatesLoading"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                >
                  <option value="">{{ candidatesLoading ? 'Loading…' : 'Select candidate…' }}</option>
                  <option v-for="opt in candidateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <!-- Message -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Message</label>
                <textarea
                  v-model="newMessage"
                  rows="3"
                  maxlength="5000"
                  placeholder="Hi! I wanted to reach out about…"
                  class="w-full resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div v-if="createError" class="text-xs text-danger-600 dark:text-danger-400">{{ createError }}</div>
              <button
                type="button"
                :disabled="!newCandidateId || !newMessage.trim() || creatingConv"
                class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-semibold transition-colors cursor-pointer"
                @click="createConversation"
              >
                <svg v-if="creatingConv" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ creatingConv ? 'Sending…' : 'Send Message' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
