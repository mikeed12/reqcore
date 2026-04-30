<script setup lang="ts">
definePageMeta({
    layout: 'auth',
});

useSeoMeta({
    title: 'Signing in… — Reqcore',
    robots: 'noindex, nofollow',
});

const route = useRoute();
const error = ref('');
const verifying = ref(true);

onMounted(async () => {
    const token = route.query.token as string | undefined;
    if (!token) {
        error.value = 'Invalid sign-in link. Please request a new one.';
        verifying.value = false;
        return;
    }

    try {
        await $fetch('/api/cabinet/auth/verify', {
            method: 'POST',
            body: { token },
        });
        await navigateTo('/cabinet');
    } catch {
        error.value = 'This link is invalid or has already expired. Please request a new one.';
        verifying.value = false;
    }
});
</script>

<template>
    <div class="text-center flex flex-col gap-4">
        <template v-if="verifying">
            <svg class="mx-auto animate-spin size-8 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p class="text-sm text-surface-500 dark:text-surface-400">Signing you in…</p>
        </template>

        <template v-else>
            <div
                class="rounded-md border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-4 text-sm text-danger-700 dark:text-danger-400"
            >
                {{ error }}
            </div>
            <NuxtLink
                to="/cabinet/auth/auth"
                class="text-sm text-brand-600 dark:text-brand-400 hover:underline"
            >
                Back to sign in
            </NuxtLink>
        </template>
    </div>
</template>
