<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

interface Ticket {
  id: string
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

// ─── Candidates for new-ticket form ──────────────────────────────────────────

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
    console.error('[tickets] failed to load candidates:', e)
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

// ─── Tickets list ─────────────────────────────────────────────────────────────

const tickets = ref<Ticket[]>([])
const loading = ref(true)
const filterStatus = ref<'' | 'open' | 'closed'>('open')

async function fetchTickets() {
  loading.value = true
  try {
    const query: Record<string, string> = { type: 'support' }
    if (filterStatus.value) query.status = filterStatus.value
    tickets.value = await $fetch<Ticket[]>('/api/conversations', { query })
  } finally {
    loading.value = false
  }
}

watch(filterStatus, fetchTickets)

// ─── New ticket form ──────────────────────────────────────────────────────────

const showForm = ref(false)
const newCandidateId = ref('')
const newSubject = ref('')
const newMessage = ref('')
const creating = ref(false)
const createError = ref('')

function openForm() {
  showForm.value = true
  newCandidateId.value = ''
  newSubject.value = ''
  newMessage.value = ''
  createError.value = ''
  ensureCandidates()
}

async function createTicket() {
  if (!newCandidateId.value || !newSubject.value.trim() || !newMessage.value.trim()) return
  creating.value = true
  createError.value = ''
  try {
    const { id } = await $fetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: {
        candidateId: newCandidateId.value,
        type: 'support',
        title: newSubject.value.trim(),
        initialMessage: newMessage.value.trim(),
      },
    })
    showForm.value = false
    await navigateTo(`/dashboard/tickets/${id}`)
  } catch (e: any) {
    createError.value = e?.data?.statusMessage ?? 'Failed to create ticket.'
  } finally {
    creating.value = false
  }
}

// ─── WebSocket — keep unread counts live ─────────────────────────────────────

let ws: WebSocket | null = null

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/api/ws/messages`)
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.type === 'new_message') {
        const t = tickets.value.find(x => x.id === data.message.conversationId)
        if (t && data.message.senderType === 'candidate') {
          t.unreadCount++
          t.lastMessage = data.message.content
          t.lastMessageAt = data.message.createdAt
          t.updatedAt = data.message.createdAt
          tickets.value.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        }
      }
      if (data.type === 'new_conversation' && data.conversation?.type === 'support') {
        fetchTickets()
      }
    } catch {}
  }
  ws.onclose = () => setTimeout(connectWs, 3000)
  ws.onerror = () => ws?.close()
}

onMounted(() => { fetchTickets(); connectWs() })
onUnmounted(() => { ws?.close(); ws = null })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso), diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const totalUnread = computed(() => tickets.value.reduce((s, t) => s + t.unreadCount, 0))
</script>

<template>
  <div class="max-w-4xl mx-auto flex flex-col gap-6">

    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div>
        <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2.5">
          Support Tickets
          <span
            v-if="totalUnread > 0"
            class="inline-flex items-center justify-center min-w-[1.375rem] h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 leading-none"
          >
            {{ totalUnread > 99 ? '99+' : totalUnread }}
          </span>
        </h1>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Support conversations with candidates</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Status filter -->
        <select
          v-model="filterStatus"
          class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-1.5 text-sm text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <!-- New ticket -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          @click="openForm"
        >
          <svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New ticket
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div v-for="i in 4" :key="i" class="h-24 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="tickets.length === 0"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 py-16 px-8 text-center gap-3"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
        <svg class="size-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 00-1.652 1.306A9.025 9.025 0 004.33 7.288" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">No support tickets</p>
        <p class="text-sm text-surface-400 dark:text-surface-500 mt-0.5">
          {{ filterStatus === 'open' ? 'No open tickets — all caught up!' : 'No tickets match this filter.' }}
        </p>
      </div>
      <button
        type="button"
        class="mt-1 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
        @click="openForm"
      >
        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Create first ticket
      </button>
    </div>

    <!-- Ticket cards -->
    <div v-else class="flex flex-col gap-3">
      <NuxtLink
        v-for="ticket in tickets"
        :key="ticket.id"
        :to="`/dashboard/tickets/${ticket.id}`"
        class="group flex items-start gap-4 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md hover:shadow-amber-500/5 transition-all px-5 py-4 no-underline"
      >
        <!-- Left accent + unread dot -->
        <div class="flex flex-col items-center gap-2 shrink-0 pt-0.5">
          <div class="w-1 h-10 rounded-full" :class="ticket.status === 'open' ? 'bg-amber-400' : 'bg-surface-300 dark:bg-surface-600'" />
        </div>

        <!-- Main content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-surface-900 dark:text-surface-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors truncate">
                  {{ ticket.title }}
                </p>
                <span
                  v-if="ticket.unreadCount > 0"
                  class="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 leading-none"
                >
                  {{ ticket.unreadCount > 9 ? '9+' : ticket.unreadCount }}
                </span>
              </div>
              <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                {{ ticket.candidateFirstName }} {{ ticket.candidateLastName }}
                <span v-if="ticket.candidateEmail" class="text-surface-400 dark:text-surface-500">· {{ ticket.candidateEmail }}</span>
              </p>
            </div>
            <!-- Right meta -->
            <div class="shrink-0 flex flex-col items-end gap-1.5">
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ring-1 ring-inset"
                :class="ticket.status === 'open'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/60'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 ring-surface-200 dark:ring-surface-700'"
              >
                {{ ticket.status === 'open' ? 'Open' : 'Closed' }}
              </span>
              <span class="text-[11px] text-surface-400 dark:text-surface-500">
                {{ relativeTime(ticket.lastMessageAt ?? ticket.updatedAt) }}
              </span>
            </div>
          </div>

          <!-- Last message preview -->
          <p class="text-xs text-surface-400 dark:text-surface-500 mt-2 line-clamp-1">
            {{ ticket.lastMessage ?? 'No messages yet' }}
          </p>
        </div>

        <!-- Chevron -->
        <svg class="size-4 shrink-0 text-surface-300 dark:text-surface-600 group-hover:text-amber-400 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>
    </div>

  </div>

  <!-- New ticket modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showForm = false"
      >
        <div class="w-full sm:max-w-lg rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
            <p class="text-base font-semibold text-surface-900 dark:text-surface-100">New Support Ticket</p>
            <button type="button" class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors cursor-pointer" @click="showForm = false">
              <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="px-5 py-4 flex flex-col gap-4">
            <!-- Candidate -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Candidate</label>
              <select
                v-model="newCandidateId"
                :disabled="candidatesLoading"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              >
                <option value="">{{ candidatesLoading ? 'Loading candidates…' : 'Select a candidate…' }}</option>
                <option v-for="opt in candidateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <!-- Subject -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Subject</label>
              <input
                v-model="newSubject"
                type="text"
                maxlength="200"
                placeholder="e.g. Issue with document upload"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <!-- Message -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Opening message</label>
              <textarea
                v-model="newMessage"
                rows="3"
                maxlength="5000"
                placeholder="Describe the issue…"
                class="w-full resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div v-if="createError" class="text-xs text-danger-600 dark:text-danger-400">{{ createError }}</div>
            <button
              type="button"
              :disabled="!newCandidateId || !newSubject.trim() || !newMessage.trim() || creating"
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-semibold transition-colors cursor-pointer"
              @click="createTicket"
            >
              <svg v-if="creating" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ creating ? 'Creating…' : 'Create Ticket' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
