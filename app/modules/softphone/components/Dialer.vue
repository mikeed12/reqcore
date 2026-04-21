<template>
  <div class="inline-block">
    <button
        @click="toggleDialer"
        type="button"
        class="hidden cursor-pointer sm:inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/25 active:bg-brand-800 transition-all duration-200 no-underline"
    >
      Dialer
    </button>

    <div
        v-if="showDialer"
        class="absolute right-10 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Softphone
          </p>
          <h2 class="text-lg font-semibold text-slate-900">
            HR Workspace
          </h2>
        </div>

        <button
            @click="closeDialer"
            type="button"
            class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <DialerStatusBar
          :title="statusTitle"
          :box-class="statusBoxClass"
          :dot-class="statusDotClass"
          :duration="formattedDuration"
          :show-duration="callState === CALL_STATES.CALLING || callState === CALL_STATES.INCOMING"
      />

      <DialerStateView
          :state="callState"
          :CALL_STATES="CALL_STATES"
          :phone="phone"
          :selected-extension-label="selectedExtensionLabel"
          :incoming-caller-name="incomingCallerName"
          :incoming-caller-number="incomingCallerNumber"
          :error-message="errorMessage"
      />

      <DialerExtensionSelect
          v-model="selectedExtensionId"
          :extensions="extensions"
          :disabled="isExtensionSelectDisabled"
      />

      <DialerPhoneInput
          v-model="phone"
          :disabled="isInputDisabled"
      />

      <DialerActions />

      <DialerFooter
          :state="callState"
          :CALL_STATES="CALL_STATES"
          :can-start-call="canStartCall"
          @dismiss="setState(CALL_STATES.IDLE)"
          @retry="retryAfterError"
          @decline="declineIncomingCall"
          @accept="acceptIncomingCall"
          @end-call="endCall"
          @start-call="startCall"
      />
    </div>
  </div>
</template>

<script setup>
import { useDialer } from '../composables/useDialer'
import DialerActions from './DialerActions.vue'
import DialerExtensionSelect from './DialerExtensionSelect.vue'
import DialerFooter from './DialerFooter.vue'
import DialerPhoneInput from './DialerPhoneInput.vue'
import DialerStateView from './DialerStateView.vue'
import DialerStatusBar from './DialerStatusBar.vue'

const {
  CALL_STATES,
  showDialer,
  phone,
  callState,
  extensions,
  selectedExtensionId,
  incomingCallerName,
  incomingCallerNumber,
  errorMessage,
  selectedExtensionLabel,
  isExtensionSelectDisabled,
  isInputDisabled,
  canStartCall,
  statusTitle,
  statusBoxClass,
  statusDotClass,
  formattedDuration,
  callHistory,
  toggleDialer,
  closeDialer,
  setState,
  startCall,
  endCall,
  acceptIncomingCall,
  declineIncomingCall,
  retryAfterError,
  connectionStatus
} = useDialer()
</script>