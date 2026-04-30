<script setup lang="ts">
import {
  Mail, Plus, Pencil, Trash2, X, Check,
  ChevronDown, ChevronUp, UserPlus, UserMinus,
  Loader2, Eye, EyeOff, Server, AlertTriangle,
} from 'lucide-vue-next'

definePageMeta({})
useSeoMeta({ title: 'Mailboxes — Reqcore', description: 'Manage email accounts and member assignments' })

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  userId: string
  isPrimary: boolean
  assignedAt: string
  user: { id: string; name: string; email: string; image?: string }
}

interface Mailbox {
  id: string
  label: string
  email: string
  provider: 'imap' | 'gmail' | 'microsoft'
  imapHost: string | null
  imapPort: number | null
  imapTls: boolean
  smtpHost: string | null
  smtpPort: number | null
  smtpTls: boolean
  isActive: boolean
  hasPassword: boolean
  hasOAuthToken: boolean
  syncError: string | null
  lastSyncAt: string | null
  assignments: Assignment[]
}

interface OrgMember {
  id: string
  userId: string
  role: string
  user: { name: string; email: string; image?: string }
}

// ─── Fetch mailboxes ──────────────────────────────────────────────────────────

const mailboxes = ref<Mailbox[]>([])
const loadingMailboxes = ref(true)

async function fetchMailboxes() {
  loadingMailboxes.value = true
  try {
    mailboxes.value = await $fetch<Mailbox[]>('/api/mailboxes')
  } finally {
    loadingMailboxes.value = false
  }
}

// ─── Fetch org members ────────────────────────────────────────────────────────

const orgMembers = ref<OrgMember[]>([])

async function fetchMembers() {
  const result = await authClient.organization.listMembers()
  orgMembers.value = (result.data?.members ?? []) as OrgMember[]
}

onMounted(() => { fetchMailboxes(); fetchMembers() })

// ─── Expanded mailbox ─────────────────────────────────────────────────────────

const expandedId = ref<string | null>(null)
function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

// ─── Create / Edit form ───────────────────────────────────────────────────────

const showForm = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const showPassword = ref(false)

const form = reactive({
  label:    '',
  email:    '',
  provider: 'imap' as 'imap' | 'gmail' | 'microsoft',
  imapHost: '',
  imapPort: 993,
  imapTls:  true,
  smtpHost: '',
  smtpPort: 587,
  smtpTls:  true,
  username: '',
  password: '',
})

function openCreate() {
  editingId.value = null
  Object.assign(form, { label: '', email: '', provider: 'imap', imapHost: '', imapPort: 993, imapTls: true, smtpHost: '', smtpPort: 587, smtpTls: true, username: '', password: '' })
  formError.value = ''
  showPassword.value = false
  showForm.value = true
}

function openEdit(m: Mailbox) {
  editingId.value = m.id
  Object.assign(form, {
    label:    m.label,
    email:    m.email,
    provider: m.provider,
    imapHost: m.imapHost ?? '',
    imapPort: m.imapPort ?? 993,
    imapTls:  m.imapTls,
    smtpHost: m.smtpHost ?? '',
    smtpPort: m.smtpPort ?? 587,
    smtpTls:  m.smtpTls,
    username: '',
    password: '',
  })
  formError.value = ''
  showPassword.value = false
  showForm.value = true
}

async function saveMailbox() {
  if (!form.label.trim() || !form.email.trim()) return
  saving.value = true
  formError.value = ''
  try {
    const body = {
      label:    form.label.trim(),
      email:    form.email.trim(),
      provider: form.provider,
      imapHost: form.imapHost.trim() || undefined,
      imapPort: form.imapPort || undefined,
      imapTls:  form.imapTls,
      smtpHost: form.smtpHost.trim() || undefined,
      smtpPort: form.smtpPort || undefined,
      smtpTls:  form.smtpTls,
      username: form.username.trim() || undefined,
      password: form.password || undefined,
    }
    if (editingId.value) {
      const updated = await $fetch<Mailbox>(`/api/mailboxes/${editingId.value}`, { method: 'PATCH', body })
      const idx = mailboxes.value.findIndex(m => m.id === editingId.value)
      if (idx !== -1) mailboxes.value[idx] = { ...mailboxes.value[idx], ...updated }
    } else {
      const created = await $fetch<Mailbox>('/api/mailboxes', { method: 'POST', body })
      mailboxes.value.push(created)
    }
    showForm.value = false
  } catch (e: any) {
    formError.value = e?.data?.statusMessage ?? 'Failed to save.'
  } finally {
    saving.value = false
  }
}

