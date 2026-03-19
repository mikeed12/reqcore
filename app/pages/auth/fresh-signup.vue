<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useSeoMeta({ robots: 'noindex, nofollow' })

const localePath = useLocalePath()
const config = useRuntimeConfig()

onMounted(async () => {
  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    // Not logged in — just go to sign-up
    await navigateTo(localePath('/auth/sign-up'), { replace: true })
    return
  }

  // Check if the user is in the demo org
  const demoSlug = config.public.demoOrgSlug
  const activeOrgState = authClient.useActiveOrganization()
  const isDemo = demoSlug && activeOrgState.value?.data?.slug === demoSlug

  if (isDemo) {
    // Demo user — sign out and redirect to sign-up for a real account
    await authClient.signOut()
    clearNuxtData()
    await navigateTo(localePath('/auth/sign-up'), { replace: true })
  }
  else {
    // Real user — don't sign out, redirect to dashboard
    await navigateTo(localePath('/dashboard'), { replace: true })
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <p class="text-sm text-surface-500 dark:text-surface-400">Redirecting…</p>
  </div>
</template>
