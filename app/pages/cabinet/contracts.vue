<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'My Contracts — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contract {
  id: string
  title: string
  employerName: string
  contractType: 'employment' | 'freelance' | 'consulting' | 'service' | 'nda' | 'other'
  startDate: string | null
  endDate: string | null
  salary: string | null
  currency: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── State ────────────────────────────────────────────────────────────────────

const { data: contracts, refresh, pending } = useFetch<Contract[]>('/api/cabinet/contracts', { server: false, lazy: true });

const typeLabels: Record<Contract['contractType'], string> = {
  employment:  'Employment',
  freelance:   'Freelance',
  consulting:  'Consulting',
  service:     'Service',
  nda:         'NDA',
  other:       'Other',
}

const typeColors: Record<Contract['contractType'], string> = {
  employment:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  freelance:   'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  consulting:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  service:     'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  nda:         'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  other:       'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400',
}

// ─── Form ─────────────────────────────────────────────────────────────────────

const showForm  = ref(false)
const editingId = ref<string | null>(null)
const saving    = ref(false)
const saveError = ref('')

const form = reactive({
  title:        '',
  employerName: '',
  contractType: 'employment' as Contract['contractType'],
  startDate:    '',
  endDate:      '',
  salary:       '',
  currency:     'USD',
  notes:        '',
})

function openAdd() {
  editingId.value = null
  Object.assign(form, {
    title: '', employerName: '', contractType: 'employment',
    startDate: '', endDate: '', salary: '', currency: 'USD', notes: '',
  })
  showForm.value = true
}

function openEdit(c: Contract) {
  editingId.value = c.id
  Object.assign(form, {
    title:        c.title,
    employerName: c.employerName,
    contractType: c.contractType,
    startDate:    c.startDate ?? '',
    endDate:      c.endDate ?? '',
    salary:       c.salary ?? '',
    currency:     c.currency ?? 'USD',
    notes:        c.notes ?? '',
  })
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
  saveError.value = ''
}

