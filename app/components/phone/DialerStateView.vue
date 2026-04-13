<template>
  <div class="px-5 py-8 text-center">
    <template v-if="state === CALL_STATES.EXTENSIONS_LOADING">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
        ⏳
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">Loading extensions</h3>
      <p class="mt-1 text-sm text-slate-500">
        Please wait until phone extensions are available
      </p>
    </template>

    <template v-else-if="state === CALL_STATES.EXTENSION_CONNECTING">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
        ☎️
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">
        Connecting extension
      </h3>
      <p class="mt-1 text-sm text-slate-500">
        Please wait while the selected extension is getting ready
      </p>
    </template>

    <template v-else-if="state === CALL_STATES.ERROR">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl">
        ⚠️
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">Something went wrong</h3>
      <p class="mt-1 text-sm text-slate-500">
        {{ errorMessage || 'Unable to initialize softphone or complete the call' }}
      </p>
    </template>

    <template v-else-if="state === CALL_STATES.INCOMING">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
        📲
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">Incoming call</h3>
      <p class="mt-1 text-sm font-medium text-slate-700">
        {{ incomingCallerName || 'Unknown caller' }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        {{ incomingCallerNumber || 'No number' }}
      </p>
    </template>

    <template v-else-if="state === CALL_STATES.CALLING">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
        📞
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">Calling...</h3>
      <p class="mt-1 text-sm font-medium text-slate-700">
        {{ phone || 'No number entered' }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        From extension {{ selectedExtensionLabel || '—' }}
      </p>
    </template>

    <template v-else>
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        📞
      </div>
      <h3 class="mt-4 text-base font-semibold text-slate-900">No active call</h3>
      <p class="mt-1 text-sm text-slate-500">
        Select extension and enter a number
      </p>
    </template>
  </div>
</template>

<script setup>
defineProps({
  state: { type: String, required: true },
  CALL_STATES: { type: Object, required: true },
  phone: { type: String, default: '' },
  selectedExtensionLabel: { type: String, default: '' },
  incomingCallerName: { type: String, default: '' },
  incomingCallerNumber: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
})
</script>