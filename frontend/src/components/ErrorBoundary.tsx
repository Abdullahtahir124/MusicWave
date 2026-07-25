import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center"
          style={{
            background: 'rgba(248,81,73,0.06)',
            border: '1px solid rgba(248,81,73,0.2)',
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ background: 'rgba(248,81,73,0.1)' }}
          >
            !
          </div>
          <p className="text-lg font-bold text-white">Something went wrong</p>
          <p className="max-w-md text-sm text-white/50">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 rounded-full px-6 py-2.5 text-sm font-semibold text-black transition hover:scale-105"
            style={{ background: '#1DB954' }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
