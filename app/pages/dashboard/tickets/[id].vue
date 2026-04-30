<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

const route = useRoute()
const ticketId = route.params.id as string

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

interface Thread {
  conversation: {
    id: string
    type: string
    title: string
    status: 'open' | 'closed'
    candidateId: string
    candidateName: string
    candidateEmail: string
  }
  messages: Message[]
}

// ─── State ────────────────────────────────────────────────────────────────────

const thread = ref<Thread | null>(null)
const loading = ref(true)
const notFound = ref(false)

const sendContent = ref('')
const sending = ref(false)

const togglingStatus = ref(false)

const confirmDelete = ref(false)
const deleting = ref(false)

const msgListEl = ref<HTMLElement | null>(null)

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchThread() {
  loading.value = true
  try {
    thread.value = await $fetch<Thread>(`/api/conversations/${ticketId}`)
    await $fetch(`/api/conversations/${ticketId}/read`, { method: 'POST' })
  } catch (e: any) {
    if (e?.statusCode === 404) notFound.value = true
  } finally {
    loading.value = false
    nextTick(scrollToBottom)
  }
}

function scrollToBottom() {
  if (msgListEl.value) msgListEl.value.scrollTop = msgListEl.value.scrollHeight
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendMessage() {
  const content = sendContent.value.trim()
  if (!content || !thread.value || sending.value) return
  if (thread.value.conversation.status === 'closed') return
  sending.value = true
  try {
    const msg = await $fetch<Message>(`/api/conversations/${ticketId}/send`, {
      method: 'POST',
      body: { content },
    })
    if (!thread.value.messages.find(m => m.id === msg.id)) {
      thread.value.messages.push(msg)
    }
    sendContent.value = ''
    nextTick(scrollToBottom)
  } finally {
    sending.value = false
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

// ─── Status toggle ────────────────────────────────────────────────────────────

async function toggleStatus() {
  if (!thread.value || togglingStatus.value) return
  togglingStatus.value = true
  const next = thread.value.conversation.status === 'open' ? 'closed' : 'open'
  try {
    const { message: sysMsg } = await $fetch<any>(`/api/conversations/${ticketId}/status`, {
      method: 'PATCH',
      body: { status: next },
    })
    thread.value.conversation.status = next
    if (sysMsg) thread.value.messages.push(sysMsg)
    nextTick(scrollToBottom)
  } finally {
    togglingStatus.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function deleteTicket() {
  if (deleting.value) return
  deleting.value = true
  try {
    await $fetch(`/api/conversations/${ticketId}`, { method: 'DELETE' })
    await navigateTo('/dashboard/tickets')
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/api/ws/messages`)
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.type === 'new_message' && data.message.conversationId === ticketId) {
        const msg: Message = data.message
        if (thread.value && !thread.value.messages.find(m => m.id === msg.id)) {
          thread.value.messages.push(msg)
          nextTick(scrollToBottom)
        }
        $fetch(`/api/conversations/${ticketId}/read`, { method: 'POST' })
      }
      if (data.type === 'status_changed' && data.conversationId === ticketId && thread.value) {
        thread.value.conversation.status = data.status
        if (data.message) thread.value.messages.push(data.message)
        nextTick(scrollToBottom)
      }
    } catch {}
  }
  ws.onclose = () => setTimeout(connectWs, 3000)
  ws.onerror = () => ws?.close()
}

onMounted(() => { fetchThread(); connectWs() })
onUnmounted(() => { ws?.close(); ws = null })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="max-w-3xl mx-auto flex flex-col gap-0" style="height: calc(100vh - 8rem)">

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col gap-4">
      <div class="h-8 w-48 rounded-lg bg-surface-100 dark:bg-surface-800 animate-pulse" />
      <div class="flex-1 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" style="height: 400px" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
      <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">Ticket not found</p>
      <NuxtLink to="/dashboard/tickets" class="text-sm text-amber-600 dark:text-amber-400 hover:underline">
        ← Back to tickets
      </NuxtLink>
    </div>

    <template v-else-if="thread">

      <!-- ── Header ──────────────────────────────────────────────────────────── -->
      <div class="shrink-0 flex flex-col gap-3 pb-4">
        <!-- Breadcrumb -->
        <NuxtLink
          to="/dashboard/tickets"
          class="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors self-start"
        >
          <svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Support Tickets
        </NuxtLink>

        <!-- Title row -->
        <div class="flex items-start gap-3 flex-wrap">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg font-bold text-surface-900 dark:text-surface-100 truncate">
                {{ thread.conversation.title }}
              </h1>
              <span
                class="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                :class="thread.conversation.status === 'open'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/60'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 ring-surface-200 dark:ring-surface-700'"
              >
                {{ thread.conversation.status === 'open' ? 'Open' : 'Closed' }}
              </span>
            </div>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              {{ thread.conversation.candidateName }}
              <span class="text-surface-400 dark:text-surface-500">· {{ thread.conversation.candidateEmail }}</span>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Status toggle -->
            <button
              type="button"
              :disabled="togglingStatus"
              class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              :class="thread.conversation.status === 'open'
                ? 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-danger-300 hover:text-danger-600 dark:hover:text-danger-400'
                : 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'"
              @click="toggleStatus"
            >
              <svg v-if="togglingStatus" class="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ thread.conversation.status === 'open' ? 'Close ticket' : 'Reopen' }}
            </button>

            <!-- Delete -->
            <template v-if="confirmDelete">
              <span class="text-xs text-surface-400">Delete?</span>
              <button
                type="button"
                :disabled="deleting"
                class="rounded-lg border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                @click="deleteTicket"
              >
                <svg v-if="deleting" class="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span v-else>Yes, delete</span>
              </button>
              <button
                type="button"
                class="rounded-lg border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                @click="confirmDelete = false"
              >
                Cancel
              </button>
            </template>
            <button
              v-else
              type="button"
              class="flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
              title="Delete ticket"
              @click="confirmDelete = true"
            >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Chat area ───────────────────────────────────────────────────────── -->
      <div class="flex flex-col flex-1 min-h-0 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden">

        <!-- Messages -->
        <div ref="msgListEl" class="flex flex-col flex-1 overflow-y-auto px-5 py-5 gap-4">
          <div
            v-for="msg in thread.messages"
            :key="msg.id"
            class="flex flex-col"
            :class="msg.senderType === 'admin' ? 'items-end' : msg.senderType === 'system' ? 'items-center' : 'items-start'"
          >
            <!-- System message -->
            <div v-if="msg.senderType === 'system'" class="text-xs text-surface-400 italic px-3 py-1">
              {{ msg.content }}
            </div>
            <!-- Regular message -->
            <template v-else>
              <div
                class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                :class="msg.senderType === 'admin'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-sm'"
              >
                {{ msg.content }}
              </div>
              <div class="flex items-center gap-1.5 mt-1 px-1">
                <span class="text-[11px] text-surface-400 font-medium">{{ msg.senderName }}</span>
                <span class="text-[11px] text-surface-300 dark:text-surface-600">·</span>
                <span class="text-[11px] text-surface-400">{{ formatDate(msg.createdAt) }}, {{ formatTime(msg.createdAt) }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Reply input -->
        <div class="shrink-0 border-t border-surface-100 dark:border-surface-800 px-4 py-3">
          <div
            v-if="thread.conversation.status === 'closed'"
            class="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-50 dark:bg-surface-800 text-sm text-surface-400"
          >
            <svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            This ticket is closed.
            <button
              type="button"
              class="text-green-600 dark:text-green-400 hover:underline font-medium cursor-pointer"
              @click="toggleStatus"
            >
              Reopen
            </button>
          </div>
          <div v-else class="flex gap-3">
            <textarea
              v-model="sendContent"
              rows="3"
              placeholder="Reply to this ticket…"
              class="flex-1 resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              @keydown="handleEnter"
            />
            <button
              type="button"
              :disabled="!sendContent.trim() || sending"
              class="flex items-center justify-center size-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shrink-0 self-end"
              title="Send (Enter)"
              @click="sendMessage"
            >
              <svg v-if="sending" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p class="text-[11px] text-surface-400 dark:text-surface-500 mt-1.5">Press <kbd class="font-mono bg-surface-100 dark:bg-surface-800 px-1 rounded">Enter</kbd> to send · <kbd class="font-mono bg-surface-100 dark:bg-surface-800 px-1 rounded">Shift+Enter</kbd> for new line</p>
        </div>

      </div>
    </template>

  </div>
</template>
