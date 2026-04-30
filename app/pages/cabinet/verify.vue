<script setup lang="ts">
definePageMeta({ layout: 'cabinet' });
useSeoMeta({ title: 'Identity Verification — Reqcore', robots: 'noindex, nofollow' });

useCabinetAuth();

const { data: kycStatus, refresh: refreshKyc } = useFetch('/api/cabinet/kyc/status', { server: false, lazy: true });

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStep = 'front' | 'back' | 'selfie';

interface StepDef {
    key: KycStep;
    label: string;
    sublabel: string;
    hint: string;
    cameraFacing: 'environment' | 'user';
}

const steps: StepDef[] = [
    { key: 'front',  label: 'Front of ID', sublabel: 'Government-issued photo ID',     hint: 'Place your ID on a flat surface in good light. All corners must be visible.', cameraFacing: 'environment' },
    { key: 'back',   label: 'Back of ID',  sublabel: 'Reverse side of the same document', hint: 'Flip the same document over.',                                              cameraFacing: 'environment' },
    { key: 'selfie', label: 'Selfie',      sublabel: 'Photo of your face',              hint: 'Look straight at the camera. Make sure your face is fully visible.',          cameraFacing: 'user' },
];

// ─── State ────────────────────────────────────────────────────────────────────

const activeStep  = ref<KycStep | null>(null);
const stepMode    = ref<Record<KycStep, 'choose' | 'upload' | 'camera'>>({ front: 'choose', back: 'choose', selfie: 'choose' });
const isDragging  = ref<Record<KycStep, boolean>>({ front: false, back: false, selfie: false });
const localPreview = ref<Record<KycStep, string | null>>({ front: null, back: null, selfie: null });
const uploading   = ref<KycStep | null>(null);
const kycError    = ref<Partial<Record<KycStep, string>>>({});

const fileInputRef   = ref<Record<KycStep, HTMLInputElement | null>>({ front: null, back: null, selfie: null });
const cameraInputRef = ref<Record<KycStep, HTMLInputElement | null>>({ front: null, back: null, selfie: null });

function stepDone(key: KycStep) {
    return !!(kycStatus.value as any)?.[key]?.done;
}

function openStep(key: KycStep) {
    activeStep.value = activeStep.value === key ? null : key;
    stepMode.value[key] = 'choose';
}

function selectMode(step: KycStep, mode: 'upload' | 'camera') {
    stepMode.value[step] = mode;
    if (mode === 'camera') nextTick(() => cameraInputRef.value[step]?.click());
}

// ─── Upload ───────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFile(step: KycStep, file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { kycError.value[step] = 'Please upload a JPEG, PNG, or WebP image.'; return; }
    if (file.size > 10 * 1024 * 1024)  { kycError.value[step] = 'File too large. Maximum is 10 MB.'; return; }

    kycError.value[step] = '';
    uploading.value = step;
    localPreview.value[step] = await fileToDataUrl(file);

    const form = new FormData();
    form.append('file', file);
    form.append('step', step);

    try {
        await $fetch('/api/cabinet/kyc/upload', { method: 'POST', body: form });
        await refreshKyc();
        activeStep.value = null;
    } catch (e: any) {
        kycError.value[step] = e?.data?.statusMessage ?? 'Upload failed. Please try again.';
        localPreview.value[step] = null;
    } finally {
        uploading.value = null;
    }
}

function onFileInput(step: KycStep, e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) uploadFile(step, file);
    (e.target as HTMLInputElement).value = '';
}

function onDragOver(step: KycStep, e: DragEvent) { e.preventDefault(); isDragging.value[step] = true; }
function onDragLeave(step: KycStep)               { isDragging.value[step] = false; }
function onDrop(step: KycStep, e: DragEvent) {
    e.preventDefault(); isDragging.value[step] = false;
    const file = e.dataTransfer?.files[0];
    if (file) uploadFile(step, file);
}

function previewSrc(key: KycStep): string | null {
    if (localPreview.value[key]) return localPreview.value[key];
    if (stepDone(key)) return `/api/cabinet/kyc/${key}/image`;
    return null;
}

watch(kycStatus, (status) => {
    if (!status) return;
    for (const key of ['front', 'back', 'selfie'] as KycStep[]) {
        if (!(status as any)[key]?.done && localPreview.value[key]) localPreview.value[key] = null;
    }
});
</script>

