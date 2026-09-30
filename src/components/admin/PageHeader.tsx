import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({ title, description, actions, back = true }: { title: string; description?: string; actions?: ReactNode; back?: boolean }) {
  return (
    <div className="mb-8">
      {back && (
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-semibold text-muted transition hover:text-ink">
          <ChevronLeft size={18} /> Admin home
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-6 shadow-card ${className}`}>{children}</div>
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'brand' }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`tabular mt-1 font-display text-3xl font-semibold tracking-tight ${tone === 'brand' ? 'text-brand' : ''}`}>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</p>
    </div>
  )
}
