import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('SkyDash Error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
          <div className="max-w-md text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-200">Something went wrong</h1>
            <p className="text-sm text-zinc-500">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-white/[0.05] border border-white/[0.1] rounded-xl hover:bg-white/[0.08] transition-colors"
            >
              <RefreshCw size={14} />
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Granular error boundary for individual panels/sections.
 * Shows inline error instead of crashing entire app.
 */
export class PanelBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`SkyDash Panel Error [${this.props.name || 'unknown'}]:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <AlertTriangle size={18} className="text-amber-500 mx-auto" />
            <p className="text-[10px] text-zinc-500 tracking-wider">
              {this.props.name ? `${this.props.name.toUpperCase()} ERROR` : 'PANEL ERROR'}
            </p>
            <p className="text-[9px] text-zinc-600 font-mono max-w-[200px] truncate">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-[9px] text-indigo-400 hover:text-indigo-300"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
