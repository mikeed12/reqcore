<script setup lang="ts">
definePageMeta({
    layout: 'auth',
});

useSeoMeta({
    title: 'Candidate Sign In — Reqcore',
    robots: 'noindex, nofollow',
});

const email = ref('');
const submitted = ref(false);
const error = ref('');
const isLoading = ref(false);

async function handleSubmit() {
    error.value = '';
    if (!email.value) {
        error.value = 'Please enter your email address.';
        return;
    }

    isLoading.value = true;
    try {
        await $fetch('/api/cabinet/auth/request-link', {
            method: 'POST',
            body: { email: email.value },
        });
        submitted.value = true;
    } catch {
        error.value = 'Something went wrong. Please try again.';
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div>
        <div v-if="!submitted" class="flex flex-col gap-4">
            <div class="text-center mb-2">
                <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100">
                    Access your application status
                </h2>
                <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    Enter your email and we'll send you a sign-in link.
                </p>
            </div>

            <div
                v-if="error"
                class="rounded-md border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950 p-3 text-sm text-danger-700 dark:text-danger-400"
            >
                {{ error }}
            </div>

            <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
                <label class="flex flex-col gap-1 text-sm font-medium text-surface-700 dark:text-surface-300">
                    <span>Email address</span>
                    <input
                        v-model="email"
                        type="email"
                        autocomplete="email"
                        required
                        placeholder="you@example.com"
                        class="px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md text-sm text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                    />
                </label>

                <button
                    type="submit"
                    :disabled="isLoading"
                    class="mt-2 px-4 py-2.5 bg-brand-600 text-white rounded-md text-sm font-medium cursor-pointer hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {{ isLoading ? 'Sending…' : 'Send sign-in link' }}
                </button>
            </form>
        </div>

        <div v-else class="text-center flex flex-col gap-3">
            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                <svg class="size-6 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            </div>
            <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-100">Check your inbox</h2>
            <p class="text-sm text-surface-500 dark:text-surface-400">
                We sent a sign-in link to <strong class="text-surface-700 dark:text-surface-300">{{ email }}</strong>.<br />
                The link expires in 15 minutes.
            </p>
            <button
                class="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-2 cursor-pointer"
                @click="submitted = false"
            >
                Use a different email
            </button>
        </div>
    </div>
</template>
