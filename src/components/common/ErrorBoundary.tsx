import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[RRI Event Wheel]', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-[60vh] place-items-center p-8 text-center">
        <div className="max-w-md">
          <h2 className="font-display text-2xl font-semibold">Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.</h2>
          <p className="mt-3 text-muted">Your event data is safe. Reload the page to continue.</p>
          <button className="mt-6 rounded-xl bg-inverse px-5 py-3 font-semibold text-white" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
