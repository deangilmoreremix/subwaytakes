import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in component subtree and displays fallback UI
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In a real application, you would send this to an error reporting service
    // like Sentry, Bugsnag, etc.
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="rounded-2xl border border-red-900/50 bg-red-900/20 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-400">Something went wrong</h3>
              <p className="mt-2 text-sm text-red-300">
                We've encountered an unexpected error. Please try refreshing the page.
              </p>
              {this.state.error && (
                <details className="mt-3 max-w-2xl text-xs text-red-500/80">
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
                </details>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Refresh Page
                </button>
                <button
                  type="button"
                  onClick={() => this.setState({ hasError: false, error: undefined })}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}