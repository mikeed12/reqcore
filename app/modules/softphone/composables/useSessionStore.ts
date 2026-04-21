import { markRaw, ref } from 'vue'

// 🔹 singleton (один на всё приложение)
const liveSessionArray = ref([])
const updateSession = ref(0)

export function useSessionStore() {
    function addSession(session: any) {
        const rawSession = markRaw(session)

        // @ts-ignore
        const index = liveSessionArray.value.findIndex(
            item => item.id === rawSession.id
        )

        if (index > -1) {
            liveSessionArray.value.splice(index, 1)
        }

        // @ts-ignore
        liveSessionArray.value.unshift(rawSession)
        updateSession.value++
    }

    function removeSession(sessionId: any) {
        // @ts-ignore
        liveSessionArray.value = liveSessionArray.value.filter(
            session => session.id !== sessionId
        )
        updateSession.value++
    }

    function clearSessions() {
        liveSessionArray.value = []
        updateSession.value++
    }

    function getLiveSessionArray() {
        return liveSessionArray.value
    }

    return {
        liveSessionArray,
        updateSession,

        addSession,
        removeSession,
        clearSessions,
        getLiveSessionArray,
    }
}