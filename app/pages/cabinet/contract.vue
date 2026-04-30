<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Sign Contract — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();
const { data: me } = useCabinetMe();

const { data: status, refresh: refreshStatus } = useFetch('/api/cabinet/contract/status', { server: false, lazy: true });

// ─── Signature canvas ────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isSigning = ref(false);   // user is currently drawing
const isEmpty = ref(true);
const isSubmitting = ref(false);
const submitError = ref('');
const success = ref(false);

function getCtx() {
    const canvas = canvasRef.value;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
}

function getPos(canvas: HTMLCanvasElement, e: MouseEvent | Touch) {
    const rect = canvas.getBoundingClientRect();
    // ctx.scale(dpr, dpr) already maps context coords → physical pixels,
    // so we only need CSS-pixel offsets relative to the canvas edge.
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

function startDraw(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const result = getCtx();
    if (!result) return;
    const { canvas, ctx } = result;
    isSigning.value = true;
    isEmpty.value = false;
    const pos = getPos(canvas, 'touches' in e ? e.touches[0] : e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    if (!isSigning.value) return;
    const result = getCtx();
    if (!result) return;
    const { canvas, ctx } = result;
    const pos = getPos(canvas, 'touches' in e ? e.touches[0] : e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function stopDraw() {
    isSigning.value = false;
}

function clearSignature() {
    const result = getCtx();
    if (!result) return;
    const { canvas, ctx } = result;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isEmpty.value = true;
}

function getSignatureDataUrl(): string | null {
    const canvas = canvasRef.value;
    if (!canvas || isEmpty.value) return null;
    return canvas.toDataURL('image/png');
}

async function submitSignature() {
    const dataUrl = getSignatureDataUrl();
    if (!dataUrl) {
        submitError.value = 'Please draw your signature before submitting.';
        return;
    }

    submitError.value = '';
    isSubmitting.value = true;

    try {
        await $fetch('/api/cabinet/contract/sign', {
            method: 'POST',
            body: { signatureDataUrl: dataUrl },
        });
        await refreshStatus();
        success.value = true;
    } catch (e: any) {
        submitError.value = e?.data?.statusMessage ?? 'Signing failed. Please try again.';
    } finally {
        isSubmitting.value = false;
    }
}

// Resize canvas to match its CSS size on mount
onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
});

const contractSections = [
    {
        title: '1. Position and Duties',
        body: 'The Candidate agrees to perform the duties and responsibilities associated with the position as outlined during the recruitment process.',
    },
    {
        title: '2. Commencement',
        body: 'The employment shall commence on the date agreed upon by both parties.',
    },
    {
        title: '3. Compensation',
        body: 'Compensation details, including salary and benefits, will be confirmed in a separate offer letter provided by the Employer.',
    },
    {
        title: '4. Confidentiality',
        body: 'The Candidate agrees to keep confidential all proprietary information, trade secrets, and business data of the Employer during and after the period of employment.',
    },
    {
        title: '5. Termination',
        body: 'Either party may terminate this Agreement with reasonable notice as required by applicable law.',
    },
    {
        title: '6. Governing Law',
        body: 'This Agreement shall be governed by the applicable laws of the jurisdiction in which the Employer operates.',
    },
];

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
</script>

<template>
    <div class="flex flex-col gap-5 px-4 py-6 max-w-xl mx-auto pb-8">

        <!-- Already signed -->
        <template v-if="status?.signed">
            <div class="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-6 flex flex-col items-center gap-3 text-center shadow-sm">
                <span class="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60">
                    <svg class="size-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </span>
                <div>
                    <p class="text-base font-semibold text-green-800 dark:text-green-200">Contract signed</p>
                    <p class="text-sm text-green-600 dark:text-green-400 mt-0.5">
                        Signed by <strong>{{ status.candidateName }}</strong> on
                        {{ new Date(status.signedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                    </p>
                </div>
                <p class="text-xs text-green-600/70 dark:text-green-400/60">The signed PDF has been saved to your documents.</p>
            </div>

            <NuxtLink to="/cabinet" class="text-sm text-brand-600 dark:text-brand-400 hover:underline text-center">
                ← Back to cabinet
            </NuxtLink>
        </template>

        <!-- Contract + signature form -->
        <template v-else>
            <!-- Contract document -->
            <section class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
                <!-- Doc header -->
                <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 text-center">
                    <p class="text-xs font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-1">Agreement</p>
                    <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">Employment Contract</h2>
                    <p class="text-xs text-surface-500 dark:text-surface-400 mt-1">Dated {{ today }}</p>
                </div>

                <!-- Scrollable body -->
                <div class="max-h-[55vh] overflow-y-auto overscroll-contain">
                    <!-- Intro -->
                    <div class="px-5 pt-4 pb-2">
                        <p class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                            This Employment Contract (<strong>"Agreement"</strong>) is entered into as of <strong>{{ today }}</strong>
                            between the Employer and
                            <strong>{{ me?.firstName }} {{ me?.lastName }}</strong> (<strong>"Candidate"</strong>).
                        </p>
                    </div>

                    <!-- Sections -->
                    <div class="divide-y divide-surface-100 dark:divide-surface-800">
                        <div v-for="section in contractSections" :key="section.title" class="px-5 py-4">
                            <p class="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-1">{{ section.title }}</p>
                            <p class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{{ section.body }}</p>
                        </div>
                    </div>
                </div>

                <!-- Signature block intro -->
                <div class="px-5 py-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/40">
                    <p class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                        By signing below, you confirm that you have read, understood, and agreed to all terms set out in this Agreement.
                    </p>
                </div>
            </section>

            <!-- Signature pad -->
            <section class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
                <div class="px-5 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between">
                    <div>
                        <p class="text-sm font-semibold text-surface-900 dark:text-surface-100">Your signature</p>
                        <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Draw your signature in the box below</p>
                    </div>
                    <button
                        v-if="!isEmpty"
                        type="button"
                        class="text-xs text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 underline cursor-pointer transition-colors"
                        @click="clearSignature"
                    >
                        Clear
                    </button>
                </div>

                <!-- Canvas -->
                <div class="p-4">
                    <div
                        class="relative rounded-xl border-2 border-dashed transition-colors overflow-hidden"
                        :class="isSigning
                            ? 'border-brand-400 dark:border-brand-600'
                            : 'border-surface-300 dark:border-surface-700'"
                    >
                        <canvas
                            ref="canvasRef"
                            class="w-full touch-none block"
                            style="height: 140px; cursor: crosshair;"
                            @mousedown="startDraw"
                            @mousemove="draw"
                            @mouseup="stopDraw"
                            @mouseleave="stopDraw"
                            @touchstart="startDraw"
                            @touchmove="draw"
                            @touchend="stopDraw"
                        />
                        <!-- Placeholder hint -->
                        <div
                            v-if="isEmpty"
                            class="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                            <p class="text-sm text-surface-400 dark:text-surface-600 select-none">Sign here</p>
                        </div>
                        <!-- Baseline -->
                        <div class="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-surface-200 dark:border-surface-700" />
                    </div>
                </div>

                <!-- Error -->
                <div v-if="submitError" class="mx-4 mb-3 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-950/40 px-4 py-2.5 text-xs text-danger-700 dark:text-danger-400">
                    {{ submitError }}
                </div>

                <!-- Submit -->
                <div class="px-4 pb-4">
                    <button
                        type="button"
                        :disabled="isEmpty || isSubmitting"
                        class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                        @click="submitSignature"
                    >
                        <svg v-if="isSubmitting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        {{ isSubmitting ? 'Signing contract…' : 'Sign & Submit Contract' }}
                    </button>
                    <p class="text-xs text-surface-400 dark:text-surface-500 text-center mt-2">
                        A signed PDF copy will be saved to your documents.
                    </p>
                </div>
            </section>
        </template>
    </div>
</template>
