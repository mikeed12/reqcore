<template>
  <div class="px-5 pb-6">
    <button
        v-if="state === CALL_STATES.EXTENSIONS_LOADING"
        type="button"
        disabled
        class="w-full cursor-not-allowed rounded-2xl bg-slate-300 px-4 py-4 text-base font-semibold text-white"
    >
      Loading...
    </button>

    <div v-else-if="state === CALL_STATES.ERROR" class="grid grid-cols-2 gap-3">
      <button
          @click="$emit('dismiss')"
          type="button"
          class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Dismiss
      </button>

      <button
          @click="$emit('retry')"
          type="button"
          class="rounded-2xl bg-brand-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-brand-700"
      >
        Retry
      </button>
    </div>

    <div v-else-if="state === CALL_STATES.INCOMING" class="grid grid-cols-2 gap-3">
      <button
          @click="$emit('decline')"
          type="button"
          class="rounded-2xl bg-rose-500 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600"
      >
        Decline
      </button>

      <button
          @click="$emit('accept')"
          type="button"
          class="rounded-2xl bg-emerald-500 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
      >
        Accept
      </button>
    </div>

    <button
        v-else-if="state === CALL_STATES.CALLING"
        @click="$emit('end-call')"
        type="button"
        class="w-full rounded-2xl bg-rose-500 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600"
    >
      End Call
    </button>

    <button
        v-else
        @click="$emit('start-call')"
        type="button"
        :disabled="!canStartCall"
        class="w-full rounded-2xl px-4 py-4 text-base font-semibold text-white shadow-lg transition"
        :class="canStartCall
        ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
        : 'cursor-not-allowed bg-slate-300 shadow-transparent'"
    >
      Start Call
    </button>
  </div>
</template>

<script setup>
defineProps({
  state: { type: String, required: true },
  CALL_STATES: { type: Object, required: true },
  canStartCall: { type: Boolean, default: false },
})

defineEmits([
  'dismiss',
  'retry',
  'decline',
  'accept',
  'end-call',
  'start-call',
])
</script>