<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Home — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();
const { data: me } = useCabinetMe();

const { data: kycStatus }      = useFetch('/api/cabinet/kyc/status',      { server: false, lazy: true });
const { data: contractStatus } = useFetch('/api/cabinet/contract/status', { server: false, lazy: true });

const jobTypeLabel: Record<string, string> = {
    full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship',
};
function formatDate(d: string | Date) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<template>
    <div class="flex flex-col gap-5 px-4 py-6 max-w-xl mx-auto pb-8">

        <!-- Greeting -->
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Hi, {{ me?.firstName }} 👋</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400">{{ me?.email }}</p>
        </div>

        <!-- ── Verification status card ──────────────────────────────────────── -->
        <NuxtLink
            v-if="!kycStatus?.allDone"
            to="/cabinet/verify"
            class="rounded-2xl border shadow-sm flex items-center gap-4 px-4 py-4 transition-colors"
            :class="kycStatus?.allDone
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 hover:bg-green-100/60 dark:hover:bg-green-950/60'
                : 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100/60 dark:hover:bg-amber-950/50'"
        >
            <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full"
                :class="kycStatus?.allDone ? 'bg-green-100 dark:bg-green-900/60' : 'bg-amber-100 dark:bg-amber-900/60'"
            >
                <svg v-if="kycStatus?.allDone" class="size-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg v-else class="size-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                </svg>
            </span>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold" :class="kycStatus?.allDone ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'">
                    Identity Verification
                </p>
                <p class="text-xs mt-0.5" :class="kycStatus?.allDone ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">
                    {{ kycStatus?.allDone ? 'All documents submitted ✓' : 'Action required — upload your documents' }}
                </p>
            </div>
            <svg class="size-4 shrink-0" :class="kycStatus?.allDone ? 'text-green-400 dark:text-green-600' : 'text-amber-400 dark:text-amber-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
        </NuxtLink>

        <!-- ── Contract card ─────────────────────────────────────────────────── -->
        <NuxtLink
            v-if="!contractStatus?.signed"
            to="/cabinet/contract"
            class="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-sm flex items-center gap-4 px-4 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors"
        >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800">
                <svg class="size-5 text-surface-500 dark:text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </span>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-surface-800 dark:text-surface-200">Employment Contract</p>
                <p class="text-xs mt-0.5 text-surface-500 dark:text-surface-400">View your contract details</p>
            </div>
            <svg class="size-4 shrink-0 text-surface-400 dark:text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
        </NuxtLink>

        <!-- ── Applications ───────────────────────────────────────────────────── -->
        <section>
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2.5 px-0.5">Your applications</h2>

            <div v-if="!me?.applications?.length" class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-8 text-center text-sm text-surface-500 dark:text-surface-400">
                No applications found.
            </div>

            <ul v-else class="flex flex-col gap-2.5">
                <li
                    v-for="app in me.applications"
                    :key="app.id"
                    class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4 flex flex-col gap-1.5 shadow-sm"
                >
                    <span class="font-semibold text-sm text-surface-900 dark:text-surface-100">{{ app.jobTitle }}</span>
                    <span class="text-xs text-surface-500 dark:text-surface-400">{{ app.organizationName }}</span>
                    <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                        <span v-if="app.jobLocation">{{ app.jobLocation }}</span>
                        <span v-if="app.jobType">{{ jobTypeLabel[app.jobType] ?? app.jobType }}</span>
                        <span>Applied {{ formatDate(app.createdAt) }}</span>
                    </div>
                </li>
            </ul>
        </section>

        <!-- ── Your details ───────────────────────────────────────────────────── -->
        <section class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4 shadow-sm">
            <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">Your details</h2>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt class="text-surface-400">Name</dt>
                <dd class="text-surface-900 dark:text-surface-100 font-medium">{{ me?.firstName }} {{ me?.lastName }}</dd>
                <dt class="text-surface-400">Email</dt>
                <dd class="text-surface-900 dark:text-surface-100 break-all">{{ me?.email }}</dd>
                <template v-if="me?.phone">
                    <dt class="text-surface-400">Phone</dt>
                    <dd class="text-surface-900 dark:text-surface-100">{{ me.phone }}</dd>
                </template>
            </dl>
        </section>
    </div>
</template>
