<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useSeoMeta({ robots: 'noindex, nofollow' })

const localePath = useLocalePath()

onMounted(async () => {
  try {
    // Single server-side call: checks demo status AND signs out if needed.
    // The server deletes the session from the DB and clears auth cookies
    // via Set-Cookie headers — no client-side sign-out quirks.
    const { action } = await $fetch('/api/auth/demo-fresh-signup', { method: 'POST' })

    if (action === 'dashboard') {
      window.location.href = localePath('/dashboard')
    }
    else {
      window.location.href = localePath('/auth/sign-up')
    }
  }
  catch {
    // On any error, default to sign-up
    window.location.href = localePath('/auth/sign-up')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <p class="text-sm text-surface-500 dark:text-surface-400">Redirecting…</p>
  </div>
</template>
