<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Dashboard — Reqcore', robots: 'noindex, nofollow' });

// ─── Placeholder employee data ────────────────────────────────────────────────

const employee = {
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'Product Designer',
    department: 'Design & UX',
    employeeId: 'EMP-2847',
    startDate: 'March 12, 2022',
    manager: 'James Ortega',
    location: 'London, UK',
}

const stats = [
    { label: 'Days Employed', value: '763', icon: 'calendar', color: 'brand' },
    { label: 'Vacation Left', value: '12 days', icon: 'sun', color: 'amber' },
    { label: 'Tasks This Week', value: '5 / 8', icon: 'check', color: 'green' },
    { label: 'Performance', value: '4.8 ★', icon: 'star', color: 'purple' },
]

const upcoming = [
    { title: 'Submit Q2 design brief', date: 'Today', tag: 'Task', tagColor: 'purple' },
    { title: 'Team sync — Design chapter', date: 'Tomorrow, 10:00', tag: 'Meeting', tagColor: 'blue' },
    { title: 'Performance review with James', date: 'Fri, 14:00', tag: 'Meeting', tagColor: 'blue' },
    { title: 'Onboarding deck revision', date: 'Next Mon', tag: 'Task', tagColor: 'purple' },
]

const recentActivity = [
    { text: 'James Ortega sent you a task', sub: '2 hours ago', type: 'task' },
    { text: 'Your support ticket #204 was resolved', sub: 'Yesterday', type: 'support' },
    { text: 'Contract updated by HR', sub: '3 days ago', type: 'contract' },
    { text: 'Welcome bonus processed', sub: '1 week ago', type: 'payroll' },
]

const tagColor: Record<string, string> = {
    purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    blue:   'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
    amber:  'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
    green:  'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
}

const statColor: Record<string, string> = {
    brand:  'bg-brand-50  dark:bg-brand-950/40  text-brand-600  dark:text-brand-400',
    amber:  'bg-amber-50  dark:bg-amber-950/40  text-amber-600  dark:text-amber-400',
    green:  'bg-green-50  dark:bg-green-950/40  text-green-600  dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
}

const activityIcon: Record<string, string> = {
    task:     'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    support:  'bg-amber-100  dark:bg-amber-900/40  text-amber-600  dark:text-amber-400',
    contract: 'bg-blue-100   dark:bg-blue-900/40   text-blue-600   dark:text-blue-400',
    payroll:  'bg-green-100  dark:bg-green-900/40  text-green-600  dark:text-green-400',
}
</script>

