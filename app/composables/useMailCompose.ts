/**
 * Global state for the floating mail compose panel.
 * Use useState so state survives navigation without resetting.
 */

export interface ComposeOptions {
  mailboxId?: string
  to?: string
  subject?: string
  inReplyTo?: string   // Message-ID for reply threading
  references?: string
}

export const useMailCompose = () => {
  const isOpen      = useState('mail-compose-open',      () => false)
  const isMinimized = useState('mail-compose-minimized', () => false)

  // Form fields
  const mailboxId  = useState<string | null>('mail-compose-mailboxId',  () => null)
  const to         = useState('mail-compose-to',         () => '')
  const cc         = useState('mail-compose-cc',         () => '')
  const subject    = useState('mail-compose-subject',    () => '')
  const body       = useState('mail-compose-body',       () => '')
  const inReplyTo  = useState<string | undefined>('mail-compose-inReplyTo',  () => undefined)
  const references = useState<string | undefined>('mail-compose-references', () => undefined)
  const showCc     = useState('mail-compose-showCc',     () => false)

  function open(opts?: ComposeOptions) {
    isOpen.value      = true
    isMinimized.value = false
    showCc.value      = false

    if (opts?.mailboxId) mailboxId.value = opts.mailboxId

    if (opts?.inReplyTo) {
      // Reply mode — caller pre-fills to/subject
      to.value         = opts.to ?? ''
      subject.value    = opts.subject ?? ''
      inReplyTo.value  = opts.inReplyTo
      references.value = opts.references ?? opts.inReplyTo
      body.value       = ''
    } else {
      // New compose
      to.value         = opts?.to ?? ''
      subject.value    = opts?.subject ?? ''
      body.value       = ''
      inReplyTo.value  = undefined
      references.value = undefined
    }
  }

  function close() {
    isOpen.value = false
  }

  function toggleMinimize() {
    isMinimized.value = !isMinimized.value
  }

  return {
    isOpen, isMinimized,
    mailboxId, to, cc, subject, body, inReplyTo, references, showCc,
    open, close, toggleMinimize,
  }
}
