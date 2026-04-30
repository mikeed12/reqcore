/**
 * Shared in-memory pub/sub for WebSocket broadcasting.
 *
 * Rooms are named strings — conventions used in this app:
 *   conv:<conversationId>          – messages within a conversation
 *   inbox:candidate:<candidateId>  – new-conversation notifications for a candidate
 *   inbox:org:<organizationId>     – new-conversation notifications for all org admins
 *
 * This module is imported by both the WS handler (to subscribe/unsubscribe peers)
 * and by REST endpoints (to broadcast after DB writes).
 *
 * NOTE: in-memory only — suitable for single-instance deployments.
 * For multi-instance, replace with Redis pub/sub.
 */

interface WsPeer {
  id: string
  send(data: string): void
}

const rooms = new Map<string, Set<WsPeer>>()

export const wsRooms = {
  subscribe(room: string, peer: WsPeer) {
    if (!rooms.has(room)) rooms.set(room, new Set())
    rooms.get(room)!.add(peer)
  },

  unsubscribe(room: string, peer: WsPeer) {
    const peers = rooms.get(room)
    if (!peers) return
    peers.delete(peer)
    if (peers.size === 0) rooms.delete(room)
  },

  unsubscribeAll(peer: WsPeer, peerRooms: string[]) {
    for (const room of peerRooms) {
      this.unsubscribe(room, peer)
    }
  },

  broadcast(room: string, data: unknown, excludePeer?: WsPeer) {
    const peers = rooms.get(room)
    if (!peers) return
    const msg = JSON.stringify(data)
    for (const peer of peers) {
      if (peer === excludePeer) continue
      try { peer.send(msg) }
      catch { /* ignore closed connections */ }
    }
  },
}
