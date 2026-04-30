<script setup lang="ts">
import {
  Phone, Plus, Pencil, Trash2, X, Check,
  ChevronDown, ChevronUp, UserPlus, UserMinus,
  Loader2, Eye, EyeOff,
} from 'lucide-vue-next'

definePageMeta({})
useSeoMeta({ title: 'SIP Extensions — Reqcore', description: 'Manage SIP extensions and member assignments' })

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  userId: string
  isPrimary: boolean
  assignedAt: string
  user: { id: string; name: string; email: string; image?: string }
}

interface SipExtension {
  id: string
  label: string
  extension: string
  displayName: string | null
  domain: string | null
  wsPort: string
  wsPath: string
  isActive: boolean
  hasPassword: boolean
  createdAt: string
  updatedAt: string
  assignments: Assignment[]
}

interface OrgMember {
  id: string
  userId: string
  role: string
  user: { name: string; email: string; image?: string }
}

// ─── Fetch extensions ─────────────────────────────────────────────────────────

const extensions = ref<SipExtension[]>([])
const loadingExtensions = ref(true)

async function fetchExtensions() {
  loadingExtensions.value = true
  try {
    extensions.value = await $fetch<SipExtension[]>('/api/sip-extensions')
  } finally {
    loadingExtensions.value = false
  }
}

// ─── Fetch org members ────────────────────────────────────────────────────────

const orgMembers = ref<OrgMember[]>([])

async function fetchMembers() {
  const result = await authClient.organization.listMembers()
  orgMembers.value = (result.data?.members ?? []) as OrgMember[]
}

onMounted(() => { fetchExtensions(); fetchMembers() })

// ─── Expanded extension ───────────────────────────────────────────────────────

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
  label:       '',
  extension:   '',
  displayName: '',
  username:    '',
  password:    '',
  domain:      '',
  wsPort:      '8089',
  wsPath:      '/ws',
  isActive:    true,
})

function openCreate() {
  editingId.value = null
  Object.assign(form, { label: '', extension: '', displayName: '', username: '', password: '', domain: '', wsPort: '8089', wsPath: '/ws', isActive: true })
  formError.value = ''
  showPassword.value = false
  showForm.value = true
}

function openEdit(ext: SipExtension) {
  editingId.value = ext.id
  Object.assign(form, {
    label:       ext.label,
    extension:   ext.extension,
    displayName: ext.displayName ?? '',
    username:    '',
    password:    '',
    domain:      ext.domain ?? '',
    wsPort:      ext.wsPort,
    wsPath:      ext.wsPath,
    isActive:    ext.isActive,
  })
  formError.value = ''
  showPassword.value = false
  showForm.value = true
}

async function saveExtension() {
  if (!form.label.trim() || !form.extension.trim()) return
  saving.value = true
  formError.value = ''
  try {
    const body = {
      label:       form.label.trim(),
      extension:   form.extension.trim(),
      displayName: form.displayName.trim() || undefined,
      username:    form.username.trim() || undefined,
      password:    form.password || undefined,
      domain:      form.domain.trim() || undefined,
      wsPort:      form.wsPort.trim() || '8089',
      wsPath:      form.wsPath.trim() || '/ws',
      isActive:    form.isActive,
    }
    if (editingId.value) {
      const updated = await $fetch<SipExtension>(`/api/sip-extensions/${editingId.value}`, { method: 'PATCH', body })
      const idx = extensions.value.findIndex(e => e.id === editingId.value)
      if (idx !== -1) extensions.value[idx] = { ...extensions.value[idx], ...updated }
    } else {
      const created = await $fetch<SipExtension>('/api/sip-extensions', { method: 'POST', body })
      extensions.value.push(created)
    }
    showForm.value = false
  } catch (e: any) {
    formError.value = e?.data?.statusMessage ?? 'Failed to save.'
  } finally {
    saving.value = false
  }
}

// ─── Delete extension ─────────────────────────────────────────────────────────

const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)

async function deleteExtension(id: string) {
  deleting.value = true
  try {
    await $fetch(`/api/sip-extensions/${id}`, { method: 'DELETE' })
    extensions.value = extensions.value.filter(e => e.id !== id)
    if (expandedId.value === id) expandedId.value = null
  } finally {
    deleting.value = false
    confirmDeleteId.value = null
  }
}

