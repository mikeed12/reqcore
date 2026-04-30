<script setup lang="ts">
import {
  Minus, X, Maximize2, SendHorizonal, Loader2, ChevronDown,
} from 'lucide-vue-next'

const {
  isOpen, isMinimized,
  mailboxId, to, cc, subject, body, inReplyTo, references, showCc,
  close, toggleMinimize,
} = useMailCompose()

// ─── Mailboxes ────────────────────────────────────────────────────────────────

interface Mailbox {
  id: string
  label: string
  email: string
  assignments: { userId: string }[]
}

const { data: session } = await authClient.useSession(useFetch)
const currentUserId = computed(() => session.value?.user?.id)

const mailboxes = ref<Mailbox[]>([])

async function loadMailboxes() {
  if (!currentUserId.value) return
  try {
    const all = await $fetch<Mailbox[]>('/api/mailboxes')
    mailboxes.value = all.filter(mb =>
      mb.assignments.some(a => a.userId === currentUserId.value),
    )
    // default to first mailbox if none set
    if (!mailboxId.value && mailboxes.value.length) {
      mailboxId.value = mailboxes.value[0]!.id
    }
  } catch {}
}

watch(isOpen, (v) => { if (v) loadMailboxes() }, { immediate: true })

// ─── Send ─────────────────────────────────────────────────────────────────────

const sending = ref(false)
const sendError = ref('')

async function send() {
  if (!mailboxId.value || !to.value.trim() || !subject.value.trim()) return
  sending.value = true
  sendError.value = ''
  try {
    await $fetch('/api/mail/send', {
      method: 'POST',
      body: {
        mailboxId:  mailboxId.value,
        to:         to.value.split(',').map((s: string) => s.trim()).filter(Boolean),
        cc:         cc.value ? cc.value.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        subject:    subject.value,
        text:       body.value,
        inReplyTo:  inReplyTo.value,
        references: references.value,
      },
    })
    close()
  } catch (e: any) {
    sendError.value = e?.data?.statusMessage ?? e?.message ?? 'Failed to send'
  } finally {
    sending.value = false
  }
}

const title = computed(() =>
  subject.value
    ? (subject.value.length > 28 ? subject.value.slice(0, 28) + '…' : subject.value)
    : 'New message',
)

const canSend = computed(() =>
  !!mailboxId.value && to.value.trim().length > 0 && subject.value.trim().length > 0,
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="isOpen"
        class="fixed bottom-0 right-6 z-[60] w-[26rem] flex flex-col rounded-t-2xl shadow-2xl shadow-surface-900/20 dark:shadow-surface-950/60 border border-b-0 border-surface-200 dark:border-surface-700 overflow-hidden"
        style="max-height: 560px"
      >
        <!-- Header -->
        <div
          class="flex items-center gap-2 px-4 py-3 bg-surface-900 dark:bg-surface-800 cursor-pointer select-none"
          @click="toggleMinimize"
        >
          <span class="flex-1 text-[13px] font-semibold text-white truncate">
            {{ title }}
          </span>
          <button
            class="flex items-center justify-center size-6 rounded-lg text-surface-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            :title="isMinimized ? 'Expand' : 'Minimize'"
            @click.stop="toggleMinimize"
          >
            <Maximize2 v-if="isMinimized" class="size-3.5" />
            <Minus v-else class="size-3.5" />
          </button>
          <button
            class="flex items-center justify-center size-6 rounded-lg text-surface-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            title="Close"
            @click.stop="close"
          >
            <X class="size-3.5" />
          </button>
        </div>

        <!-- Body (hidden when minimized) -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="!isMinimized" class="flex flex-col flex-1 bg-white dark:bg-surface-900 overflow-hidden">

            <!-- Fields -->
            <div class="flex flex-col divide-y divide-surface-100 dark:divide-surface-800">
              <!-- From -->
              <div class="flex items-center gap-2 px-4 py-2">
                <span class="text-[11px] font-semibold text-surface-400 dark:text-surface-500 w-10 shrink-0">From</span>
                <select
                  v-model="mailboxId"
                  class="flex-1 bg-transparent text-sm text-surface-800 dark:text-surface-200 focus:outline-none cursor-pointer"
                >
                  <option v-for="mb in mailboxes" :key="mb.id" :value="mb.id">
                    {{ mb.label || mb.email }}
                  </option>
                </select>
              </div>

              <!-- To -->
              <div class="flex items-center gap-2 px-4 py-2">
                <span class="text-[11px] font-semibold text-surface-400 dark:text-surface-500 w-10 shrink-0">To</span>
                <input
                  v-model="to"
                  type="text"
                  placeholder="recipient@example.com"
                  class="flex-1 bg-transparent text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none"
                />
                <button
                  v-if="!showCc"
                  class="text-[11px] text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer border-0 bg-transparent shrink-0 font-medium"
                  @click.stop="showCc = true"
                >
                  Cc
                </button>
              </div>

              <!-- Cc -->
              <div v-if="showCc" class="flex items-center gap-2 px-4 py-2">
                <span class="text-[11px] font-semibold text-surface-400 dark:text-surface-500 w-10 shrink-0">Cc</span>
                <input
                  v-model="cc"
                  type="text"
                  placeholder="cc@example.com"
                  class="flex-1 bg-transparent text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none"
                />
              </div>

              <!-- Subject -->
              <div class="flex items-center gap-2 px-4 py-2">
                <span class="text-[11px] font-semibold text-surface-400 dark:text-surface-500 w-10 shrink-0">Subj</span>
                <input
                  v-model="subject"
                  type="text"
                  placeholder="Subject"
                  class="flex-1 bg-transparent text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 focus:outline-none"
                />
              </div>
            </div>

            <!-- Body -->
            <textarea
              v-model="body"
              placeholder="Write your message…"
              class="flex-1 resize-none px-4 py-3 text-sm text-surface-800 dark:text-surface-200 placeholder:text-surface-400 bg-transparent focus:outline-none min-h-[180px]"
            />

            <!-- Error -->
            <p v-if="sendError" class="px-4 pb-2 text-xs text-rose-600 dark:text-rose-400">{{ sendError }}</p>

            <!-- Footer -->
            <div class="flex items-center justify-between px-4 py-3 border-t border-surface-100 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900">
              <button
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer border-0 shadow-sm shadow-brand-600/20"
                :disabled="sending || !canSend"
                @click="send"
              >
                <Loader2 v-if="sending" class="size-3.5 animate-spin" />
                <SendHorizonal v-else class="size-3.5" />
                {{ sending ? 'Sending…' : 'Send' }}
              </button>
              <button
                class="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer border-0 bg-transparent transition-colors"
                title="Discard"
                @click="close"
              >
                <X class="size-4" />
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
