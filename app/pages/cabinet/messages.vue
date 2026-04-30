<script setup lang="ts">
// Redirect legacy /cabinet/messages → /cabinet/chat
await navigateTo('/cabinet/chat', { replace: true });
</script>
