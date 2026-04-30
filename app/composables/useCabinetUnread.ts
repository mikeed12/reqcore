/**
 * Shared unread message counts for the candidate cabinet.
 * Updated by each conversations page after fetching.
 * Read by the layout tab bar to show badges.
 */
export const useCabinetUnread = () => {
  const totalUnread = useState('cabinet-conv-unread', () => 0)
  const unreadByType = useState<Record<'task' | 'support' | 'chat', number>>(
    'cabinet-conv-unread-by-type',
    () => ({ task: 0, support: 0, chat: 0 }),
  )

  function syncFromList(list: Array<{ type: 'task' | 'support' | 'chat'; unreadCount: number }>) {
    const byType = { task: 0, support: 0, chat: 0 }
    for (const c of list) byType[c.type] += c.unreadCount || 0
    unreadByType.value = byType
    totalUnread.value = byType.task + byType.support + byType.chat
  }

  return { totalUnread, unreadByType, syncFromList }
}
