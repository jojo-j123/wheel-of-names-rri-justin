import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

export function Field({ label, hint, required, children, htmlFor }: { label: string; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label} {required && <span className="text-brand">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-field px-4 text-[15px] text-ink placeholder:text-muted/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15'

export function TextInput({ label, hint, required, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} required={required} htmlFor={id}>
      <input id={id} required={required} className={`${inputCls} h-12`} {...rest} />
    </Field>
  )
}

export function TextArea({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea id={id} className={`${inputCls} py-3 leading-relaxed`} {...rest} />
    </Field>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-line bg-field px-5 py-4">
      <div>
        <label htmlFor={id} className="block cursor-pointer text-[15px] font-semibold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-ink/15'}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-7' : 'left-1'}`} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  dark,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
  label: string
  dark?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-xl p-1 ${dark ? 'bg-fg/8 ring-1 ring-fg/10' : 'bg-ink/5'}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onMouseUp={(e) => dark && e.currentTarget.blur()}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active ? (dark ? 'bg-fg text-sbg shadow' : 'bg-card text-ink shadow-sm') : dark ? 'text-fg/70 hover:text-fg' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
