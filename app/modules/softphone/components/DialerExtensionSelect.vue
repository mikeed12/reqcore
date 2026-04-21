<template>
  <div class="px-5 pb-4">
    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Extension
      </label>

      <select
          :value="modelValue"
          :disabled="disabled"
          class="w-full rounded-xl border-none bg-transparent text-sm font-medium text-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          @change="$emit('update:modelValue', $event.target.value)"
      >
        <option value="">Select extension</option>
        <option
            v-for="extension in extensions"
            :key="extension.id"
            :value="extension.id"
        >
          {{ extension.name }} · {{ extension.number }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  extensions: { type: Array, default: () => [] },
})

defineEmits(['update:modelValue'])
</script>