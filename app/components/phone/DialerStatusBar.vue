<template>
  <div class="px-5 pt-4">
    <div
        class="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
        :class="boxClass"
    >
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full" :class="dotClass"></span>
        <span class="font-medium">{{ title }}</span>
      </div>

      <span v-if="showDuration" class="text-xs font-semibold">
        {{ duration }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  boxClass: { type: String, required: true },
  dotClass: { type: String, required: true },
  duration: { type: String, default: '' },
  showDuration: { type: Boolean, default: false },
})
</script>