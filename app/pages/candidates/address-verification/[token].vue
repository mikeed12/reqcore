<script setup lang="ts">
import { AlertTriangle, Loader2, Save, Check } from 'lucide-vue-next'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
})

useSeoMeta({
  title: 'Verify Address — Reqcore',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const candidateId = route.params.token as string

const { candidate, refresh, error: fetchError } = useCandidate(candidateId)

const isLoading = ref(true)
const isSaving = ref(false)
const notFound = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const errors = ref<Record<string, string>>({})

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
]

const formSchema = z.object({
  address1: z.string().min(1, 'Address is required').max(255),
  city:     z.string().min(1, 'City is required').max(100),
  state:    z.string().min(1, 'State is required').max(100),
  zip:      z.string().min(1, 'ZIP code is required').max(20),
})

const form = ref({
  address1: '',
  city: '',
  state: '',
  zip: '',
})

function validate(): boolean {
  const result = formSchema.safeParse(form.value)
  if (!result.success) {
    errors.value = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0]?.toString()
      if (field) errors.value[field] = issue.message
    }
    return false
  }
  errors.value = {}
  return true
}

watch(candidate, (val) => {
  const addr = val?.addresses?.[0]
  if (!addr) return
  form.value = {
    address1: addr.address1 ?? '',
    city:     addr.city    ?? '',
    state:    addr.state   ?? '',
    zip:      addr.zip     ?? '',
  }
}, { immediate: true })

onMounted(async () => {
  try {
    await refresh()
  } finally {
    if (fetchError.value || !candidate.value) notFound.value = true
    isLoading.value = false
  }
})

async function handleSubmit() {
  submitError.value = ''
  if (!validate()) return

  isSaving.value = true
  try {
    await $fetch(`/api/candidates/${candidateId}/address`, {
      method: 'PUT',
      body: { ...form.value, country: 'United States' },
    })
    submitSuccess.value = true
    setTimeout(() => { submitSuccess.value = false }, 4000)
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage || err?.statusMessage || 'Failed to save address.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="isLoading" class="flex flex-col items-center gap-3 py-8">
    <div class="size-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
    <p class="text-sm text-surface-500 dark:text-surface-400">Loading…</p>
  </div>

  <!-- Not found state -->
  <div v-else-if="notFound" class="flex flex-col items-center gap-4 py-6">
    <div class="flex items-center justify-center size-12 rounded-full bg-danger-100 dark:bg-danger-950 text-danger-600 dark:text-danger-400">
      <AlertTriangle class="size-6" />
    </div>
    <div class="text-center">
      <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">Invalid or expired link</h2>
      <p class="text-sm text-surface-500 dark:text-surface-400">This address verification link is no longer valid.</p>
    </div>
  </div>

  <!-- Address form -->
  <div v-else class="flex flex-col gap-5">
    <div class="text-center">
      <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-1">Verify your address</h2>
      <p class="text-sm text-surface-500 dark:text-surface-400">Please confirm your address information</p>
    </div>

    <!-- Submit error banner -->
    <div v-if="submitError" class="flex items-start gap-3 rounded-md border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-3 text-sm text-danger-700 dark:text-danger-400">
      <AlertTriangle class="size-4 mt-0.5 shrink-0" />
      <span>{{ submitError }}</span>
    </div>

    <div>
      <label for="address1" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        Address Line
      </label>
      <input
        id="address1"
        v-model="form.address1"
        type="text"
        :class="errors.address1 ? 'border-danger-300 dark:border-danger-700' : 'border-surface-200 dark:border-surface-700'"
        class="w-full rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
      <p v-if="errors.address1" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ errors.address1 }}</p>
    </div>

    <div>
      <label for="city" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        City
      </label>
      <input
        id="city"
        v-model="form.city"
        type="text"
        :class="errors.city ? 'border-danger-300 dark:border-danger-700' : 'border-surface-200 dark:border-surface-700'"
        class="w-full rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
      <p v-if="errors.city" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ errors.city }}</p>
    </div>

    <div>
      <label for="state" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        State
      </label>
      <select
        id="state"
        v-model="form.state"
        :class="[
          errors.state ? 'border-danger-300 dark:border-danger-700' : 'border-surface-200 dark:border-surface-700',
          !form.state ? 'text-surface-400' : 'text-surface-900 dark:text-surface-100',
        ]"
        class="w-full appearance-none rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors cursor-pointer"
      >
        <option value="" disabled>Select a state</option>
        <option v-for="state in US_STATES" :key="state" :value="state">{{ state }}</option>
      </select>
      <p v-if="errors.state" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ errors.state }}</p>
    </div>

    <div>
      <label for="zip" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        ZIP / Postal code
      </label>
      <input
        id="zip"
        v-model="form.zip"
        type="text"
        :class="errors.zip ? 'border-danger-300 dark:border-danger-700' : 'border-surface-200 dark:border-surface-700'"
        class="w-full rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
      <p v-if="errors.zip" class="mt-1 text-xs text-danger-600 dark:text-danger-400">{{ errors.zip }}</p>
    </div>

    <div>
      <label for="country" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        Country
      </label>
      <input
        id="country"
        value="United States"
        type="text"
        disabled
        class="w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 px-3 py-2 text-sm text-surface-500 dark:text-surface-400 cursor-not-allowed"
      />
    </div>

    <!-- Success banner -->
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-300"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="submitSuccess" class="flex items-start gap-3 rounded-md border border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-950 p-3 text-sm text-success-700 dark:text-success-400">
        <Check class="size-4 mt-0.5 shrink-0" />
        <span>Address saved successfully.</span>
      </div>
    </Transition>

    <div class="pt-2">
      <button
        :disabled="isSaving"
        class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleSubmit"
      >
        <Loader2 v-if="isSaving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ isSaving ? 'Saving…' : 'Submit' }}
      </button>
    </div>
  </div>
</template>
