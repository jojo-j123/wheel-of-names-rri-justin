import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reportError } from '../../lib/errorReport'

interface Props {
  children: ReactNode
  label?: string
  /** Render nothing on error (for non-essential UI like toasts) and recover automatically. */
  silent?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RRI Event Wheel]', error)
    reportError(error, this.props.label ?? (this.props.silent ? 'silent' : 'app'), info.componentStack)
    if (isChunkLoadError(error)) {
      // A new version was published while this tab was open — reload once to get it.
      try {
        if (Date.now() - Number(sessionStorage.getItem('rri-chunk-reload') ?? 0) > 30_000) {
          sessionStorage.setItem('rri-chunk-reload', String(Date.now()))
          location.reload()
        }
      } catch {
        /* ignore */
      }
    }
    if (this.props.silent) setTimeout(() => this.setState({ error: null }), 500)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.silent) return null
    return (
      <div className="grid min-h-[60vh] place-items-center p-8 text-center">
        <div className="max-w-md">
          <h2 className="font-display text-2xl font-semibold">Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.</h2>
          <p className="mt-3 text-muted">Your event data is safe. Try again, or reload the page.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="rounded-xl border border-line bg-card px-5 py-3 font-semibold" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button className="rounded-xl bg-inverse px-5 py-3 font-semibold text-white" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
          <p className="mt-6 break-words font-mono text-xs text-muted/80">{this.state.error.message.slice(0, 200)}</p>
        </div>
      </div>
    )
  }
}