// ─── Assign / unassign members ────────────────────────────────────────────────

const assigningExtId = ref<string | null>(null)
const assignUserId = ref('')
const assigning = ref(false)
const assignError = ref('')

function openAssign(extId: string) {
  assigningExtId.value = extId
  assignUserId.value = ''
  assignError.value = ''
}

function unassignedMembers(ext: SipExtension) {
  const assignedIds = new Set(ext.assignments.map(a => a.userId))
  return orgMembers.value.filter(m => !assignedIds.has(m.userId))
}

async function assignMember(extId: string) {
  if (!assignUserId.value) return
  assigning.value = true
  assignError.value = ''
  try {
    const assignment = await $fetch<Assignment>(`/api/sip-extensions/${extId}/assignments`, {
      method: 'POST',
      body: { userId: assignUserId.value, isPrimary: false },
    })
    const member = orgMembers.value.find(m => m.userId === assignUserId.value)
    if (member) {
      const ext = extensions.value.find(e => e.id === extId)
      ext?.assignments.push({ ...assignment, user: { id: member.userId, name: member.user.name, email: member.user.email } })
    }
    assigningExtId.value = null
  } catch (e: any) {
    assignError.value = e?.data?.statusMessage ?? 'Failed to assign.'
  } finally {
    assigning.value = false
  }
}