async function saveContract() {
  if (!form.title.trim() || !form.employerName.trim()) return
  saving.value = true
  saveError.value = ''
  try {
    const body = {
      title:        form.title.trim(),
      employerName: form.employerName.trim(),
      contractType: form.contractType,
      startDate:    form.startDate || null,
      endDate:      form.endDate   || null,
      salary:       form.salary.trim()   || null,
      currency:     form.currency.trim() || null,
      notes:        form.notes.trim()    || null,
    }
    if (editingId.value) {
      await $fetch(`/api/cabinet/contracts/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/cabinet/contracts', { method: 'POST', body })
    }
    await refresh()
    cancelForm()
  } catch (e: any) {
    saveError.value = e?.data?.statusMessage ?? 'Failed to save. Please try again.'
  } finally {
    saving.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deletingId  = ref<string | null>(null)
const confirmId   = ref<string | null>(null)

async function deleteContract(id: string) {
  deletingId.value = id
  try {
    await $fetch(`/api/cabinet/contracts/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingId.value = null
    confirmId.value  = null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
}
</script>

<template>
  <div class="flex flex-col gap-5 px-4 py-6 max-w-xl mx-auto pb-8">

    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Contracts</h1>
        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Your employment and service contracts</p>
      </div>
      <button
        v-if="!showForm"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
        @click="openAdd"
      >
        <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Contract
      </button>
    </div>

    <!-- ── Add / Edit form ────────────────────────────────────────────────── -->
    <section v-if="showForm" class="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
      <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">
          {{ editingId ? 'Edit contract' : 'Add contract' }}
        </h2>
        <button type="button" class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-colors cursor-pointer" @click="cancelForm">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-4 flex flex-col gap-3.5">
        <!-- Title -->
        <div>
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Contract title <span class="text-danger-500">*</span></label>
          <input
            v-model="form.title"
            type="text"
            maxlength="200"
            placeholder="e.g. Software Developer Agreement"
            class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        <!-- Employer -->
        <div>
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Employer / party name <span class="text-danger-500">*</span></label>
          <input
            v-model="form.employerName"
            type="text"
            maxlength="200"
            placeholder="e.g. Acme Corp"
            class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        <!-- Type -->
        <div>
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Contract type</label>
          <select
            v-model="form.contractType"
            class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          >
            <option v-for="(label, key) in typeLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>

        <!-- Dates -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Start date</label>
            <input
              v-model="form.startDate"
              type="date"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">End date <span class="text-surface-400">(leave blank if current)</span></label>
            <input
              v-model="form.endDate"
              type="date"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
        </div>

        <!-- Salary + Currency -->
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Compensation</label>
            <input
              v-model="form.salary"
              type="text"
              maxlength="100"
              placeholder="e.g. 85,000 / year"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Currency</label>
            <input
              v-model="form.currency"
              type="text"
              maxlength="10"
              placeholder="USD"
              class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">Notes <span class="text-surface-400">(optional)</span></label>
          <textarea
            v-model="form.notes"
            rows="3"
            maxlength="2000"
            placeholder="Any additional details…"
            class="w-full resize-none rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        <!-- Error -->
        <p v-if="saveError" class="text-xs text-danger-600 dark:text-danger-400">{{ saveError }}</p>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <button type="button" class="px-3 py-2 text-xs font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors cursor-pointer" @click="cancelForm">
            Cancel
          </button>
          <button
            type="button"
            :disabled="!form.title.trim() || !form.employerName.trim() || saving"
            class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
            @click="saveContract"
          >
            <svg v-if="saving" class="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contract' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div v-if="pending" class="flex flex-col gap-3">
      <div v-for="i in 2" :key="i" class="rounded-xl border border-surface-200 dark:border-surface-800 p-4 animate-pulse flex flex-col gap-2.5">
        <div class="flex items-center gap-2">
          <div class="h-5 w-20 rounded bg-surface-100 dark:bg-surface-800" />
          <div class="h-4 w-32 rounded bg-surface-100 dark:bg-surface-800 ml-auto" />
        </div>
        <div class="h-4 w-3/4 rounded bg-surface-100 dark:bg-surface-800" />
        <div class="h-3 w-1/2 rounded bg-surface-100 dark:bg-surface-800" />
      </div>
    </div>

    <!-- ── Empty state ────────────────────────────────────────────────────── -->
    <div v-else-if="!contracts?.length && !showForm" class="rounded-xl border border-dashed border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div class="flex size-12 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
        <svg class="size-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-semibold text-surface-700 dark:text-surface-300">No contracts yet</p>
        <p class="text-xs text-surface-400 mt-0.5">Add your employment and service contracts here.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        @click="openAdd"
      >
        <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add your first contract
      </button>
    </div>

    <!-- ── Contract cards ─────────────────────────────────────────────────── -->
    <ul v-else-if="contracts?.length" class="flex flex-col gap-3">
      <li
        v-for="c in contracts"
        :key="c.id"
        class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden"
      >
        <!-- Accent top strip -->
        <div class="h-0.5 w-full" :class="c.contractType === 'employment' ? 'bg-blue-500' : c.contractType === 'freelance' ? 'bg-violet-500' : c.contractType === 'consulting' ? 'bg-amber-500' : c.contractType === 'service' ? 'bg-teal-500' : c.contractType === 'nda' ? 'bg-rose-500' : 'bg-surface-300'" />

        <div class="px-4 pt-3.5 pb-4 flex flex-col gap-2.5">
          <!-- Row 1: type pill + actions -->
          <div class="flex items-start justify-between gap-3">
            <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded" :class="typeColors[c.contractType]">
              {{ typeLabels[c.contractType] }}
            </span>
            <div class="flex items-center gap-1 shrink-0">
              <!-- Edit -->
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                title="Edit"
                @click="openEdit(c)"
              >
                <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
              <!-- Delete / confirm -->
              <template v-if="confirmId === c.id">
                <button
                  type="button"
                  class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-danger-600 hover:bg-danger-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                  :disabled="deletingId === c.id"
                  @click="deleteContract(c.id)"
                >
                  <svg v-if="deletingId === c.id" class="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {{ deletingId === c.id ? '…' : 'Confirm' }}
                </button>
                <button type="button" class="text-[10px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors cursor-pointer px-1" @click="confirmId = null">
                  Cancel
                </button>
              </template>
              <button
                v-else
                type="button"
                class="flex size-7 items-center justify-center rounded-lg text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950/30 transition-colors cursor-pointer"
                title="Delete"
                @click="confirmId = c.id"
              >
                <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Row 2: title + employer -->
          <div>
            <h3 class="text-sm font-bold text-surface-900 dark:text-surface-100 leading-snug">{{ c.title }}</h3>
            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{{ c.employerName }}</p>
          </div>

          <!-- Row 3: dates + salary -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500 dark:text-surface-400">
            <span v-if="c.startDate || c.endDate" class="flex items-center gap-1">
              <svg class="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
              <span>
                {{ formatDate(c.startDate) ?? '—' }}
                <template v-if="c.endDate"> – {{ formatDate(c.endDate) }}</template>
                <template v-else-if="c.startDate"> – <span class="text-green-600 dark:text-green-400 font-medium">Current</span></template>
              </span>
            </span>
            <span v-if="c.salary" class="flex items-center gap-1">
              <svg class="size-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ c.salary }}<template v-if="c.currency"> {{ c.currency }}</template>
            </span>
          </div>

          <!-- Row 4: notes -->
          <p v-if="c.notes" class="text-xs text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-2 border-t border-surface-100 dark:border-surface-800 pt-2.5 mt-0.5">
            {{ c.notes }}
          </p>
        </div>
      </li>
    </ul>

  </div>
</template>
