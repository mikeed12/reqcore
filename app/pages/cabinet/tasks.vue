<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Tasks — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();
</script>

<template>
  <LazyCabinetConversations type="task" />
</template>
