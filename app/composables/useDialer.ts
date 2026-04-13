import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import JsSIP from 'jssip'
import { useSessionStore } from '@/composables/useSessionStore'
import SessionEvent from './useSessionEvent'
import audioPlayer from './useAudioPlayer'

const sessionStore = useSessionStore()
export const CALL_STATES = {
    EXTENSIONS_LOADING: 'extensions-loading',
    EXTENSION_CONNECTING: 'extension-connecting',
    IDLE: 'idle',
    CALLING: 'calling',
    INCOMING: 'incoming',
    ERROR: 'error',
}

export function useDialer() {
    const showDialer = ref(false)
    const phone = ref('')
    const callState = ref(CALL_STATES.EXTENSIONS_LOADING)

    const extensions = ref([])
    const callHistory = ref([])
    const selectedExtensionId = ref('')

    const incomingCallerName = ref('')
    const incomingCallerNumber = ref('')
    const errorMessage = ref('')

    const seconds = ref(0)

    const connectionStatus = ref({
        status: false,
        text: '',
    })

    const uaRef = shallowRef(null)
    const activeSessionRef = shallowRef(null)

    let timer = null
    let extensionConnectTimeout = null

    const selectedExtension = computed(() => {
        return (
            extensions.value.find(
                item => String(item.id) === String(selectedExtensionId.value)
            ) || null
        )
    })

    const selectedExtensionLabel = computed(() => {
        if (!selectedExtension.value) return ''
        return `${selectedExtension.value.name} · ${selectedExtension.value.number}`
    })

    const isExtensionSelectDisabled = computed(() => {
        return [
            CALL_STATES.EXTENSIONS_LOADING,
            CALL_STATES.EXTENSION_CONNECTING,
            CALL_STATES.CALLING,
            CALL_STATES.INCOMING,
        ].includes(callState.value)
    })

    const isInputDisabled = computed(() => {
        return [
            CALL_STATES.EXTENSIONS_LOADING,
            CALL_STATES.EXTENSION_CONNECTING,
            CALL_STATES.CALLING,
            CALL_STATES.INCOMING,
        ].includes(callState.value)
    })

    const canStartCall = computed(() => {
        return (
            callState.value === CALL_STATES.IDLE &&
            phone.value.trim().length > 0 &&
            !!selectedExtensionId.value &&
            connectionStatus.value.status
        )
    })

    const statusTitle = computed(() => {
        switch (callState.value) {
            case CALL_STATES.EXTENSIONS_LOADING:
                return 'Extensions are loading'
            case CALL_STATES.EXTENSION_CONNECTING:
                return 'Connecting extension'
            case CALL_STATES.CALLING:
                return 'Call in progress'
            case CALL_STATES.INCOMING:
                return 'Incoming call'
            case CALL_STATES.ERROR:
                return 'Softphone error'
            default:
                return selectedExtension.value
                    ? `Ready · ${selectedExtension.value.number}`
                    : 'Select extension'
        }
    })

    const statusBoxClass = computed(() => {
        switch (callState.value) {
            case CALL_STATES.EXTENSIONS_LOADING:
            case CALL_STATES.EXTENSION_CONNECTING:
                return 'bg-amber-50 text-amber-700'
            case CALL_STATES.CALLING:
                return 'bg-blue-50 text-blue-700'
            case CALL_STATES.INCOMING:
                return 'bg-emerald-50 text-emerald-700'
            case CALL_STATES.ERROR:
                return 'bg-rose-50 text-rose-700'
            default:
                return selectedExtension.value
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-50 text-amber-700'
        }
    })

    const statusDotClass = computed(() => {
        switch (callState.value) {
            case CALL_STATES.EXTENSIONS_LOADING:
            case CALL_STATES.EXTENSION_CONNECTING:
                return 'bg-amber-500'
            case CALL_STATES.CALLING:
                return 'bg-blue-500'
            case CALL_STATES.INCOMING:
                return 'bg-emerald-500'
            case CALL_STATES.ERROR:
                return 'bg-rose-500'
            default:
                return selectedExtension.value ? 'bg-slate-400' : 'bg-amber-500'
        }
    })

    const formattedDuration = computed(() => {
        const mins = String(Math.floor(seconds.value / 60)).padStart(2, '0')
        const secs = String(seconds.value % 60).padStart(2, '0')
        return `${mins}:${secs}`
    })

    function startTimer() {
        stopTimer()
        timer = window.setInterval(() => {
            seconds.value += 1
        }, 1000)
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer)
            timer = null
        }
    }

    function resetCallMeta() {
        stopTimer()
        seconds.value = 0
    }

    function setState(state: string) {
        callState.value = state

        if (state === CALL_STATES.CALLING || state === CALL_STATES.INCOMING) {
            startTimer()
        } else {
            resetCallMeta()
        }

        if (state !== CALL_STATES.INCOMING) {
            incomingCallerName.value = ''
            incomingCallerNumber.value = ''
        }

        if (state !== CALL_STATES.ERROR) {
            errorMessage.value = ''
        }
    }

    function toggleDialer() {
        showDialer.value = !showDialer.value
    }

    function closeDialer() {
        showDialer.value = false
    }

    function triggerError(message = 'Unknown softphone error') {
        errorMessage.value = message
        setState(CALL_STATES.ERROR)
    }

    function getSipConfigForExtension(extension: null) {
        const activeOrgState = authClient.useActiveOrganization()
        // @ts-ignore
        const metadata = JSON.parse(activeOrgState.value.data.metadata)  || {}

        return {
            user: '101',
            password: 'bBnsx6PHPQh3DeWsT2qJt77Je',
            host: metadata.webrtcUrl,
            port: '8089',
            pathname: metadata.pathname || '/ws',
            displayName: extension,
        }
    }

    function disposeUa() {
        try {
            if (activeSessionRef.value) {
                activeSessionRef.value.terminate()
            }
        } catch {}

        activeSessionRef.value = null

        try {
            if (uaRef.value) {
                uaRef.value.stop()
            }
        } catch {}

        uaRef.value = null
        connectionStatus.value = { status: false, text: '' }
    }

    function bindSessionEvents(session) {
        activeSessionRef.value = session

        // 🔥 сохраняем
        sessionStore.addSession(session)

        const remoteIdentity =
            session.remote_identity?.display_name ||
            session.remote_identity?.uri?.user ||
            'Unknown caller'

        const remoteNumber =
            session.remote_identity?.uri?.toString?.() || ''

        session.on('accepted', () => {
            setState(CALL_STATES.CALLING)
            sessionStore.addSession(session)
        })

        session.on('ended', () => {
            activeSessionRef.value = null
            sessionStore.removeSession(session.id)
            setState(CALL_STATES.IDLE)
        })

        session.on('failed', (data) => {
            activeSessionRef.value = null
            sessionStore.removeSession(session.id)
            triggerError(data?.cause || 'Call failed')
        })

        if (session.direction === 'incoming') {
            incomingCallerName.value = remoteIdentity
            incomingCallerNumber.value = remoteNumber
            setState(CALL_STATES.INCOMING)
        }
    }

    function connectToSip(config) {
        return new Promise((resolve, reject) => {
            try {
                disposeUa()

                const socket = new JsSIP.WebSocketInterface(
                    `wss://${config.host}:${config.port}${config.pathname}`
                )

                const ua = new JsSIP.UA({
                    uri: config.user + '@' + config.host,
                    password: config.password,
                    display_name: config.user,
                    registrar_server: config.host,
                    contact_uri: '',
                    authorizationUser: '',
                    instanceId: '',
                    sessionTimers: true,
                    usePreloadedRoute: false,
                    sockets: [new JsSIP.WebSocketInterface(`wss://${config.host}:${config.port}${config.pathname}`)]
                })

                uaRef.value = ua

                const cleanupListeners = () => {
                    ua.off('registered', onRegistered)
                    ua.off('registrationFailed', onRegistrationFailed)
                    ua.off('disconnected', onDisconnected)
                }

                const onRegistered = e => {
                    cleanupListeners()
                    connectionStatus.value = {
                        status: true,
                        text: `${config.user}@${config.host}`,
                    }
                    resolve(e)
                }

                const onRegistrationFailed = e => {
                    cleanupListeners()
                    connectionStatus.value = {
                        status: false,
                        text: e?.cause || 'Registration failed',
                    }
                    reject(new Error(e?.cause || 'Registration failed'))
                }

                const onDisconnected = () => {
                    connectionStatus.value = {
                        status: false,
                        text: 'Disconnected',
                    }
                }

                ua.on('connected', () => {
                    connectionStatus.value = {
                        status: false,
                        text: 'Socket connected',
                    }
                })

                ua.on('connecting', () => {
                    connectionStatus.value = {
                        status: false,
                        text: 'Connecting...',
                    }
                })

                ua.on('disconnected', onDisconnected)
                ua.on('registered', onRegistered)
                ua.on('registrationFailed', onRegistrationFailed)

                ua.on('newRTCSession', (data: { originator: string; session: any }) => {
                    //bindSessionEvents(data.session);
                    data.originator === "local" && audioPlayer.play("ringback", 1.0);
                    SessionEvent(data.session)
                })

                ua.start()

                extensionConnectTimeout = window.setTimeout(() => {
                    cleanupListeners()
                    reject(new Error('SIP registration timeout'))
                }, 10000)
            } catch (error) {
                reject(error)
            }
        }).finally(() => {
            if (extensionConnectTimeout) {
                clearTimeout(extensionConnectTimeout)
                extensionConnectTimeout = null
            }
        })
    }

    async function connectSelectedExtension() {
        if (!selectedExtension.value) return

        setState(CALL_STATES.EXTENSION_CONNECTING)

        try {
            const config = getSipConfigForExtension(selectedExtension.value)

            if (!config.user || !config.password || !config.host) {
                throw new Error('Extension SIP config is incomplete')
            }

            await connectToSip(config)

            if (selectedExtension.value) {
                setState(CALL_STATES.IDLE)
            }
        } catch (error) {
            triggerError(error?.message || 'Failed to connect extension')
        }
    }

    function startCall() {
        if (!canStartCall.value || !uaRef.value) return

        try {
            // 🔥 HOLD всех активных звонков
            const sessions = sessionStore.getLiveSessionArray()

            sessions.forEach((session) => {
                try {
                    if (!session.isEnded?.()) {
                        session.hold()
                    }
                } catch (e) {
                    console.warn('hold error', e)
                }
            })

            const target = phone.value.trim()
            const extensionConfig = getSipConfigForExtension(selectedExtension.value)

            const session = uaRef.value.call(`sip:${target}@${extensionConfig.host}`, {
                mediaConstraints: {
                    audio: true,
                    video: false,
                },
            })

            bindSessionEvents(session)
            setState(CALL_STATES.CALLING)

        } catch (error) {
            triggerError(error?.message || 'Failed to start call')
        }
    }

    function endCall() {
        try {
            if (activeSessionRef.value) {
                activeSessionRef.value.terminate()
            }
        } catch {}

        activeSessionRef.value = null
        setState(CALL_STATES.IDLE)
    }

    function acceptIncomingCall() {
        if (!activeSessionRef.value) return

        try {
            activeSessionRef.value.answer({
                mediaConstraints: {
                    audio: true,
                    video: false,
                },
            })

            if (!phone.value && incomingCallerNumber.value) {
                phone.value = incomingCallerNumber.value
            }

            setState(CALL_STATES.CALLING)
        } catch (error) {
            triggerError(error?.message || 'Failed to accept incoming call')
        }
    }

    function declineIncomingCall() {
        try {
            if (activeSessionRef.value) {
                activeSessionRef.value.terminate()
            }
        } catch {}

        activeSessionRef.value = null
        setState(CALL_STATES.IDLE)
    }

    function retryAfterError() {
        disposeUa()
        selectedExtensionId.value = ''
        extensions.value = []
        setState(CALL_STATES.EXTENSIONS_LOADING)
        loadExtensions()
    }

    function setIncomingCall({ name = '', number = '' } = {}) {
        incomingCallerName.value = name
        incomingCallerNumber.value = number
        setState(CALL_STATES.INCOMING)
    }

    async function loadCallHistory() {
        try {
            const { data } = await useFetch('/api/softphone/calls', {
                key: 'calls',
                headers: useRequestHeaders(['cookie']),
            })

            callHistory.value = Array.isArray(data.value.data.calls) ? data.value.data.calls : []
            setState(CALL_STATES.IDLE)
        } catch {
            triggerError('Failed to load extensions')
        }
    }

    async function loadExtensions() {
        try {
            const { data } = await $fetch('/api/softphone/extensions', {
                key: 'user-extensions',
                headers: useRequestHeaders(['cookie']),
            })

            extensions.value = Array.isArray(data) ? data : []
            setState(CALL_STATES.IDLE)
        } catch {
            triggerError('Failed to load extensions')
        }
    }

    watch(callState, state => {
        if (![CALL_STATES.CALLING, CALL_STATES.INCOMING].includes(state)) {
            stopTimer()
            seconds.value = 0
        }
    })

    watch(selectedExtensionId, async (value, oldValue) => {
        if (!value) {
            disposeUa()
            setState(CALL_STATES.IDLE)
            return
        }

        if (value === oldValue) return

        await connectSelectedExtension()
    })

    onBeforeUnmount(() => {
        stopTimer()

        if (extensionConnectTimeout) {
            clearTimeout(extensionConnectTimeout)
            extensionConnectTimeout = null
        }

        disposeUa()
    })

    loadExtensions()

    loadCallHistory()

    return {
        CALL_STATES,
        showDialer,
        phone,
        callState,
        callHistory,
        extensions,
        selectedExtensionId,
        incomingCallerName,
        incomingCallerNumber,
        errorMessage,
        selectedExtension,
        selectedExtensionLabel,
        isExtensionSelectDisabled,
        isInputDisabled,
        canStartCall,
        statusTitle,
        statusBoxClass,
        statusDotClass,
        formattedDuration,
        connectionStatus,
        toggleDialer,
        closeDialer,
        setState,
        startCall,
        endCall,
        acceptIncomingCall,
        declineIncomingCall,
        triggerError,
        retryAfterError,
        setIncomingCall,
        loadExtensions,
        loadCallHistory
    }
}