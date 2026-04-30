<script setup lang="ts">
const route = useRoute()
const { unreadByType } = useCabinetUnread()

const { data: me } = useCabinetMe()

const initials = computed(() => {
    const f = me.value?.firstName?.[0] ?? ''
    const l = me.value?.lastName?.[0] ?? ''
    return (f + l).toUpperCase() || '?'
})

const tabs: Array<{ to: string; label: string; exact: boolean; badgeKey?: 'task' | 'support' | 'chat'; icon: string }> = [
    {
        to: '/cabinet',
        label: 'Home',
        exact: true,
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />`,
    },
    {
        to: '/cabinet/chat',
        label: 'Chats',
        exact: false,
        badgeKey: 'chat',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />`,
    },
    {
        to: '/cabinet/tasks',
        label: 'Tasks',
        exact: false,
        badgeKey: 'task',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />`,
    },
    {
        to: '/cabinet/support',
        label: 'Support',
        exact: false,
        badgeKey: 'support',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 00-1.652 1.306A9.025 9.025 0 004.33 7.288" />`,
    },
    {
        to: '/cabinet/contracts',
        label: 'Contracts',
        exact: false,
        icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />`,
    },
]

function isActive(tab: { to: string; exact: boolean }) {
    if (tab.exact) return route.path === tab.to
    return route.path === tab.to || route.path.startsWith(tab.to + '/')
}

function badgeCount(key?: string) {
    if (!key) return 0
    return unreadByType.value[key as 'task' | 'support' | 'chat'] ?? 0
}

const isProfileActive = computed(() =>
    route.path === '/cabinet/profile' || route.path.startsWith('/cabinet/profile/')
)

// Logout
const loggingOut = ref(false)
async function logout() {
    loggingOut.value = true
    await $fetch('/api/cabinet/auth/logout', { method: 'POST' }).catch(() => {})
    await navigateTo('/cabinet/auth')
}

// Sub-pages that hide the tab bar and show a back button instead
const backRoutes: Record<string, string> = {
    '/cabinet/contract':     '/cabinet',
    '/cabinet/verify':       '/cabinet',
    '/cabinet/support/new':  '/cabinet/support',
}

const showBack  = computed(() => route.path in backRoutes)
const backTo    = computed(() => backRoutes[route.path] ?? '/cabinet')
const backLabel = computed(() => {
    if (route.path === '/cabinet/support/new') return 'Support'
    return 'Back'
})
</script>

<template>
    <div class="flex flex-col bg-surface-50 dark:bg-surface-950" style="height: 100dvh">

        <!-- ── Single header bar ──────────────────────────────────────────────── -->
        <div class="shrink-0 sticky top-0 z-10 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
            <div class="h-14 flex items-stretch max-w-xl mx-auto w-full">

                <!-- Back button (sub-pages) -->
                <template v-if="showBack">
                    <div class="flex flex-1 items-center px-3">
                        <NuxtLink
                            :to="backTo"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                        >
                            <svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            {{ backLabel }}
                        </NuxtLink>
                    </div>
                </template>

                <!-- Tab strip — flush, no outer padding -->
                <template v-else>
                    <div class="flex flex-1 items-stretch">

                        <!-- Icon tabs -->
                        <NuxtLink
                            v-for="tab in tabs"
                            :key="tab.to"
                            :to="tab.to"
                            class="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
                            :class="isActive(tab)
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'"
                        >
                            <div class="relative">
                                <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" v-html="tab.icon" />
                                <span
                                    v-if="tab.badgeKey && badgeCount(tab.badgeKey) > 0"
                                    class="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[15px] h-[15px] rounded-full bg-brand-600 text-white text-[9px] font-bold px-0.5 leading-none"
                                >
                                    {{ badgeCount(tab.badgeKey) > 9 ? '9+' : badgeCount(tab.badgeKey) }}
                                </span>
                            </div>
                            <span class="text-[9px] font-medium leading-none tracking-tight">{{ tab.label }}</span>
                            <span
                                v-if="isActive(tab)"
                                class="absolute bottom-0 inset-x-0.5 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400"
                            />
                        </NuxtLink>

                        <!-- Avatar tab — replaces Profile -->
                        <NuxtLink
                            to="/cabinet/profile"
                            class="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors"
                            :class="isProfileActive
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'"
                        >
                            <div
                                class="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all"
                                :class="isProfileActive
                                    ? 'bg-brand-600 dark:bg-brand-500 text-white'
                                    : 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'"
                            >
                                {{ initials }}
                            </div>
                            <span class="text-[9px] font-medium leading-none tracking-tight">Me</span>
                            <span
                                v-if="isProfileActive"
                                class="absolute bottom-0 inset-x-0.5 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400"
                            />
                        </NuxtLink>

                        <!-- Logout — same tab proportions, red tint -->
                        <button
                            type="button"
                            :disabled="loggingOut"
                            class="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors text-surface-400 dark:text-surface-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 cursor-pointer"
                            title="Log out"
                            @click="logout"
                        >
                            <svg v-if="loggingOut" class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <svg v-else class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                            </svg>
                            <span class="text-[9px] font-medium leading-none tracking-tight">Exit</span>
                        </button>

                    </div>
                </template>

            </div>
        </div>

        <!-- ── Main content ───────────────────────────────────────────────────── -->
        <main class="flex-1 min-h-0 overflow-y-auto">
            <slot />
        </main>
    </div>
</template>
