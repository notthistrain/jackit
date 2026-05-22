import type { ReactNode } from 'react'
import { Component } from 'react'

interface ErrorBoundaryProps {
  fallback?: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback)
        return this.props.fallback

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1E1E1E',
          color: '#CCC',
          fontFamily: 'system-ui, sans-serif',
          gap: '12px',
        }}
        >
          <h2 style={{ fontSize: '14px', margin: 0 }}>Something went wrong</h2>
          <pre style={{
            fontSize: '11px',
            color: '#F48771',
            background: '#2D2D2D',
            padding: '8px 12px',
            borderRadius: '4px',
            maxWidth: '80%',
            overflow: 'auto',
          }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#007ACC',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
