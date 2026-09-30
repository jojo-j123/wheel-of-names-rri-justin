import { useEffect, useState } from 'react'
import type { Participant } from '../../types'
import { Button } from '../common/Button'
import { TextInput } from '../common/Form'
import { Modal } from '../common/Modal'

interface Props {
  open: boolean
  participant: Participant | null
  onClose(): void
  /** Return an error message to keep the form open, or null on success. */
  onSave(values: { name: string; email: string; phone: string }): string | null
}

export function ParticipantEditor({ open, participant, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setName(participant?.name ?? '')
    setEmail(participant?.email ?? '')
    setPhone(participant?.phone ?? '')
    setError(null)
  }, [open, participant])
  const editing = !!participant
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter a name.')
    const err = onSave({ name, email, phone })
    if (err) return setError(err)
    if (editing) onClose()
    else {
      // Stay open for quick entry of the next person.
      setName('')
      setEmail('')
      setPhone('')
      setError(null)
      document.getElementById('participant-name')?.focus()
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit participant' : 'Add participant'}
      description={editing ? undefined : 'Email and phone are optional and are never shown on the big screen.'}
      footer={
        <>
          <Button onClick={onClose}>{editing ? 'Cancel' : 'Done'}</Button>
          <Button variant="primary" type="submit" form="participant-form">
            {editing ? 'Save changes' : 'Add participant'}
          </Button>
        </>
      }
    >
      <form id="participant-form" onSubmit={submit} className="space-y-4">
        <TextInput id="participant-name" label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Hassan" autoComplete="off" maxLength={80} />
        <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" autoComplete="off" />
        <TextInput label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" autoComplete="off" />
        {error && <p className="rounded-xl bg-danger/8 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
