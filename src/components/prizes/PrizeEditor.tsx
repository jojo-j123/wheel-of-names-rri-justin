import { ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Prize } from '../../types'
import { ACCEPTED_IMAGE_TYPES, processImageFile } from '../../lib/image/imageUpload'
import type { PrizeInput } from '../../lib/event/operations'
import { Button } from '../common/Button'
import { TextInput } from '../common/Form'
import { Modal } from '../common/Modal'
import { PrizeCard } from './PrizeCard'

interface Props {
  open: boolean
  prize: Prize | null
  onClose(): void
  onSave(input: PrizeInput): string | null
}

const empty: PrizeInput = { name: '', description: '', image: undefined, quantity: 1, sponsor: '', value: '', enabled: true }

export function PrizeEditor({ open, prize, onClose, onSave }: Props) {
  const [v, setV] = useState<PrizeInput>(empty)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    setV(prize ? { name: prize.name, description: prize.description ?? '', image: prize.image, quantity: prize.quantity, sponsor: prize.sponsor ?? '', value: prize.value ?? '', enabled: prize.enabled } : empty)
    setError(null)
  }, [open, prize])

  const set = <K extends keyof PrizeInput>(k: K, val: PrizeInput[K]) => setV((s) => ({ ...s, [k]: val }))

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      set('image', await processImageFile(file, { maxSize: 1024, accept: ACCEPTED_IMAGE_TYPES }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image couldn’t be used.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.name.trim()) return setError('Please give the prize a name.')
    const err = onSave(v)
    if (err) setError(err)
    else onClose()
  }

  const previewPrize: Prize = { id: 'preview', createdAt: 0, name: v.name, description: v.description, image: v.image, quantity: Math.max(1, Number(v.quantity) || 1), sponsor: v.sponsor, value: v.value, enabled: true }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prize ? 'Edit prize' : 'Add prize'}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="prize-form" disabled={busy}>
            Save prize
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_300px]">
        <form id="prize-form" onSubmit={submit} className="space-y-4">
          <TextInput label="Prize name" required value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. iPhone 17 Pro" maxLength={80} />
          <TextInput label="Description" value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Grand prize" />
          <div>
            <p className="mb-1.5 text-sm font-semibold">Prize image</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} onClick={() => fileRef.current?.click()} disabled={busy}>
                {v.image ? 'Change image' : 'Upload image'}
              </Button>
              {v.image && (
                <Button variant="ghost" icon={<X size={16} />} onClick={() => set('image', undefined)}>
                  Remove image
                </Button>
              )}
              <span className="text-xs text-muted">JPG, PNG or WEBP</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Quantity" type="number" min={1} max={10000} value={String(v.quantity)} onChange={(e) => set('quantity', Number(e.target.value))} hint="How many of this prize" />
            <TextInput label="Value" value={v.value} onChange={(e) => set('value', e.target.value)} placeholder="Optional, e.g. $999" />
          </div>
          <TextInput label="Sponsor" value={v.sponsor} onChange={(e) => set('sponsor', e.target.value)} placeholder="Optional" />
          {error && <p className="rounded-xl bg-danger/8 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        </form>
        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Preview</p>
          <PrizeCard prize={previewPrize} remaining={previewPrize.quantity} preview />
        </div>
      </div>
    </Modal>
  )
}