<template>
    <div class="flex flex-col gap-5 px-4 py-6 max-w-xl mx-auto pb-8">

        <!-- Header -->
        <div>
            <h1 class="text-xl font-bold text-surface-900 dark:text-surface-100">Identity Verification</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">Required to proceed with your application</p>
        </div>

        <!-- Status banner -->
        <div
            class="rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium"
            :class="kycStatus?.allDone
                ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'"
        >
            <svg v-if="kycStatus?.allDone" class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ kycStatus?.allDone ? 'All documents submitted. Our team will review your identity shortly.' : 'Please upload all three documents below.' }}
        </div>

        <!-- Steps -->
        <section class="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
            <div class="divide-y divide-surface-100 dark:divide-surface-800">
                <div v-for="(step, idx) in steps" :key="step.key">

                    <!-- Step row -->
                    <button
                        type="button"
                        class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                        :class="activeStep === step.key ? 'bg-surface-50 dark:bg-surface-800/60' : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'"
                        @click="openStep(step.key)"
                    >
                        <span
                            class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors"
                            :class="stepDone(step.key)
                                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                : activeStep === step.key
                                    ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300'
                                    : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'"
                        >
                            <svg v-if="stepDone(step.key)" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span v-else>{{ idx + 1 }}</span>
                        </span>

                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-surface-900 dark:text-surface-100">{{ step.label }}</p>
                            <p class="text-xs text-surface-500 dark:text-surface-400 truncate">{{ step.sublabel }}</p>
                        </div>

                        <div v-if="previewSrc(step.key)" class="shrink-0">
                            <img :src="previewSrc(step.key)!" :alt="step.label" class="size-10 rounded-lg object-cover border border-surface-200 dark:border-surface-700" />
                        </div>

                        <svg
                            class="size-4 shrink-0 text-surface-400 transition-transform"
                            :class="activeStep === step.key ? 'rotate-180' : ''"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <!-- Expanded panel -->
                    <div v-if="activeStep === step.key" class="px-4 pb-4 flex flex-col gap-3">
                        <p class="text-xs text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-2">
                            💡 {{ step.hint }}
                        </p>
                        <p v-if="kycError[step.key]" class="text-xs text-danger-600 dark:text-danger-400">{{ kycError[step.key] }}</p>

                        <!-- Method picker -->
                        <div v-if="stepMode[step.key] === 'choose'" class="grid grid-cols-2 gap-2.5">
                            <button type="button" class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-700 p-4 text-center transition-colors hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 cursor-pointer" @click="selectMode(step.key, 'upload')">
                                <svg class="size-7 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                <span class="text-xs font-medium text-surface-700 dark:text-surface-300">Upload file</span>
                                <span class="text-[11px] text-surface-400">JPEG, PNG or WebP</span>
                            </button>
                            <button type="button" class="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-700 p-4 text-center transition-colors hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 cursor-pointer" @click="selectMode(step.key, 'camera')">
                                <svg class="size-7 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                </svg>
                                <span class="text-xs font-medium text-surface-700 dark:text-surface-300">Take photo</span>
                                <span class="text-[11px] text-surface-400">Use your camera</span>
                            </button>
                        </div>

                        <!-- Upload zone -->
                        <div v-else-if="stepMode[step.key] === 'upload'">
                            <input :ref="el => fileInputRef[step.key] = el as HTMLInputElement" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFileInput(step.key, $event)" />
                            <div
                                class="rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center gap-3 py-8 px-4 text-center"
                                :class="isDragging[step.key] ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-surface-300 dark:border-surface-700 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/20'"
                                @dragover="onDragOver(step.key, $event)"
                                @dragleave="onDragLeave(step.key)"
                                @drop="onDrop(step.key, $event)"
                                @click="fileInputRef[step.key]?.click()"
                            >
                                <svg v-if="uploading !== step.key" class="size-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                <svg v-else class="size-8 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <div>
                                    <p class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ uploading === step.key ? 'Uploading…' : 'Drop image here' }}</p>
                                    <p class="text-xs text-surface-400 mt-0.5">or tap to browse</p>
                                </div>
                            </div>
                            <button type="button" class="mt-2 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 underline w-full text-center cursor-pointer" @click="stepMode[step.key] = 'choose'">← Back</button>
                        </div>

                        <!-- Camera -->
                        <div v-else-if="stepMode[step.key] === 'camera'">
                            <input :ref="el => cameraInputRef[step.key] = el as HTMLInputElement" type="file" accept="image/*" :capture="step.cameraFacing" class="hidden" @change="onFileInput(step.key, $event)" />
                            <button type="button" :disabled="uploading === step.key" class="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white py-3.5 text-sm font-medium transition-colors cursor-pointer" @click="cameraInputRef[step.key]?.click()">
                                <svg v-if="uploading === step.key" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <svg v-else class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {{ uploading === step.key ? 'Uploading…' : 'Open camera' }}
                            </button>
                            <button type="button" class="mt-2 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 underline w-full text-center cursor-pointer" @click="stepMode[step.key] = 'choose'">← Back</button>
                        </div>

                        <!-- Re-upload preview -->
                        <div v-if="previewSrc(step.key) && stepMode[step.key] === 'choose'" class="flex flex-col gap-2">
                            <img :src="previewSrc(step.key)!" :alt="step.label" class="w-full max-h-48 object-cover rounded-xl border border-surface-200 dark:border-surface-700" />
                            <button type="button" class="text-xs text-brand-600 dark:text-brand-400 hover:underline text-center cursor-pointer" @click="stepMode[step.key] = 'upload'">Replace image</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>