async function unassignMember(extId: string, userId: string) {
  await $fetch(`/api/sip-extensions/${extId}/assignments/${userId}`, { method: 'DELETE' })
  const ext = extensions.value.find(e => e.id === extId)
  if (ext) ext.assignments = ext.assignments.filter(a => a.userId !== userId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function memberInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'
}
</script>

<template>
  <div class="mx-auto max-w-2xl flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">SIP Extensions</h2>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
          Configure SIP extensions for the softphone dialer. Assign them to members so they can make and receive calls.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm cursor-pointer shrink-0"
        @click="openCreate"
      >
        <Plus class="size-4" />
        Add extension
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loadingExtensions" class="flex flex-col gap-3">
      <div v-for="i in 2" :key="i" class="h-20 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="extensions.length === 0"
      class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 py-14 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
        <Phone class="size-6 text-surface-400" />
      </div>
      <div>
        <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">No SIP extensions yet</p>
        <p class="text-sm text-surface-400 dark:text-surface-500 mt-0.5">Add one to enable the softphone dialer.</p>
      </div>
      <button
        type="button"
        class="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
        @click="openCreate"
      >
        <Plus class="size-4" />
        Add extension
      </button>
    </div>

    <!-- Extension list -->
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="ext in extensions"
        :key="ext.id"
        class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm"
      >
        <!-- Extension row -->
        <div class="flex items-center gap-3 px-5 py-4">
          <!-- Icon -->
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/40">
            <Phone class="size-5 text-brand-600 dark:text-brand-400" />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-surface-900 dark:text-surface-100">{{ ext.label }}</p>
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                Ext. {{ ext.extension }}
              </span>
              <span v-if="!ext.isActive" class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-500">
                Inactive
              </span>
            </div>
            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {{ ext.domain ? `${ext.domain}:${ext.wsPort}${ext.wsPath}` : 'No domain configured' }}
            </p>
          </div>

          <!-- Member avatars preview -->
          <div v-if="ext.assignments.length > 0" class="hidden sm:flex items-center -space-x-1.5 shrink-0">
            <div
              v-for="a in ext.assignments.slice(0, 4)"
              :key="a.id"
              class="flex size-7 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold ring-2 ring-white dark:ring-surface-900"
              :title="a.user.name"
            >
              {{ memberInitials(a.user.name) }}
            </div>
            <div
              v-if="ext.assignments.length > 4"
              class="flex size-7 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500 text-[10px] font-bold ring-2 ring-white dark:ring-surface-900"
            >
              +{{ ext.assignments.length - 4 }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors cursor-pointer"
              title="Edit"
              @click="openEdit(ext)"
            >
              <Pencil class="size-3.5" />
            </button>
            <template v-if="confirmDeleteId === ext.id">
              <span class="text-xs text-surface-400">Delete?</span>
              <button
                type="button"
                :disabled="deleting"
                class="text-xs rounded-lg border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 px-2 py-1 font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                @click="deleteExtension(ext.id)"
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
              @click="confirmDeleteId = ext.id"
            >
              <Trash2 class="size-3.5" />
            </button>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              :title="expandedId === ext.id ? 'Collapse' : 'Manage members'"
              @click="toggleExpand(ext.id)"
            >
              <ChevronUp v-if="expandedId === ext.id" class="size-4" />
              <ChevronDown v-else class="size-4" />
            </button>
          </div>
        </div>

        <!-- Expanded: members panel -->
        <div v-if="expandedId === ext.id" class="border-t border-surface-100 dark:border-surface-800 px-5 py-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-surface-600 dark:text-surface-400 uppercase tracking-wide">
              Assigned members ({{ ext.assignments.length }})
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              @click="openAssign(ext.id)"
            >
              <UserPlus class="size-3.5" />
              Add member
            </button>
          </div>

          <!-- Assign dropdown -->
          <div v-if="assigningExtId === ext.id" class="mb-3 flex items-center gap-2">
            <select
              v-model="assignUserId"
              class="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select member…</option>
              <option v-for="m in unassignedMembers(ext)" :key="m.userId" :value="m.userId">
                {{ m.user.name }} — {{ m.user.email }}
              </option>
            </select>
            <button
              type="button"
              :disabled="!assignUserId || assigning"
              class="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-2 text-sm font-semibold transition-colors cursor-pointer"
              @click="assignMember(ext.id)"
            >
              <Loader2 v-if="assigning" class="size-3.5 animate-spin" />
              <Check v-else class="size-3.5" />
              Assign
            </button>
            <button
              type="button"
              class="flex size-9 items-center justify-center rounded-xl border border-surface-200 dark:border-surface-700 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              @click="assigningExtId = null"
            >
              <X class="size-4" />
            </button>
          </div>
          <p v-if="assignError" class="text-xs text-danger-600 dark:text-danger-400 mb-2">{{ assignError }}</p>

          <!-- Member list -->
          <div v-if="ext.assignments.length === 0" class="text-xs text-surface-400 dark:text-surface-500 py-2">
            No members assigned yet.
          </div>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="a in ext.assignments"
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
                @click="unassignMember(ext.id, a.userId)"
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
              {{ editingId ? 'Edit extension' : 'Add extension' }}
            </p>
            <button type="button" class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer transition-colors" @click="showForm = false">
              <X class="size-5" />
            </button>
          </div>

          <div class="px-5 py-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
            <!-- Label -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Label</label>
              <input v-model="form.label" type="text" placeholder="e.g. Sales Line" maxlength="100"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <!-- Extension number + Display name -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Extension number</label>
                <input v-model="form.extension" type="text" placeholder="101" maxlength="20"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">Display name</label>
                <input v-model="form.displayName" type="text" placeholder="Support Desk" maxlength="100"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <!-- Domain + WS Port + WS Path -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">SIP domain / host</label>
              <input v-model="form.domain" type="text" placeholder="sip.yourpbx.com"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">WebSocket port</label>
                <input v-model="form.wsPort" type="text" placeholder="8089"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">WebSocket path</label>
                <input v-model="form.wsPath" type="text" placeholder="/ws"
                  class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

            <!-- Username -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">
                SIP username
                <span class="font-normal text-surface-400"> — leave blank to use extension number</span>
              </label>
              <input v-model="form.username" type="text" placeholder="same as extension number"
                class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <!-- Password -->
            <div>
              <label class="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">
                SIP password
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

            <!-- Active toggle -->
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input v-model="form.isActive" type="checkbox" class="size-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
              <span class="text-sm text-surface-700 dark:text-surface-300">Extension is active</span>
            </label>

            <div v-if="formError" class="text-xs text-danger-600 dark:text-danger-400">{{ formError }}</div>

            <button
              type="button"
              :disabled="!form.label.trim() || !form.extension.trim() || saving"
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 text-sm font-semibold transition-colors cursor-pointer"
              @click="saveExtension"
            >
              <Loader2 v-if="saving" class="size-4 animate-spin" />
              {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create extension' }}
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