// ─── Delete mailbox ───────────────────────────────────────────────────────────

const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)

async function deleteMailbox(id: string) {
  deleting.value = true
  try {
    await $fetch(`/api/mailboxes/${id}`, { method: 'DELETE' })
    mailboxes.value = mailboxes.value.filter(m => m.id !== id)
    if (expandedId.value === id) expandedId.value = null
  } finally {
    deleting.value = false
    confirmDeleteId.value = null
  }
}

// ─── Assign / unassign members ────────────────────────────────────────────────

const assigningMailboxId = ref<string | null>(null)
const assignUserId = ref('')
const assigning = ref(false)
const assignError = ref('')

function openAssign(mailboxId: string) {
  assigningMailboxId.value = mailboxId
  assignUserId.value = ''
  assignError.value = ''
}

function unassignedMembers(mailbox: Mailbox) {
  const assignedIds = new Set(mailbox.assignments.map(a => a.userId))
  return orgMembers.value.filter(m => !assignedIds.has(m.userId))
}

async function assignMember(mailboxId: string) {
  if (!assignUserId.value) return
  assigning.value = true
  assignError.value = ''
  try {
    const assignment = await $fetch<Assignment>(`/api/mailboxes/${mailboxId}/assignments`, {
      method: 'POST',
      body: { userId: assignUserId.value, isPrimary: false },
    })
    const member = orgMembers.value.find(m => m.userId === assignUserId.value)
    if (member) {
      const mailbox = mailboxes.value.find(m => m.id === mailboxId)
      mailbox?.assignments.push({ ...assignment, user: { id: member.userId, name: member.user.name, email: member.user.email } })
    }
    assigningMailboxId.value = null
  } catch (e: any) {
    assignError.value = e?.data?.statusMessage ?? 'Failed to assign.'
  } finally {
    assigning.value = false
  }
}

