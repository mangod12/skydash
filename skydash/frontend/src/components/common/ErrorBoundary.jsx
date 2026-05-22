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
