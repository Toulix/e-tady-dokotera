import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to a generic error message. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches unhandled JS errors in the component tree below it and shows
 * a fallback UI instead of crashing the entire app to a white screen.
 *
 * React only exposes error boundaries as class components — there is no
 * hook equivalent as of React 18.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would go to Sentry; for now log to console
    // so developers can debug during local development.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface px-6">
          <div className="text-center space-y-4 max-w-md">
            <span className="material-symbols-outlined text-6xl text-error">error</span>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              Une erreur est survenue
            </h1>
            <p className="text-on-surface-variant">
              Quelque chose s'est mal passé. Veuillez rafraîchir la page ou réessayer plus tard.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-8 py-3 bg-primary text-on-primary font-bold rounded-full hover:brightness-110 transition-all"
            >
              Rafraîchir la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
