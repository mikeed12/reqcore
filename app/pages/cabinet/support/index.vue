<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Support — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();
</script>

<template>
  <LazyCabinetConversations type="support" />
</template>
