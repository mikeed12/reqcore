<script setup lang="ts">
// Core-only landing page: redirect to dashboard or sign-in.
// When the marketing layer (reqcore-web) is active, its index.vue overrides this.
const localePath = useLocalePath()
const { data: session } = await authClient.useSession(useFetch)

await navigateTo(localePath(session.value?.user ? '/dashboard' : '/auth/sign-in'), { redirectCode: 302 })
</script>
