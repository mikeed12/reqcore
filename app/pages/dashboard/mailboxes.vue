<script setup lang="ts">
import {
  Mail, RefreshCw, ChevronLeft, ChevronRight, SquarePen,
  Inbox, SendHorizonal, FileText, Trash2, ShieldAlert,
  Search, X, AlertCircle, Loader2, Settings, Pencil, Check,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard',
  middleware: ['auth', 'require-org'],
  fullBleed: true,
})

useHead({ title: 'Mailboxes' })

// ─── Types ────────────────────────────────────────────────────────────────────

interface Mailbox {
  id: string
  label: string
  email: string
  provider: 'imap' | 'gmail' | 'microsoft'
  isActive: boolean
  lastSyncAt: string | null
  syncError: string | null
  imapHost: string | null
  imapPort: number | null
  imapTls: boolean | null
  smtpHost: string | null
  smtpPort: number | null
  smtpTls: boolean | null
  hasPassword: boolean
}

interface MailMessage {
  id: string
  uid: number
  folder: string
  fromName: string | null
  fromEmail: string | null
  subject: string | null
  sentAt: string | null
  isRead: boolean
  isFlagged: boolean
  organizationMailboxId: string
}

interface MailMessageDetail extends MailMessage {
  toJson: string | null
  ccJson: string | null
  bodyText: string | null
  bodyHtml: string | null
  messageId: string | null
}

interface FolderCount {
  mailboxId: string
  folder: string
  total: number
  unread: number
}

// ─── Session ──────────────────────────────────────────────────────────────────

const { data: session } = await authClient.useSession(useFetch)
const currentUserId = computed(() => session.value?.user?.id)

// ─── Mailboxes ────────────────────────────────────────────────────────────────

const mailboxes = ref<Mailbox[]>([])
const mailboxesLoading = ref(true)

async function loadMailboxes() {
  try {
    const all = await $fetch<Array<Mailbox & { assignments: { userId: string }[] }>>('/api/mailboxes')
    mailboxes.value = all.filter(mb =>
      mb.assignments.some(a => a.userId === currentUserId.value)
    )
  } catch (e) {
    console.error('[mailboxes] failed to load mailboxes:', e)
  } finally {
    mailboxesLoading.value = false
  }
}

onMounted(loadMailboxes)

// ─── Selected mailbox & folder ────────────────────────────────────────────────

const selectedMailboxId = ref<string | null>(null)
const selectedFolder = ref('INBOX')
const folders = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM']

watch(mailboxes, (mbs) => {
  if (mbs.length && !selectedMailboxId.value) selectedMailboxId.value = mbs[0]!.id
}, { immediate: true })

// ─── Folder counts ────────────────────────────────────────────────────────────

const folderCounts = ref<FolderCount[]>([])

async function loadFolderCounts() {
  try {
    folderCounts.value = await $fetch<FolderCount[]>('/api/mail/folders')
  } catch {}
}

onMounted(loadFolderCounts)

function folderCount(mailboxId: string, folder: string): FolderCount | undefined {
  return folderCounts.value.find(c => c.mailboxId === mailboxId && c.folder === folder)
}

// ─── Message list ─────────────────────────────────────────────────────────────

const messages = ref<MailMessage[]>([])
const messagesLoading = ref(false)
const messagesTotal = ref(0)
const page = ref(1)
const limit = 30
const search = ref('')
const searchDebounced = ref('')
const selectedMsgId = ref<string | null>(null)
const selectedMsg = ref<MailMessageDetail | null>(null)
const msgLoading = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchDebounced.value = val }, 300)
})

async function loadMessages() {
  if (!selectedMailboxId.value) return
  messagesLoading.value = true
  try {
    const data = await $fetch<{ data: MailMessage[]; total: number }>('/api/mail/messages', {
      query: { mailboxId: selectedMailboxId.value, folder: selectedFolder.value, page: page.value, limit },
    })
    messages.value = data.data ?? []
    messagesTotal.value = data.total ?? 0
  } catch (e) {
    console.error('[mailboxes] failed to load messages:', e)
  } finally {
    messagesLoading.value = false
  }
}

