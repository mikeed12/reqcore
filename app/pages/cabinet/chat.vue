<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Chats — Reqcore', robots: 'noindex, nofollow' });
useCabinetAuth();
</script>

<template>
  <LazyCabinetConversations type="chat" />
</template>
