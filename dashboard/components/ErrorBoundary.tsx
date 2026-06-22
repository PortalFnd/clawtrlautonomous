'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="text-center max-w-sm">
            <div className="text-eva-red text-xs font-mono uppercase tracking-[2px] mb-2">Component Error</div>
            <p className="text-[11px] font-mono text-primary-40 leading-relaxed">
              {this.state.error?.message || 'Something went wrong rendering this panel.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 text-[10px] font-mono uppercase tracking-[1px] px-3 py-1.5 rounded border border-[rgba(228,236,255,0.14)] text-primary-50 hover:text-primary-100 hover:border-[rgba(228,236,255,0.28)] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