watch(selectedMailboxId, () => { page.value = 1; selectedMsgId.value = null; loadMessages() }, { immediate: true })
watch([selectedFolder, page], () => { loadMessages() })
watch(searchDebounced, () => { page.value = 1 })

const totalPages = computed(() => Math.max(1, Math.ceil(messagesTotal.value / limit)))

const filteredMessages = computed(() => {
  const q = searchDebounced.value.toLowerCase().trim()
  if (!q) return messages.value
  return messages.value.filter(m =>
    (m.subject ?? '').toLowerCase().includes(q) ||
    (m.fromName ?? '').toLowerCase().includes(q) ||
    (m.fromEmail ?? '').toLowerCase().includes(q),
  )
})

async function selectMessage(id: string) {
  if (selectedMsgId.value === id) return
  selectedMsgId.value = id
  msgLoading.value = true
  selectedMsg.value = null
  try {
    selectedMsg.value = await $fetch<MailMessageDetail>(`/api/mail/messages/${id}`)
    const m = messages.value.find(m => m.id === id)
    if (m) m.isRead = true
    // refresh unread counts
    loadFolderCounts()
  } catch (e) {
    console.error('[mailboxes] failed to load message:', e)
  } finally {
    msgLoading.value = false
  }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

const syncing = ref(false)
const syncResult = ref<string | null>(null)

async function syncMail() {
  syncing.value = true
  syncResult.value = null
  try {
    const data = await $fetch<{ results: { synced: number; error?: string }[] }>('/api/mail/sync', {
      method: 'POST',
      body: selectedMailboxId.value ? { mailboxId: selectedMailboxId.value } : {},
    })
    const total = data.results.reduce((s, r) => s + (r.synced ?? 0), 0)
    const errors = data.results.filter(r => r.error).length
    syncResult.value = errors
      ? `Synced ${total} message(s). ${errors} error(s).`
      : total > 0 ? `${total} new message(s) synced.` : 'Already up to date.'
    await Promise.all([loadMessages(), loadMailboxes(), loadFolderCounts()])
  } catch (e: any) {
    syncResult.value = 'Sync failed: ' + (e?.data?.statusMessage ?? e?.message ?? 'Unknown error')
  } finally {
    syncing.value = false
    setTimeout(() => { syncResult.value = null }, 5000)
  }
}

// ─── Compose (global floating panel) ─────────────────────────────────────────

const { open: openMailCompose } = useMailCompose()

function openCompose(replyTo?: MailMessageDetail) {
  if (replyTo) {
    openMailCompose({
      mailboxId:  selectedMailboxId.value ?? undefined,
      to:         replyTo.fromEmail ?? '',
      subject:    replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject ?? ''}`,
      inReplyTo:  replyTo.messageId ?? undefined,
      references: replyTo.messageId ?? undefined,
    })
  } else {
    openMailCompose({ mailboxId: selectedMailboxId.value ?? undefined })
  }
}

// ─── Edit mailbox ─────────────────────────────────────────────────────────────

const showEditMailbox = ref(false)
const editingMailbox = ref<Mailbox | null>(null)
const editLabel = ref('')
const editImapHost = ref('')
const editImapPort = ref<number | null>(null)
const editImapTls = ref(true)
const editSmtpHost = ref('')
const editSmtpPort = ref<number | null>(null)
const editSmtpTls = ref(false)
const editPassword = ref('')
const editSaving = ref(false)
const editError = ref('')

function openEditMailbox(mb: Mailbox) {
  editingMailbox.value = mb
  editLabel.value = mb.label
  editImapHost.value = mb.imapHost ?? ''
  editImapPort.value = mb.imapPort ?? null
  editImapTls.value = mb.imapTls ?? true
  editSmtpHost.value = mb.smtpHost ?? ''
  editSmtpPort.value = mb.smtpPort ?? null
  editSmtpTls.value = mb.smtpTls ?? false
  editPassword.value = ''
  editError.value = ''
  showEditMailbox.value = true
}

async function saveMailbox() {
  if (!editingMailbox.value) return
  editSaving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/mailboxes/${editingMailbox.value.id}`, {
      method: 'PATCH',
      body: {
        label:    editLabel.value || undefined,
        imapHost: editImapHost.value || null,
        imapPort: editImapPort.value ?? null,
        imapTls:  editImapTls.value,
        smtpHost: editSmtpHost.value || null,
        smtpPort: editSmtpPort.value ?? null,
        smtpTls:  editSmtpTls.value,
        ...(editPassword.value ? { password: editPassword.value } : {}),
      },
    })
    showEditMailbox.value = false
    await loadMailboxes()
  } catch (e: any) {
    editError.value = e?.data?.statusMessage ?? e?.message ?? 'Failed to save'
  } finally {
    editSaving.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const folderMeta: Record<string, { icon: typeof Inbox; label: string }> = {
  INBOX:  { icon: Inbox,         label: 'Inbox'  },
  SENT:   { icon: SendHorizonal, label: 'Sent'   },
  DRAFTS: { icon: FileText,      label: 'Drafts' },
  TRASH:  { icon: Trash2,        label: 'Trash'  },
  SPAM:   { icon: ShieldAlert,   label: 'Spam'   },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateFull(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    return (parts[0] ?? '').slice(0, 2).toUpperCase()
  }
  return (email ?? '?').slice(0, 2).toUpperCase()
}

const avatarColors = ['bg-brand-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500']
function avatarBg(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
  return avatarColors[h % avatarColors.length]!
}

const parsedTo = computed<{ name?: string; email: string }[]>(() => {
  if (!selectedMsg.value?.toJson) return []
  try { return JSON.parse(selectedMsg.value.toJson) } catch { return [] }
})
const parsedCc = computed<{ name?: string; email: string }[]>(() => {
  if (!selectedMsg.value?.ccJson) return []
  try { return JSON.parse(selectedMsg.value.ccJson) } catch { return [] }
})

const showViewer = ref(false)
function openMsg(id: string) { selectMessage(id); showViewer.value = true }
function closeViewer() { showViewer.value = false }
</script>

<template>
  <div class="flex flex-1 min-h-0 overflow-hidden bg-surface-50 dark:bg-surface-950">

    <!-- ── Left sidebar ───────────────────────────────────────────────── -->
    <aside class="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">

      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-3 border-b border-surface-100 dark:border-surface-800">
        <div class="flex items-center gap-2">
          <div class="flex items-center justify-center size-6 rounded-md bg-brand-600 text-white shrink-0">
            <Mail class="size-3.5" />
          </div>
          <span class="text-sm font-semibold text-surface-900 dark:text-surface-100">Mail</span>
        </div>
        <div class="flex items-center gap-0.5">
          <button
            class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer border-0 bg-transparent disabled:opacity-40"
            :disabled="syncing" :title="syncing ? 'Syncing…' : 'Sync mail'"
            @click="syncMail"
          >
            <RefreshCw class="size-3.5" :class="syncing && 'animate-spin'" />
          </button>
          <NuxtLink
            to="/dashboard/settings/mailboxes"
            class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all no-underline"
            title="Mailbox settings"
          >
            <Settings class="size-3.5" />
          </NuxtLink>
        </div>
      </div>

      <!-- Compose button -->
      <div class="px-3 py-2.5 border-b border-surface-100 dark:border-surface-800">
        <button
          class="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold transition-colors cursor-pointer border-0 shadow-sm shadow-brand-600/20"
          @click="openCompose()"
        >
          <SquarePen class="size-3.5 shrink-0" />
          Compose
        </button>
      </div>

      <!-- Sync feedback -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="syncResult" class="px-3 py-2 border-b border-surface-100 dark:border-surface-800 bg-brand-50 dark:bg-brand-950/30">
          <p class="text-[11px] text-brand-700 dark:text-brand-300 leading-snug">{{ syncResult }}</p>
        </div>
      </Transition>

      <!-- Account + folder list -->
      <div class="flex-1 overflow-y-auto py-1">
        <div v-if="mailboxesLoading" class="flex justify-center py-8">
          <Loader2 class="size-4 animate-spin text-surface-300 dark:text-surface-600" />
        </div>

        <template v-else-if="mailboxes.length">
          <div v-for="mb in mailboxes" :key="mb.id" class="mb-1">
            <!-- Account row -->
            <div class="group/acct flex items-center gap-2 px-3 py-1.5">
              <div
                class="flex items-center justify-center size-6 rounded-full text-white text-[9px] font-bold shrink-0"
                :class="avatarBg(mb.email)"
              >
                {{ mb.email.slice(0, 2).toUpperCase() }}
              </div>
              <button
                class="flex-1 min-w-0 text-left cursor-pointer border-0 bg-transparent p-0"
                @click="selectedMailboxId = mb.id"
              >
                <p
                  class="text-[12px] font-semibold truncate transition-colors"
                  :class="selectedMailboxId === mb.id
                    ? 'text-surface-900 dark:text-surface-100'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'"
                >
                  {{ mb.label || mb.email }}
                </p>
              </button>
              <div class="flex items-center gap-0.5 opacity-0 group-hover/acct:opacity-100 transition-opacity">
                <button
                  class="flex items-center justify-center size-5 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer border-0 bg-transparent transition-colors"
                  title="Edit mailbox"
                  @click="openEditMailbox(mb)"
                >
                  <Pencil class="size-3" />
                </button>
                <AlertCircle v-if="mb.syncError" class="size-3.5 text-rose-400" :title="mb.syncError" />
              </div>
            </div>

            <!-- Folders -->
            <div v-if="selectedMailboxId === mb.id">
              <button
                v-for="f in folders"
                :key="f"
                class="flex items-center gap-2 w-full pl-11 pr-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer border-0 bg-transparent text-left"
                :class="selectedFolder === f
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40'
                  : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-100 hover:bg-surface-50 dark:hover:bg-surface-800/60'"
                @click="selectedFolder = f; page = 1; loadMessages()"
              >
                <component :is="folderMeta[f]?.icon ?? Inbox" class="size-3.5 shrink-0 opacity-60" />
                <span class="flex-1">{{ folderMeta[f]?.label ?? f }}</span>
                <!-- Unread badge -->
                <span
                  v-if="folderCount(mb.id, f)?.unread"
                  class="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] rounded-full text-[10px] font-bold px-1 leading-none"
                  :class="selectedFolder === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300'"
                >
                  {{ folderCount(mb.id, f)!.unread }}
                </span>
              </button>
            </div>
          </div>
        </template>

        <div v-else class="px-4 py-8 text-center">
          <div class="flex items-center justify-center size-10 rounded-full bg-surface-100 dark:bg-surface-800 mx-auto mb-3">
            <Mail class="size-5 text-surface-400" />
          </div>
          <p class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">No mailboxes assigned</p>
          <NuxtLink
            to="/dashboard/settings/mailboxes"
            class="inline-flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline no-underline"
          >
            <Settings class="size-3" /> Configure in Settings
          </NuxtLink>
        </div>
      </div>
    </aside>

    <!-- ── Middle: message list ───────────────────────────────────────── -->
    <div
      class="flex flex-col border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
      :class="[showViewer ? 'hidden lg:flex' : 'flex', 'w-full lg:w-80 xl:w-96 shrink-0']"
    >
      <!-- Toolbar -->
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-surface-100 dark:border-surface-800">
        <select v-model="selectedMailboxId" class="lg:hidden flex-1 min-w-0 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-xs text-surface-700 dark:text-surface-300 focus:outline-none">
          <option v-for="mb in mailboxes" :key="mb.id" :value="mb.id">{{ mb.label || mb.email }}</option>
        </select>
        <select v-model="selectedFolder" class="lg:hidden rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-2 py-1.5 text-xs text-surface-700 dark:text-surface-300 focus:outline-none" @change="page = 1; loadMessages()">
          <option v-for="f in folders" :key="f" :value="f">{{ folderMeta[f]?.label ?? f }}</option>
        </select>
        <div class="relative flex-1 min-w-0">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-surface-400 pointer-events-none" />
          <input
            v-model="search" type="text" placeholder="Search…"
            class="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-400 dark:focus:border-brand-600 transition-colors"
          />
          <button v-if="search" class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer border-0 bg-transparent p-0" @click="search = ''">
            <X class="size-3" />
          </button>
        </div>
        <button class="lg:hidden flex items-center justify-center size-7 rounded-lg text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer border-0 bg-transparent disabled:opacity-40" :disabled="syncing" @click="syncMail">
          <RefreshCw class="size-3.5" :class="syncing && 'animate-spin'" />
        </button>
      </div>

      <!-- Folder bar -->
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-surface-100 dark:border-surface-800/60">
        <div class="flex items-center gap-1.5">
          <component :is="folderMeta[selectedFolder]?.icon ?? Inbox" class="size-3.5 text-surface-400" />
          <span class="text-[12px] font-semibold text-surface-700 dark:text-surface-300">{{ folderMeta[selectedFolder]?.label ?? selectedFolder }}</span>
          <span class="text-[11px] text-surface-400 dark:text-surface-500">· {{ messagesTotal }}</span>
        </div>
        <div class="flex items-center gap-0.5">
          <button class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-0 bg-transparent transition-colors" :disabled="page <= 1" @click="page--">
            <ChevronLeft class="size-3.5" />
          </button>
          <span class="text-[11px] text-surface-400 px-1">{{ page }}/{{ totalPages }}</span>
          <button class="flex items-center justify-center size-6 rounded-md text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-0 bg-transparent transition-colors" :disabled="page >= totalPages" @click="page++">
            <ChevronRight class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="messagesLoading" class="flex flex-col">
          <div v-for="i in 6" :key="i" class="flex items-start gap-3 px-3 py-3.5 border-b border-surface-100 dark:border-surface-800/50">
            <div class="size-8 rounded-full bg-surface-100 dark:bg-surface-800 animate-pulse shrink-0" />
            <div class="flex-1 min-w-0 space-y-2 pt-0.5">
              <div class="flex justify-between gap-4">
                <div class="h-3 w-24 rounded bg-surface-100 dark:bg-surface-800 animate-pulse" />
                <div class="h-2.5 w-10 rounded bg-surface-100 dark:bg-surface-800 animate-pulse" />
              </div>
              <div class="h-2.5 w-3/4 rounded bg-surface-100 dark:bg-surface-800 animate-pulse" />
            </div>
          </div>
        </div>

        <div v-else-if="!filteredMessages.length" class="flex flex-col items-center justify-center py-16 px-6 gap-3">
          <div class="flex items-center justify-center size-12 rounded-2xl bg-surface-100 dark:bg-surface-800">
            <component :is="folderMeta[selectedFolder]?.icon ?? Mail" class="size-6 text-surface-400" />
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-surface-700 dark:text-surface-300">No messages</p>
            <p class="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{{ search ? 'No results for your search' : 'Sync to fetch new messages' }}</p>
          </div>
          <button v-if="!search" class="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline cursor-pointer border-0 bg-transparent font-medium" @click="syncMail">
            <RefreshCw class="size-3" /> Sync now
          </button>
        </div>

        <button
          v-for="msg in filteredMessages"
          :key="msg.id"
          class="group relative flex items-start gap-3 w-full px-3 py-3.5 border-b border-surface-100 dark:border-surface-800/50 text-left transition-all cursor-pointer border-r-0 border-t-0 bg-transparent"
          :class="selectedMsgId === msg.id
            ? 'bg-brand-50 dark:bg-brand-950/30 border-l-2 border-l-brand-500'
            : 'border-l-2 border-l-transparent hover:bg-surface-50 dark:hover:bg-surface-800/40'"
          @click="openMsg(msg.id)"
        >
          <div class="relative shrink-0 mt-0.5">
            <div class="flex items-center justify-center size-8 rounded-full text-white text-[11px] font-bold" :class="avatarBg(msg.fromEmail ?? msg.id)">
              {{ initials(msg.fromName, msg.fromEmail) }}
            </div>
            <span v-if="!msg.isRead" class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brand-500 ring-2 ring-white dark:ring-surface-900" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[13px] truncate leading-snug" :class="msg.isRead ? 'text-surface-600 dark:text-surface-400 font-normal' : 'text-surface-900 dark:text-surface-100 font-semibold'">
                {{ msg.fromName || msg.fromEmail || 'Unknown sender' }}
              </span>
              <span class="text-[10px] text-surface-400 dark:text-surface-500 shrink-0 tabular-nums">{{ formatDate(msg.sentAt) }}</span>
            </div>
            <p class="text-[12px] truncate mt-0.5 leading-snug" :class="msg.isRead ? 'text-surface-400 dark:text-surface-500' : 'text-surface-700 dark:text-surface-300 font-medium'">
              {{ msg.subject || '(no subject)' }}
            </p>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Right: message viewer ──────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 bg-white dark:bg-surface-900" :class="showViewer ? 'flex' : 'hidden lg:flex'">

      <div v-if="msgLoading" class="flex flex-1 items-center justify-center">
        <Loader2 class="size-5 animate-spin text-surface-400" />
      </div>

      <div v-else-if="!selectedMsg" class="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
        <div class="flex items-center justify-center size-16 rounded-2xl bg-surface-100 dark:bg-surface-800">
          <Mail class="size-8 text-surface-400 dark:text-surface-500" />
        </div>
        <div>
          <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">No message selected</p>
          <p class="text-xs text-surface-400 dark:text-surface-500 mt-1">Choose a message from the list to read it</p>
        </div>
      </div>

      <template v-else>
        <!-- Message header -->
        <div class="flex items-start gap-3 px-5 py-4 border-b border-surface-100 dark:border-surface-800">
          <button class="lg:hidden flex items-center justify-center size-7 rounded-lg text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all cursor-pointer border-0 bg-transparent shrink-0 mt-0.5" @click="closeViewer">
            <ChevronLeft class="size-4" />
          </button>
          <div class="flex-1 min-w-0">
            <h2 class="text-[15px] font-semibold text-surface-900 dark:text-surface-100 leading-snug">
              {{ selectedMsg.subject || '(no subject)' }}
            </h2>
            <div class="flex items-center gap-2.5 mt-2.5">
              <div class="flex items-center justify-center size-8 rounded-full text-white text-[10px] font-bold shrink-0" :class="avatarBg(selectedMsg.fromEmail ?? selectedMsg.id)">
                {{ initials(selectedMsg.fromName, selectedMsg.fromEmail) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-semibold text-surface-800 dark:text-surface-200 truncate">{{ selectedMsg.fromName || selectedMsg.fromEmail }}</p>
                <p v-if="selectedMsg.fromName && selectedMsg.fromEmail" class="text-[11px] text-surface-400 dark:text-surface-500 truncate">{{ selectedMsg.fromEmail }}</p>
              </div>
              <span class="text-[11px] text-surface-400 dark:text-surface-500 shrink-0 tabular-nums">{{ formatDateFull(selectedMsg.sentAt) }}</span>
            </div>
            <div v-if="parsedTo.length || parsedCc.length" class="flex flex-wrap gap-1 mt-2">
              <template v-if="parsedTo.length">
                <span class="text-[11px] text-surface-400 dark:text-surface-500 self-center">To:</span>
                <span v-for="r in parsedTo" :key="r.email" class="inline-flex items-center rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-[11px] text-surface-600 dark:text-surface-400">{{ r.name || r.email }}</span>
              </template>
              <template v-if="parsedCc.length">
                <span class="text-[11px] text-surface-400 dark:text-surface-500 self-center ml-1">Cc:</span>
                <span v-for="r in parsedCc" :key="r.email" class="inline-flex items-center rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-[11px] text-surface-600 dark:text-surface-400">{{ r.name || r.email }}</span>
              </template>
            </div>
          </div>
          <!-- Reply button -->
          <button
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-[12px] font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer bg-transparent"
            @click="openCompose(selectedMsg)"
          >
            <SendHorizonal class="size-3.5" />
            Reply
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-5">
          <template v-if="selectedMsg.bodyHtml">
            <iframe
              :srcdoc="selectedMsg.bodyHtml"
              sandbox="allow-same-origin"
              class="w-full border-0 bg-white rounded-xl"
              style="min-height: 400px;"
              @load="(e: Event) => { const f = e.target as HTMLIFrameElement; if (f.contentDocument?.body) f.style.height = f.contentDocument.body.scrollHeight + 32 + 'px' }"
            />
          </template>
          <template v-else-if="selectedMsg.bodyText">
            <pre class="whitespace-pre-wrap font-sans text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{{ selectedMsg.bodyText }}</pre>
          </template>
          <div v-else class="flex flex-col items-center justify-center py-12 gap-2 text-surface-400 dark:text-surface-500">
            <Mail class="size-8" /><p class="text-sm">No message body</p>
          </div>
        </div>
      </template>
    </div>

    <!-- ══ Edit mailbox modal ══════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showEditMailbox && editingMailbox" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="showEditMailbox = false">
          <div class="w-full sm:max-w-lg rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-2xl overflow-hidden">

            <div class="flex items-center justify-between px-5 py-3.5 border-b border-surface-100 dark:border-surface-800">
              <div>
                <p class="text-sm font-semibold text-surface-900 dark:text-surface-100">Edit mailbox</p>
                <p class="text-[11px] text-surface-400 dark:text-surface-500 mt-0.5">{{ editingMailbox.email }}</p>
              </div>
              <button class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer border-0 bg-transparent" @click="showEditMailbox = false">
                <X class="size-4" />
              </button>
            </div>

            <div class="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <!-- Label -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Label</label>
                <input v-model="editLabel" type="text" placeholder="e.g. Work inbox" class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
              </div>

              <!-- IMAP -->
              <div>
                <p class="text-xs font-semibold text-surface-600 dark:text-surface-400 mb-2">IMAP (incoming)</p>
                <div class="flex gap-2">
                  <input v-model="editImapHost" type="text" placeholder="imap.example.com" class="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input v-model.number="editImapPort" type="number" placeholder="993" class="w-20 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                </div>
                <label class="flex items-center gap-2 mt-2 cursor-pointer">
                  <input v-model="editImapTls" type="checkbox" class="rounded" />
                  <span class="text-xs text-surface-600 dark:text-surface-400">TLS / SSL</span>
                </label>
              </div>

              <!-- SMTP -->
              <div>
                <p class="text-xs font-semibold text-surface-600 dark:text-surface-400 mb-2">SMTP (outgoing)</p>
                <div class="flex gap-2">
                  <input v-model="editSmtpHost" type="text" placeholder="smtp.example.com" class="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input v-model.number="editSmtpPort" type="number" placeholder="587" class="w-20 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                </div>
                <label class="flex items-center gap-2 mt-2 cursor-pointer">
                  <input v-model="editSmtpTls" type="checkbox" class="rounded" />
                  <span class="text-xs text-surface-600 dark:text-surface-400">TLS / SSL (use for port 465)</span>
                </label>
              </div>

              <!-- Password -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">
                  Password
                  <span v-if="editingMailbox.hasPassword" class="ml-1 font-normal text-surface-400">(leave blank to keep current)</span>
                </label>
                <input v-model="editPassword" type="password" placeholder="New password" class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
              </div>

              <p v-if="editError" class="text-xs text-rose-600 dark:text-rose-400">{{ editError }}</p>
            </div>

            <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-100 dark:border-surface-800">
              <button class="px-4 py-2 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer border-0 bg-transparent" @click="showEditMailbox = false">Cancel</button>
              <button
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer border-0"
                :disabled="editSaving"
                @click="saveMailbox"
              >
                <Loader2 v-if="editSaving" class="size-3.5 animate-spin" />
                <Check v-else class="size-3.5" />
                {{ editSaving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>
