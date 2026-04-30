import { eq, inArray, and, gt } from 'drizzle-orm'
import { getCabinetSessionFromToken } from '../../../utils/cabinet-auth'
import { wsRooms } from '../../../utils/ws-rooms'
import { conversation, session as sessionTable } from '../../../database/schema'

// ── Cookie parser ─────────────────────────────────────────────────────────────

function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const k = part.slice(0, eqIdx).trim()
    if (k === name) {
      try { return decodeURIComponent(part.slice(eqIdx + 1).trim()) }
      catch { return part.slice(eqIdx + 1).trim() }
    }
  }
  return null
}

// ── Resolve admin session directly from the DB (avoids auth.api.getSession) ───
// Better Auth's default session cookie is "better-auth.session_token".
// The session table stores the token + activeOrganizationId directly.

async function getAdminOrgId(cookieHeader: string | null): Promise<string | null> {
  const token = parseCookieHeader(cookieHeader, 'better-auth.session_token')
  if (!token) return null

  const row = await db.query.session.findFirst({
    where: and(
      eq(sessionTable.token, token),
      gt(sessionTable.expiresAt, new Date()),
    ),
    columns: { activeOrganizationId: true },
  })

  return row?.activeOrganizationId ?? null
}

// ── Safe send / close ─────────────────────────────────────────────────────────

function safeSend(peer: any, data: unknown) {
  try { peer.send(JSON.stringify(data)) } catch { /* peer already gone */ }
}

function safeClose(peer: any, code: number, reason: string) {
  try { peer.close(code, reason) } catch { /* peer already gone */ }
}

// ── Per-peer cleanup ──────────────────────────────────────────────────────────

interface PeerMeta { rooms: string[]; role: 'candidate' | 'admin' }
const peerMeta = new Map<string, PeerMeta>()

function cleanup(peer: any) {
  const meta = peerMeta.get(peer.id)
  if (meta) {
    wsRooms.unsubscribeAll(peer, meta.rooms)
    peerMeta.delete(peer.id)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default defineWebSocketHandler({
  async open(peer) {
    try {
      const cookieHeader = peer.request?.headers?.get?.('cookie') ?? null

      // ── 1. Cabinet (candidate) session ──────────────────────────────────────
      const cabinetToken = parseCookieHeader(cookieHeader, 'cabinet_session')
      if (cabinetToken) {
        const candidateIds = await getCabinetSessionFromToken(cabinetToken).catch(() => null)
        if (candidateIds && candidateIds.length > 0) {
          const meta: PeerMeta = { rooms: [], role: 'candidate' }

          for (const cid of candidateIds) {
            const room = `inbox:candidate:${cid}`
            wsRooms.subscribe(room, peer)
            meta.rooms.push(room)
          }

          const convs = await db
            .select({ id: conversation.id })
            .from(conversation)
            .where(inArray(conversation.candidateId, candidateIds))
            .catch(() => [] as { id: string }[])

          for (const c of convs) {
            const room = `conv:${c.id}`
            wsRooms.subscribe(room, peer)
            meta.rooms.push(room)
          }

          peerMeta.set(peer.id, meta)
          safeSend(peer, { type: 'connected', role: 'candidate' })
          return
        }
      }

      // ── 2. Admin session — direct DB lookup, no auth.api.getSession ──────────
      const orgId = await getAdminOrgId(cookieHeader).catch(() => null)
      if (orgId) {
        const meta: PeerMeta = { rooms: [], role: 'admin' }

        const inboxRoom = `inbox:org:${orgId}`
        wsRooms.subscribe(inboxRoom, peer)
        meta.rooms.push(inboxRoom)

        const convs = await db
          .select({ id: conversation.id })
          .from(conversation)
          .where(eq(conversation.organizationId, orgId))
          .catch(() => [] as { id: string }[])

        for (const c of convs) {
          const room = `conv:${c.id}`
          wsRooms.subscribe(room, peer)
          meta.rooms.push(room)
        }

        peerMeta.set(peer.id, meta)
        safeSend(peer, { type: 'connected', role: 'admin' })
        return
      }

      // ── 3. Unauthenticated ───────────────────────────────────────────────────
      safeSend(peer, { type: 'error', message: 'Unauthorized' })
      safeClose(peer, 1008, 'Unauthorized')
    }
    catch (err) {
      console.error('[WS] open error:', (err as any)?.message ?? err)
      safeClose(peer, 1011, 'Internal error')
    }
  },

  message(peer, msg) {
    try {
      const data = JSON.parse(msg.text())

      if (data.type === 'subscribe_conv' && typeof data.conversationId === 'string') {
        const room = `conv:${data.conversationId}`
        wsRooms.subscribe(room, peer)
        const meta = peerMeta.get(peer.id)
        if (meta && !meta.rooms.includes(room)) meta.rooms.push(room)
        safeSend(peer, { type: 'subscribed', room })
        return
      }

      if (data.type === 'ping') safeSend(peer, { type: 'pong' })
    }
    catch { /* ignore malformed messages */ }
  },

  close(peer) {
    cleanup(peer)
  },

  error(peer, _err) {
    // ECONNRESET and other transport errors land here — clean up silently
    cleanup(peer)
  },
})