<template>
    <div class="max-w-xl mx-auto px-4 py-6 pb-10 flex flex-col gap-6">

        <!-- ── Greeting & identity ────────────────────────────────────────────── -->
        <div class="flex items-center gap-4">
            <div
                class="flex size-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md select-none"
                style="background: linear-gradient(135deg, hsl(220,70%,55%), hsl(270,60%,55%))"
            >
                {{ employee.firstName[0] }}{{ employee.lastName[0] }}
            </div>
            <div class="min-w-0">
                <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100 leading-tight">
                    Good morning, {{ employee.firstName }} 👋
                </h1>
                <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{{ employee.role }} · {{ employee.department }}</p>
            </div>
        </div>

        <!-- ── Stats row ──────────────────────────────────────────────────────── -->
        <div class="grid grid-cols-2 gap-3">
            <div
                v-for="stat in stats"
                :key="stat.label"
                class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4 shadow-sm flex flex-col gap-1"
            >
                <span class="text-xs font-medium text-surface-500 dark:text-surface-400">{{ stat.label }}</span>
                <span class="text-2xl font-bold" :class="statColor[stat.color].split(' ').slice(2).join(' ')">
                    {{ stat.value }}
                </span>
            </div>
        </div>

        <!-- ── Upcoming ───────────────────────────────────────────────────────── -->
        <section>
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 px-0.5">Upcoming</h2>
            <div class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden divide-y divide-surface-100 dark:divide-surface-800">
                <div
                    v-for="item in upcoming"
                    :key="item.title"
                    class="flex items-center gap-3 px-4 py-3"
                >
                    <!-- Colored left bar -->
                    <div class="w-1 h-8 rounded-full shrink-0" :class="item.tag === 'Task' ? 'bg-purple-400' : 'bg-blue-400'" />
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{{ item.title }}</p>
                        <p class="text-xs text-surface-400 mt-0.5">{{ item.date }}</p>
                    </div>
                    <span class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" :class="tagColor[item.tagColor]">
                        {{ item.tag }}
                    </span>
                </div>
            </div>
        </section>

        <!-- ── Quick actions ──────────────────────────────────────────────────── -->
        <section>
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 px-0.5">Quick Access</h2>
            <div class="grid grid-cols-2 gap-3">

                <NuxtLink to="/cabinet/tasks" class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all group">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40">
                        <svg class="size-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                    </span>
                    <span class="text-sm font-semibold text-surface-800 dark:text-surface-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">My Tasks</span>
                </NuxtLink>

                <NuxtLink to="/cabinet/contract" class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                        <svg class="size-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                    </span>
                    <span class="text-sm font-semibold text-surface-800 dark:text-surface-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Contract</span>
                </NuxtLink>

                <NuxtLink to="/cabinet/chat" class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all group">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40">
                        <svg class="size-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                    </span>
                    <span class="text-sm font-semibold text-surface-800 dark:text-surface-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">Messages</span>
                </NuxtLink>

                <NuxtLink to="/cabinet/support/new" class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3.5 shadow-sm hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all group">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                        <svg class="size-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 00-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 010 9.424m-4.138-5.976a3.736 3.736 0 00-.88-1.388 3.737 3.737 0 00-1.388-.88m2.268 2.268a3.765 3.765 0 010 2.528m-2.268-4.796a3.765 3.765 0 00-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 01-1.388.88m2.268-2.268l4.138 3.448m0 0a9.027 9.027 0 01-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0l-3.448-4.138m3.448 4.138a9.014 9.014 0 01-9.424 0m5.976-4.138a3.765 3.765 0 01-2.528 0m0 0a3.736 3.736 0 01-1.388-.88 3.737 3.737 0 01-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 01-1.652-1.306 9.027 9.027 0 01-1.306-1.652m0 0l4.138-3.448M4.33 16.712a9.014 9.014 0 010-9.424m4.138 5.976a3.765 3.765 0 010-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 011.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 00-1.652 1.306A9.025 9.025 0 004.33 7.288" />
                        </svg>
                    </span>
                    <span class="text-sm font-semibold text-surface-800 dark:text-surface-200 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">Get Help</span>
                </NuxtLink>

            </div>
        </section>

        <!-- ── Recent activity ────────────────────────────────────────────────── -->
        <section>
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 px-0.5">Recent Activity</h2>
            <div class="flex flex-col gap-2">
                <div
                    v-for="item in recentActivity"
                    :key="item.text"
                    class="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3 shadow-sm"
                >
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-xl" :class="activityIcon[item.type]">
                        <!-- task -->
                        <svg v-if="item.type === 'task'" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                        </svg>
                        <!-- support -->
                        <svg v-else-if="item.type === 'support'" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        <!-- contract -->
                        <svg v-else-if="item.type === 'contract'" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <!-- payroll -->
                        <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                        </svg>
                    </span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-surface-800 dark:text-surface-200 leading-snug">{{ item.text }}</p>
                        <p class="text-xs text-surface-400 mt-0.5">{{ item.sub }}</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── Employee details ───────────────────────────────────────────────── -->
        <section class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">Your Details</h2>
            </div>
            <dl class="divide-y divide-surface-100 dark:divide-surface-800">
                <div v-for="[label, value] in [
                    ['Employee ID', employee.employeeId],
                    ['Department', employee.department],
                    ['Manager', employee.manager],
                    ['Location', employee.location],
                    ['Start Date', employee.startDate],
                ]" :key="label" class="flex items-center justify-between px-4 py-2.5">
                    <dt class="text-xs text-surface-400">{{ label }}</dt>
                    <dd class="text-sm font-medium text-surface-800 dark:text-surface-200">{{ value }}</dd>
                </div>
            </dl>
        </section>

    </div>
</template>