async function unassignMember(mailboxId: string, userId: string) {
  await $fetch(`/api/mailboxes/${mailboxId}/assignments/${userId}`, { method: 'DELETE' })
  const mailbox = mailboxes.value.find(m => m.id === mailboxId)
  if (mailbox) mailbox.assignments = mailbox.assignments.filter(a => a.userId !== userId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const providerLabel: Record<string, string> = { imap: 'IMAP / SMTP', gmail: 'Gmail (OAuth2)', microsoft: 'Microsoft 365 (OAuth2)' }
const providerColor: Record<string, string> = {
  imap:      'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
  gmail:     'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  microsoft: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
}

function memberInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'
}
</script>

<template>
  <div class="mx-auto max-w-2xl flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">Mailboxes</h2>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
          Configure email accounts for your organisation. Assign them to members so they can send and receive mail.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm cursor-pointer shrink-0"
        @click="openCreate"
      >
        <Plus class="size-4" />
        Add mailbox
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loadingMailboxes" class="flex flex-col gap-3">
      <div v-for="i in 2" :key="i" class="h-20 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="mailboxes.length === 0"
      class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 py-14 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
        <Mail class="size-6 text-surface-400" />
      </div>
      <div>
        <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">No mailboxes yet</p>
        <p class="text-sm text-surface-400 dark:text-surface-500 mt-0.5">Add one to get started.</p>
      </div>
      <button
        type="button"
        class="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
        @click="openCreate"
      >
        <Plus class="size-4" />
        Add mailbox
      </button>
    </div>

    <!-- Mailbox list -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="mailbox in mailboxes"
        :key="mailbox.id"
        class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm"
      >
        <!-- Mailbox row -->
        <div class="flex items-center gap-3 px-5 py-4">
          <!-- Icon -->
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/40">
            <Mail class="size-5 text-brand-600 dark:text-brand-400" />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-surface-900 dark:text-surface-100">{{ mailbox.label }}</p>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="providerColor[mailbox.provider]">
                {{ providerLabel[mailbox.provider] }}
              </span>
              <span v-if="!mailbox.isActive" class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-500">
                Inactive
              </span>
            </div>
            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{{ mailbox.email }}</p>
            <p v-if="mailbox.syncError" class="text-xs text-danger-600 dark:text-danger-400 mt-0.5 flex items-center gap-1">
              <AlertTriangle class="size-3 shrink-0" />
              {{ mailbox.syncError }}
            </p>
          </div>

          <!-- Member avatars preview -->
          <div v-if="mailbox.assignments.length > 0" class="hidden sm:flex items-center -space-x-1.5 shrink-0">
            <div
              v-for="a in mailbox.assignments.slice(0, 4)"
              :key="a.id"
              class="flex size-7 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold ring-2 ring-white dark:ring-surface-900"
              :title="a.user.name"
            >
              {{ memberInitials(a.user.name) }}
            </div>
            <div
              v-if="mailbox.assignments.length > 4"
              class="flex size-7 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500 text-[10px] font-bold ring-2 ring-white dark:ring-surface-900"
            >
              +{{ mailbox.assignments.length - 4 }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors cursor-pointer"
              title="Edit"
              @click="openEdit(mailbox)"
            >
              <Pencil class="size-3.5" />
            </button>
            <template v-if="confirmDeleteId === mailbox.id">
              <span class="text-xs text-surface-400">Delete?</span>
              <button
                type="button"
                :disabled="deleting"
                class="text-xs rounded-lg border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 px-2 py-1 font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                @click="deleteMailbox(mailbox.id)"
              >
                <Loader2 v-if="deleting" class="size-3 animate-spin" />
                <span v-else>Yes</span>
              </button>
              <button
                type="button"
                class="text-xs rounded-lg border border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 px-2 py-1 font-semibold cursor-pointer transition-colors"
                @click="confirmDeleteId = null"
              >
                No
              </button>
            </template>
            <button
              v-else
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
              title="Delete"
              @click="confirmDeleteId = mailbox.id"
            >
              <Trash2 class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              :title="expandedId === mailbox.id ? 'Collapse' : 'Manage members'"
              @click="toggleExpand(mailbox.id)"
            >
              <ChevronUp v-if="expandedId === mailbox.id" class="size-4" />
              <ChevronDown v-else class="size-4" />
            </button>
          </div>
        </div>

        <!-- Expanded: members panel -->
        <div v-if="expandedId === mailbox.id" class="border-t border-surface-100 dark:border-surface-800 px-5 py-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wide">
              Assigned members ({{ mailbox.assignments.length }})
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              @click="openAssign(mailbox.id)"
            >
              <UserPlus class="size-3.5" />
              Add member
            </button>
          </div>

          <!-- Assign dropdown -->
          <div v-if="assigningMailboxId === mailbox.id" class="mb-3 flex items-center gap-2">
            <select
              v-model="assignUserId"
              class="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select member…</option>
              <option v-for="m in unassignedMembers(mailbox)" :key="m.userId" :value="m.userId">
                {{ m.user.name }} — {{ m.user.email }}
              </option>
            </select>
            <button
              type="button"
              :disabled="!assignUserId || assigning"
              class="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-2 text-sm font-semibold transition-colors cursor-pointer"
              @click="assignMember(mailbox.id)"
            >
              <Loader2 v-if="assigning" class="size-3.5 animate-spin" />
              <Check v-else class="size-3.5" />
              Assign
            </button>
            <button
              type="button"
              class="flex size-9 items-center justify-center rounded-xl border border-surface-200 dark:border-surface-700 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              @click="assigningMailboxId = null"
            >
              <X class="size-4" />
            </button>
          </div>
          <p v-if="assignError" class="text-xs text-danger-600 dark:text-danger-400 mb-2">{{ assignError }}</p>

          <!-- Member list -->
          <div v-if="mailbox.assignments.length === 0" class="text-xs text-surface-400 dark:text-surface-500 py-2">
            No members assigned yet.
          </div>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="a in mailbox.assignments"
              :key="a.id"
              class="flex items-center gap-3 rounded-xl bg-surface-50 dark:bg-surface-800/60 px-3 py-2.5"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-bold">
                {{ memberInitials(a.user.name) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{{ a.user.name }}</p>
                <p class="text-xs text-surface-500 dark:text-surface-400 truncate">{{ a.user.email }}</p>
              </div>
              <span v-if="a.isPrimary" class="shrink-0 text-[10px] font-semibold rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 px-2 py-0.5">
                Primary
              </span>
              <button
                type="button"
                class="shrink-0 flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
                title="Remove"
                @click="unassignMember(mailbox.id, a.userId)"
              >
                <UserMinus class="size-3.5" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Create / Edit modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showForm = false"
      >
        <div class="w-full sm:max-w-lg rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
            <p class="text-base font-semibold text-surface-900 dark:text-surface-100">
              {{ editingId ? 'Edit mailbox' : 'Add mailbox' }}
            </p>
            <button type="button" class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer transition-colors" @click="showForm = false">
              <X class="size-5" />
            </button>
          </div>

          <div class="px-5 py-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <!-- Label -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Label</label>
              <input v-model="form.label" type="text" placeholder="e.g. HR Inbox" maxlength="100"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <!-- Email -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Email address</label>
              <input v-model="form.email" type="email" placeholder="hr@company.com"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <!-- Provider -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-2">Provider</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="p in (['imap', 'gmail', 'microsoft'] as const)"
                  :key="p"
                  type="button"
                  class="rounded-xl border-2 py-2 text-xs font-semibold transition-colors cursor-pointer"
                  :class="form.provider === p
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'"
                  @click="form.provider = p"
                >
                  {{ p === 'imap' ? 'IMAP / SMTP' : p === 'gmail' ? 'Gmail' : 'Microsoft 365' }}
                </button>
              </div>
            </div>

            <!-- IMAP / SMTP fields (only for imap provider) -->
            <template v-if="form.provider === 'imap'">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">IMAP host</label>
                  <input v-model="form.imapHost" type="text" placeholder="imap.gmail.com"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">IMAP port</label>
                  <input v-model.number="form.imapPort" type="number" placeholder="993"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">SMTP host</label>
                  <input v-model="form.smtpHost" type="text" placeholder="smtp.gmail.com"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">SMTP port</label>
                  <input v-model.number="form.smtpPort" type="number" placeholder="587"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>

              <!-- Username -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Username</label>
                <input v-model="form.username" type="text" placeholder="usually same as email"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <!-- Password -->
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">
                  Password / App password
                  <span v-if="editingId" class="font-normal text-surface-400"> — leave blank to keep existing</span>
                </label>
                <div class="relative">
                  <input
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 pr-10 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer"
                    @click="showPassword = !showPassword"
                  >
                    <EyeOff v-if="showPassword" class="size-4" />
                    <Eye v-else class="size-4" />
                  </button>
                </div>
              </div>
            </template>

            <!-- OAuth notice -->
            <div v-else class="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 px-4 py-3">
              <Server class="size-4 text-blue-500 shrink-0 mt-0.5" />
              <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                OAuth2 connection for <strong>{{ form.provider === 'gmail' ? 'Gmail' : 'Microsoft 365' }}</strong> requires configuring the OAuth app in your cloud console and completing an authorisation flow. Save the mailbox first, then connect via OAuth from the mailbox card.
              </p>
            </div>

            <div v-if="formError" class="text-xs text-danger-600 dark:text-danger-400">{{ formError }}</div>

            <button
              type="button"
              :disabled="!form.label.trim() || !form.email.trim() || saving"
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-semibold transition-colors cursor-pointer"
              @click="saveMailbox"
            >
              <Loader2 v-if="saving" class="size-4 animate-spin" />
              {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create mailbox' }}
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
