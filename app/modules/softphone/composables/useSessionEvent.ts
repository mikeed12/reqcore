import audioPlayer from './useAudioPlayer'
import { useSessionStore } from '../composables/useSessionStore'

export default function SessionEvent(session: { on: (arg0: string, arg1: { (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void; (): void }) => void; connection: { getReceivers: () => { (): any; new(): any; map: { (arg0: (r: any) => any): MediaStream; new(): any } } }; id: any }) {
    const sessionStore = useSessionStore()

    sessionStore.addSession(session)

    const audio = new Audio()
    audio.autoplay = true

    function update() {
        sessionStore.addSession(session)
    }

    session.on('peerconnection', update)

    session.on('connecting', () => {
        try {
            const mediaStream = new MediaStream(
                session.connection.getReceivers().map(r => r.track)
            )

            audio.srcObject = mediaStream
            audio.play().catch(() => {})
        } catch (e) {
            console.warn('audio attach failed', e)
        }

        update()
    })

    session.on('accepted', update)
    session.on('confirmed', update)
    session.on('progress', update)
    session.on('sending', update)

    session.on('ended', () => {
        audioPlayer?.play?.('rejected', 1.0)
        sessionStore.removeSession(session.id)
    })

    session.on('failed', () => {
        audioPlayer?.play?.('rejected', 1.0)
        sessionStore.removeSession(session.id)
    })

    session.on('hold', update)
    session.on('unhold', update)
    session.on('muted', update)
    session.on('unmuted', update)

    session.on('newDTMF', update)
    session.on('newInfo', update)

    session.on('reinvite', update)
    session.on('update', update)
    session.on('refer', update)
    session.on('replaces', update)

    session.on('icecandidate', update)
    session.on('sdp', update)

    session.on('getusermediafailed', update)
    session.on('peerconnection:createofferfailed', update)
    session.on('peerconnection:createanswerfailed', update)
    session.on('peerconnection:setlocaldescriptionfailed', update)
    session.on('peerconnection:setremotedescriptionfailed', update)
}