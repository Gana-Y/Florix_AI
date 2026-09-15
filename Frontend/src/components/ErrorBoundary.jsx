import React from 'react';

/**
 * Global Error Boundary — BUG-010 Fix
 * Catches any unhandled render errors in the component tree.
 * Without this, a single crash would blank the entire screen with no recovery.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Florix AI Error Boundary]', error, info);
    this.setState({ errorInfo: info });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleHardReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = window.location.origin + window.location.pathname + '?_t=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#060713] text-white p-6">
          <div className="max-w-xl w-full text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="text-2xl font-extrabold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-zinc-400 mb-4 text-sm">
              Florix AI encountered an unexpected error. Your data is safe.
            </p>

            {this.state.error && (
              <div className="text-xs text-zinc-300 bg-[#0c0d1c] rounded-2xl px-5 py-4 mb-6 font-mono text-left overflow-auto max-h-56 border border-white/10 shadow-2xl">
                <div className="font-bold text-red-500 mb-1">{this.state.error.toString()}</div>
                {this.state.error.stack && (
                  <pre className="text-[11px] whitespace-pre-wrap text-zinc-500 mb-2 leading-relaxed">{this.state.error.stack}</pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div className="border-t border-zinc-800 pt-2 mt-2">
                    <div className="text-[10px] text-zinc-400 font-semibold mb-1">Component Stack:</div>
                    <pre className="text-[10px] whitespace-pre-wrap text-indigo-400 leading-relaxed">{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-indigo-500/30 text-sm cursor-pointer"
              >
                Reload App
              </button>
              <button
                onClick={this.handleHardReload}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-colors text-sm border border-zinc-700 cursor-pointer"
              >
                Clear Cache & Hard Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
