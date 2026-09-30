import { Search, X } from 'lucide-react'

export function ParticipantSearch({ value, onChange, placeholder = 'Search names, emails, phones' }: { value: string; onChange(v: string): void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-xl border border-line bg-field pl-10 pr-10 text-[15px] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-ink/5">
          <X size={16} />
        </button>
      )}
    </div>
  )
}
