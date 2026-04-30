<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
})

// Candidates are only needed inside the "new conversation" modal — fetch lazily
// on the client so auth cookies are available (avoid SSR 401s).
const candidates = ref<{ id: string; firstName: string; lastName: string; email: string }[]>([])
const candidatesLoading = ref(false)
const candidatesLoaded = ref(false)

async function ensureCandidates() {
  if (candidatesLoaded.value || candidatesLoading.value) return
  candidatesLoading.value = true
  try {
    // schema enforces limit ≤ 100; fetch multiple pages if needed
    const pages = await Promise.all([1, 2, 3].map(page =>
      $fetch<{ data: typeof candidates.value }>('/api/candidates', { query: { limit: 100, page } })
    ))
    candidates.value = pages.flatMap(p => p.data ?? [])
    candidatesLoaded.value = true
  } catch (e) {
    console.error('[conversations] failed to load candidates:', e)
  } finally {
    candidatesLoading.value = false
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  id: string;
  type: 'task' | 'support' | 'chat';
  title: string;
  status: 'open' | 'closed';
  candidateId: string;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  candidateEmail: string | null;
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderType: 'candidate' | 'admin' | 'system';
  senderId: string | null;
  senderName: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ActiveThread {
  conversation: ConversationRow & { candidateName: string; candidateEmail: string };
  messages: Message[];
}

// ─── State ────────────────────────────────────────────────────────────────────

const conversations = ref<ConversationRow[]>([]);
const activeConvId = ref<string | null>(null);
const activeThread = ref<ActiveThread | null>(null);
const showThread = ref(false);

const loadingConvs = ref(true);
const loadingThread = ref(false);
const sendingMsg = ref(false);
const newMsgContent = ref('');

const filterType = ref<'' | 'task' | 'support' | 'chat'>('');
const filterStatus = ref<'' | 'open' | 'closed'>('open');

const showNewModal = ref(false);
const newCandidateId = ref('');
const newType = ref<'task' | 'support' | 'chat'>('task');
const newTitle = ref('');
const newMessage = ref('');
const creatingConv = ref(false);
const createError = ref('');

const confirmDeleteId = ref<string | null>(null);  // non-null = confirmation visible
const deletingConv = ref(false);

const msgListEl = ref<HTMLElement | null>(null);

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchConversations() {
  loadingConvs.value = true;
  try {
    const query: Record<string, string> = {};
    if (filterType.value) query.type = filterType.value;
    if (filterStatus.value) query.status = filterStatus.value;
    const data = await $fetch<ConversationRow[]>('/api/conversations', { query });
    conversations.value = data;
  } finally {
    loadingConvs.value = false;
  }
}

watch([filterType, filterStatus], fetchConversations);

async function openConversation(convId: string) {
  if (activeConvId.value === convId) { showThread.value = true; return; }
  activeConvId.value = convId;
  showThread.value = true;
  activeThread.value = null;
  loadingThread.value = true;
  newMsgContent.value = '';
  confirmDeleteId.value = null;
  try {
    const data = await $fetch<ActiveThread>(`/api/conversations/${convId}`);
    activeThread.value = data;
    await $fetch(`/api/conversations/${convId}/read`, { method: 'POST' });
    const c = conversations.value.find(x => x.id === convId);
    if (c) c.unreadCount = 0;
  } finally {
    loadingThread.value = false;
    nextTick(scrollToBottom);
  }
}

function scrollToBottom() {
  if (msgListEl.value) msgListEl.value.scrollTop = msgListEl.value.scrollHeight;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendMessage() {
  const content = newMsgContent.value.trim();
  if (!content || !activeConvId.value || sendingMsg.value) return;
  sendingMsg.value = true;
  try {
    const msg = await $fetch<Message>(`/api/conversations/${activeConvId.value}/send`, {
      method: 'POST',
      body: { content },
    });
    if (activeThread.value && !activeThread.value.messages.find(m => m.id === msg.id)) activeThread.value.messages.push(msg);
    newMsgContent.value = '';
    updateLastMessage(activeConvId.value, msg.content, msg.createdAt);
    nextTick(scrollToBottom);
  } finally {
    sendingMsg.value = false;
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function updateLastMessage(convId: string, content: string, at: string) {
  const c = conversations.value.find(x => x.id === convId);
  if (c) { c.lastMessage = content; c.lastMessageAt = at; c.updatedAt = at; }
  conversations.value.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// ─── Status toggle ────────────────────────────────────────────────────────────

async function toggleStatus() {
  if (!activeThread.value) return;
  const current = activeThread.value.conversation.status;
  const next = current === 'open' ? 'closed' : 'open';
  const { message: sysMsg } = await $fetch<any>(`/api/conversations/${activeConvId.value}/status`, {
    method: 'PATCH',
    body: { status: next },
  });
  activeThread.value.conversation.status = next;
  if (sysMsg) activeThread.value.messages.push(sysMsg);
  const c = conversations.value.find(x => x.id === activeConvId.value);
  if (c) c.status = next;
  nextTick(scrollToBottom);
}

// ─── Delete conversation ──────────────────────────────────────────────────────

async function deleteConversation() {
  const id = confirmDeleteId.value;
  if (!id || deletingConv.value) return;
  deletingConv.value = true;
  try {
    await $fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    conversations.value = conversations.value.filter(c => c.id !== id);
    if (activeConvId.value === id) {
      activeConvId.value = null;
      activeThread.value = null;
      showThread.value = false;
    }
  } finally {
    deletingConv.value = false;
    confirmDeleteId.value = null;
  }
}

// ─── New conversation ─────────────────────────────────────────────────────────

async function createConversation() {
  if (!newCandidateId.value || !newTitle.value.trim() || !newMessage.value.trim()) return;
  creatingConv.value = true;
  createError.value = '';
  try {
    const { id } = await $fetch<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: {
        candidateId: newCandidateId.value,
        type: newType.value,
        title: newTitle.value.trim(),
        initialMessage: newMessage.value.trim(),
      },
    });
    showNewModal.value = false;
    await fetchConversations();
    await openConversation(id);
  } catch (e: any) {
    createError.value = e?.data?.statusMessage ?? 'Failed to create.';
  } finally {
    creatingConv.value = false;
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/ws/messages`);
  ws.onmessage = (e) => {
    try { handleWsEvent(JSON.parse(e.data)); } catch {}
  };
  ws.onclose = () => setTimeout(connectWs, 3000);
  ws.onerror = () => ws?.close();
}

function handleWsEvent(data: any) {
  if (data.type === 'new_message') {
    const msg: Message = data.message;
    if (msg.conversationId === activeConvId.value) {
      if (activeThread.value && !activeThread.value.messages.find(m => m.id === msg.id)) {
        activeThread.value.messages.push(msg);
        nextTick(scrollToBottom);
      }
      $fetch(`/api/conversations/${msg.conversationId}/read`, { method: 'POST' });
    } else {
      const c = conversations.value.find(x => x.id === msg.conversationId);
      if (c && msg.senderType === 'candidate') c.unreadCount++;
    }
    updateLastMessage(msg.conversationId, msg.content, msg.createdAt);
  }
  if (data.type === 'new_conversation') {
    ws?.send(JSON.stringify({ type: 'subscribe_conv', conversationId: data.conversation.id }));
    fetchConversations();
  }
  if (data.type === 'conversation_deleted') {
    conversations.value = conversations.value.filter(c => c.id !== data.conversationId);
    if (activeConvId.value === data.conversationId) {
      activeConvId.value = null;
      activeThread.value = null;
      showThread.value = false;
    }
  }
  if (data.type === 'status_changed' && activeThread.value && data.conversationId === activeConvId.value) {
    activeThread.value.conversation.status = data.status;
    if (data.message) activeThread.value.messages.push(data.message);
    const c = conversations.value.find(x => x.id === data.conversationId);
    if (c) c.status = data.status;
    nextTick(scrollToBottom);
  }
}

onMounted(() => { fetchConversations(); connectWs(); });
onUnmounted(() => { ws?.close(); ws = null; });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = { task: 'Task', support: 'Support', chat: 'Chat' };
const typeBg: Record<string, string> = {
  task: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  support: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  chat: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
};
function relativeTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
const candidateOptions = computed(() =>
  candidates.value.map(c => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName} — ${c.email}`,
  }))
);
</script>

<template>
  <div class="flex flex-col gap-4 h-[calc(100vh-8rem)]">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 justify-between shrink-0">
      <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Conversations</h1>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Filters -->
        <select
          v-model="filterType"
          class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-1.5 text-sm text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All types</option>
          <option value="task">Task</option>
          <option value="support">Support</option>
          <option value="chat">Chat</option>
        </select>
        <select
          v-model="filterStatus"
          class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-1.5 text-sm text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          @click="showNewModal = true; ensureCandidates()"
        >
          <svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New conversation
        </button>
      </div>
    </div>

    <!-- Two-panel -->
    <div class="flex flex-1 min-h-0 rounded-2xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm bg-white dark:bg-surface-900">

      <!-- Left: list -->
      <aside
        class="flex flex-col w-full sm:w-80 flex-shrink-0 border-r border-surface-100 dark:border-surface-800 overflow-y-auto"
        :class="showThread ? 'hidden sm:flex' : 'flex'"
      >
        <div v-if="loadingConvs" class="flex flex-col gap-2 p-3">
          <div v-for="i in 4" :key="i" class="h-16 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
        </div>
        <div v-else-if="conversations.length === 0" class="flex items-center justify-center flex-1 p-6 text-sm text-surface-400">
          No conversations found.
        </div>
        <ul v-else class="divide-y divide-surface-100 dark:divide-surface-800">
          <li
            v-for="conv in conversations"
            :key="conv.id"
            class="flex flex-col px-4 py-3 gap-1 cursor-pointer transition-colors"
            :class="activeConvId === conv.id
              ? 'bg-brand-50 dark:bg-brand-950/30'
              : 'hover:bg-surface-50 dark:hover:bg-surface-800/60'"
            @click="openConversation(conv.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold rounded-full px-2 py-0.5" :class="typeBg[conv.type]">{{ typeLabel[conv.type] }}</span>
                <span v-if="conv.status === 'closed'" class="text-xs bg-surface-100 dark:bg-surface-800 text-surface-500 rounded-full px-2 py-0.5">Closed</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span v-if="conv.unreadCount > 0" class="flex items-center justify-center size-4 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                  {{ conv.unreadCount > 9 ? '9+' : conv.unreadCount }}
                </span>
                <span class="text-xs text-surface-400">{{ relativeTime(conv.lastMessageAt ?? conv.updatedAt) }}</span>
              </div>
            </div>
            <p class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate leading-snug">{{ conv.title }}</p>
            <p class="text-xs text-surface-500 dark:text-surface-400 truncate">
              {{ conv.candidateFirstName }} {{ conv.candidateLastName }}
            </p>
            <p class="text-xs text-surface-400 truncate">{{ conv.lastMessage ?? 'No messages yet' }}</p>
          </li>
        </ul>
      </aside>

      <!-- Right: thread -->
      <div class="flex flex-col flex-1 min-w-0" :class="showThread ? 'flex' : 'hidden sm:flex'">
        <div v-if="!activeConvId" class="flex flex-col items-center justify-center flex-1 gap-3 text-center p-8">
          <p class="text-sm text-surface-400">Select a conversation to view messages</p>
        </div>

        <template v-else>
          <!-- Thread header -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-100 dark:border-surface-800 shrink-0">
            <button
              type="button"
              class="sm:hidden flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 transition-colors"
              @click="showThread = false"
            >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="activeThread" class="text-xs font-semibold rounded-full px-2 py-0.5" :class="typeBg[activeThread.conversation.type]">
                  {{ typeLabel[activeThread.conversation.type] }}
                </span>
                <span v-if="activeThread?.conversation.status === 'closed'" class="text-xs bg-surface-100 dark:bg-surface-800 text-surface-500 rounded-full px-2 py-0.5">Closed</span>
              </div>
              <p class="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate mt-0.5">
                {{ activeThread?.conversation.title }}
              </p>
              <p class="text-xs text-surface-400 truncate">{{ activeThread?.conversation.candidateName }} · {{ activeThread?.conversation.candidateEmail }}</p>
            </div>
            <!-- Status toggle -->
            <button
              v-if="activeThread"
              type="button"
              class="shrink-0 text-xs rounded-lg border px-3 py-1.5 font-medium transition-colors cursor-pointer"
              :class="activeThread.conversation.status === 'open'
                ? 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-danger-300 hover:text-danger-600 dark:hover:text-danger-400'
                : 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30'"
              @click="toggleStatus"
            >
              {{ activeThread.conversation.status === 'open' ? 'Close' : 'Reopen' }}
            </button>

            <!-- Delete button / inline confirm -->
            <template v-if="activeThread">
              <div v-if="confirmDeleteId === activeConvId" class="flex items-center gap-1.5 shrink-0">
                <span class="text-xs text-surface-500 dark:text-surface-400">Delete?</span>
                <button
                  type="button"
                  :disabled="deletingConv"
                  class="text-xs rounded-lg border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 px-2.5 py-1.5 font-medium transition-colors cursor-pointer disabled:opacity-50"
                  @click="deleteConversation"
                >
                  <svg v-if="deletingConv" class="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span v-else>Yes, delete</span>
                </button>
                <button
                  type="button"
                  class="text-xs rounded-lg border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 px-2.5 py-1.5 font-medium transition-colors cursor-pointer"
                  @click="confirmDeleteId = null"
                >
                  Cancel
                </button>
              </div>
              <button
                v-else
                type="button"
                class="shrink-0 flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
                title="Delete conversation"
                @click="confirmDeleteId = activeConvId"
              >
                <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>

          <!-- Messages -->
          <div ref="msgListEl" class="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-3">
            <div v-if="loadingThread" class="flex items-center justify-center flex-1">
              <svg class="size-5 text-surface-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <template v-else-if="activeThread">
              <div
                v-for="msg in activeThread.messages"
                :key="msg.id"
                class="flex flex-col"
                :class="msg.senderType === 'admin' ? 'items-end' : msg.senderType === 'system' ? 'items-center' : 'items-start'"
              >
                <div v-if="msg.senderType === 'system'" class="text-xs text-surface-400 italic px-3 py-1">
                  {{ msg.content }}
                </div>
                <template v-else>
                  <div
                    class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                    :class="msg.senderType === 'admin'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-bl-sm'"
                  >
                    {{ msg.content }}
                  </div>
                  <div class="flex items-center gap-1.5 mt-0.5 px-1">
                    <span class="text-[10px] text-surface-400">{{ msg.senderName }}</span>
                    <span class="text-[10px] text-surface-300 dark:text-surface-600">·</span>
                    <span class="text-[10px] text-surface-400">{{ formatTime(msg.createdAt) }}</span>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- Input -->
          <div class="shrink-0 px-4 pb-4 pt-2 border-t border-surface-100 dark:border-surface-800">
            <div v-if="activeThread?.conversation.status === 'closed'" class="flex items-center justify-center py-3 rounded-xl bg-surface-50 dark:bg-surface-800 text-sm text-surface-400">
              This conversation is closed.
            </div>
            <div v-else class="flex gap-2">
              <textarea
                v-model="newMsgContent"
                rows="2"
                placeholder="Reply…"
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
        </template>
      </div>
    </div>

    <!-- New conversation modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNewModal"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          @click.self="showNewModal = false"
        >
          <div class="w-full sm:max-w-lg rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden">
            <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <p class="text-base font-semibold text-surface-900 dark:text-surface-100">New Conversation</p>
              <button type="button" class="text-surface-400 hover:text-surface-700 transition-colors cursor-pointer" @click="showNewModal = false">
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
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                >
                  <option value="">{{ candidatesLoading ? 'Loading candidates…' : 'Select a candidate…' }}</option>
                  <option v-for="opt in candidateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>

              <!-- Type -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-2">Type</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="opt in (['task', 'chat'] as const)"
                    :key="opt"
                    type="button"
                    class="rounded-xl border-2 py-2 text-sm font-medium transition-colors cursor-pointer"
                    :class="newType === opt
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'"
                    @click="newType = opt"
                  >
                    {{ typeLabel[opt] }}
                  </button>
                </div>
              </div>

              <!-- Title -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Subject</label>
                <input
                  v-model="newTitle"
                  type="text"
                  maxlength="200"
                  placeholder="e.g. Please complete your onboarding documents"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <!-- Message -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Opening message</label>
                <textarea
                  v-model="newMessage"
                  rows="3"
                  maxlength="5000"
                  placeholder="Hi! I wanted to follow up on…"
                  class="w-full resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div v-if="createError" class="text-xs text-danger-600 dark:text-danger-400">{{ createError }}</div>

              <button
                type="button"
                :disabled="!newCandidateId || !newTitle.trim() || !newMessage.trim() || creatingConv"
                class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-semibold transition-colors cursor-pointer"
                @click="createConversation"
              >
                <svg v-if="creatingConv" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ creatingConv ? 'Creating…' : 'Start Conversation' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
