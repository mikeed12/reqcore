<template>
  <div class="px-5 pb-4">
    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <input
          :value="modelValue"
          :disabled="disabled"
          type="text"
          placeholder="+1 555 000 0000"
          class="w-full border-none bg-transparent text-center text-lg font-medium tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          @input="$emit('update:modelValue', $event.target.value)"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>