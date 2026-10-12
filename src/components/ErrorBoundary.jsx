import React from 'react';

/**
 * ErrorBoundary — wraps any part of the React tree.
 * Catches runtime errors and shows a friendly fallback instead of a white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[CampusLearn Error]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              An unexpected error occurred. Don't worry — your data is safe.
            </p>
            <details className="bg-gray-50 rounded-xl p-4 text-left text-xs text-gray-500 mb-6 border border-gray-100">
              <summary className="font-bold cursor-pointer mb-2">Error details</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </details>
            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
