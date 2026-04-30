<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'My Profile — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();
const { data: me } = useCabinetMe();

const fields = [
    { label: 'First name', value: computed(() => me.value?.firstName ?? '—') },
    { label: 'Last name',  value: computed(() => me.value?.lastName  ?? '—') },
    { label: 'Email',      value: computed(() => me.value?.email     ?? '—') },
    { label: 'Phone',      value: computed(() => me.value?.phone     ?? '—') },
];

const isLoggingOut = ref(false);
async function logout() {
    isLoggingOut.value = true;
    try {
        await $fetch('/api/cabinet/auth/logout', { method: 'POST' });
    } finally {
        await navigateTo('/cabinet/auth');
    }
}
</script>

<template>
    <div class="flex flex-col gap-5 px-4 py-6 max-w-xl mx-auto">
        <!-- Header -->
        <div class="flex items-center gap-3">
            <div class="flex size-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-xl font-bold text-brand-700 dark:text-brand-300 shrink-0">
                {{ (me?.firstName?.[0] ?? '') + (me?.lastName?.[0] ?? '') || '?' }}
            </div>
            <div>
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">
                    {{ me?.firstName }} {{ me?.lastName }}
                </h1>
                <p class="text-sm text-surface-500 dark:text-surface-400">{{ me?.email }}</p>
            </div>
        </div>

        <!-- Details card -->
        <section class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Personal information</h2>
            </div>
            <dl class="divide-y divide-surface-100 dark:divide-surface-800">
                <div v-for="field in fields" :key="field.label" class="flex items-center justify-between px-4 py-3.5 gap-4">
                    <dt class="text-sm text-surface-500 dark:text-surface-400 shrink-0">{{ field.label }}</dt>
                    <dd class="text-sm font-medium text-surface-900 dark:text-surface-100 text-right truncate">{{ field.value.value }}</dd>
                </div>
            </dl>
        </section>

        <!-- Actions -->
        <section class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Account</h2>
            </div>
            <div class="px-4 py-3.5 flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-surface-900 dark:text-surface-100">Sign out</p>
                    <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">You will need a new sign-in link to access your cabinet again.</p>
                </div>
                <button
                    type="button"
                    :disabled="isLoggingOut"
                    class="shrink-0 flex items-center gap-1.5 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950/40 px-3 py-2 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/40 disabled:opacity-50 transition-colors cursor-pointer"
                    @click="logout"
                >
                    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
                </button>
            </div>
        </section>

    </div>
</template>
