<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'New Support Ticket — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();

const title = ref('');
const message = ref('');
const submitting = ref(false);
const submitError = ref('');

const canSubmit = computed(() => title.value.trim().length > 0 && message.value.trim().length > 0);

async function submit() {
    if (!canSubmit.value || submitting.value) return;
    submitting.value = true;
    submitError.value = '';
    try {
        const { id } = await $fetch<{ id: string }>('/api/cabinet/messages/conversations', {
            method: 'POST',
            body: {
                type: 'support',
                title: title.value.trim(),
                initialMessage: message.value.trim(),
            },
        });
        await navigateTo('/cabinet/support');
    } catch (e: any) {
        submitError.value = e?.data?.statusMessage ?? 'Something went wrong. Please try again.';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">

        <!-- Title -->
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Open a Support Ticket</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">Describe your issue and we'll get back to you shortly.</p>
        </div>

        <!-- Form card -->
        <div class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm overflow-hidden">

            <!-- Subject -->
            <div class="px-5 pt-5 pb-4 border-b border-surface-100 dark:border-surface-800">
                <label class="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">
                    Subject
                </label>
                <input
                    v-model="title"
                    type="text"
                    maxlength="200"
                    placeholder="e.g. Question about my application status"
                    class="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    @keydown.enter.prevent
                />
                <p class="text-[10px] text-surface-400 mt-1.5 text-right">{{ title.length }}/200</p>
            </div>

            <!-- Message -->
            <div class="px-5 pt-4 pb-5">
                <label class="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-2">
                    Message
                </label>
                <textarea
                    v-model="message"
                    rows="6"
                    maxlength="5000"
                    placeholder="Describe your issue in detail…"
                    class="w-full resize-none rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <p class="text-[10px] text-surface-400 mt-1.5 text-right">{{ message.length }}/5000</p>
            </div>
        </div>

        <!-- Error -->
        <p v-if="submitError" class="text-sm text-red-600 dark:text-red-400 -mt-2 px-1">{{ submitError }}</p>

        <!-- Submit -->
        <button
            type="button"
            :disabled="!canSubmit || submitting"
            class="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            @click="submit"
        >
            <svg v-if="submitting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            {{ submitting ? 'Sending…' : 'Send Ticket' }}
        </button>

    </div>
</template>
