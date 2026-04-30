/**
 * Shared state for the floating Conversations panel.
 * Using useState so the values survive component re-mounts across navigation.
 */
export const useConversationsPanel = () => {
  const isOpen = useState('conv-panel-open', () => false)
  const isMinimized = useState('conv-panel-minimized', () => false)
  // Total unread count — updated by the panel, read by the topbar badge
  const totalUnread = useState('conv-panel-unread', () => 0)

  function open() {
    isOpen.value = true
    isMinimized.value = false
  }
  function close() {
    isOpen.value = false
  }
  function toggle() {
    if (isOpen.value) {
      if (isMinimized.value) {
        isMinimized.value = false   // restore from minimized
      } else {
        close()
      }
    } else {
      open()
    }
  }
  function minimize() {
    isMinimized.value = !isMinimized.value
  }

  return { isOpen, isMinimized, totalUnread, open, close, toggle, minimize }
}
