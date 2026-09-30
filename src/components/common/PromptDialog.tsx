import { useEffect, useState } from 'react'
import { Button } from './Button'
import { TextInput } from './Form'
import { Modal } from './Modal'

export function PromptDialog({ open, title, label, initial, confirmLabel, onClose, onSubmit }: { open: boolean; title: string; label: string; initial: string; confirmLabel: string; onClose(): void; onSubmit(v: string): void }) {
  const [v, setV] = useState(initial)
  useEffect(() => {
    if (open) setV(initial)
  }, [open, initial])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="prompt-form" disabled={!v.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id="prompt-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (v.trim()) onSubmit(v.trim())
        }}
      >
        <TextInput label={label} value={v} onChange={(e) => setV(e.target.value)} maxLength={80} />
      </form>
    </Modal>
  )
}
