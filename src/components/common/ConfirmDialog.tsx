import { AlertTriangle } from 'lucide-react'
import { create } from 'zustand'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState {
  open: boolean
  opts: ConfirmOptions | null
  resolve: ((ok: boolean) => void) | null
}

const useConfirmStore = create<ConfirmState>(() => ({ open: false, opts: null, resolve: null }))

/** Promise-based confirm: `if (await confirm({...})) doIt()` */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().resolve?.(false)
    useConfirmStore.setState({ open: true, opts, resolve })
  })
}

function close(ok: boolean) {
  const { resolve } = useConfirmStore.getState()
  useConfirmStore.setState({ open: false, resolve: null })
  resolve?.(ok)
}

export function ConfirmDialogHost() {
  const { open, opts } = useConfirmStore()
  return (
    <Modal
      open={open}
      onClose={() => close(false)}
      title={opts?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button onClick={() => close(false)} data-autofocus>
            {opts?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {opts?.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        {opts?.danger && (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle size={22} />
          </div>
        )}
        <p className="whitespace-pre-line pt-1 text-[15px] leading-relaxed text-ink-soft">{opts?.message}</p>
      </div>
    </Modal>
  )
}
