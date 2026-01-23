/**
 * Faro-integrated error boundary component.
 *
 * @remarks
 * Wraps React error boundaries with automatic error reporting to Faro.
 * Provides component stack traces and route context for debugging.
 *
 * @packageDocumentation
 */

'use client';

import * as React from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { getFaro } from '../initialize';
import { scrubError, scrubString } from '../privacy';

/**
 * Error boundary props.
 */
export interface FaroErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback UI to display on error */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Component name for context */
  componentName?: string;
  /** Additional context to include in error reports */
  context?: Record<string, string>;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to reset on navigation (requires key prop) */
  resetOnNavigate?: boolean;
}

/**
 * Error boundary state.
 */
interface FaroErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Faro-integrated error boundary.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FaroErrorBoundary componentName="Dashboard">
 *   <Dashboard />
 * </FaroErrorBoundary>
 *
 * // With custom fallback
 * <FaroErrorBoundary
 *   componentName="ProfilePage"
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={reset}>Retry</button>
 *     </div>
 *   )}
 * >
 *   <ProfilePage />
 * </FaroErrorBoundary>
 * ```
 */
export class FaroErrorBoundary extends Component<FaroErrorBoundaryProps, FaroErrorBoundaryState> {
  constructor(props: FaroErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): FaroErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;

    // Report to Faro
    this.reportError(error, errorInfo);

    // Call user callback
    if (onError) {
      onError(error, errorInfo);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    const faro = getFaro();
    if (!faro) return;

    const { componentName, context } = this.props;

    try {
      // Scrub error for privacy
      const scrubbedError = scrubError(error);

      // Get component stack
      const componentStack = errorInfo.componentStack
        ? scrubString(errorInfo.componentStack)
        : undefined;

      // Build context
      const errorContext: Record<string, string> = {
        ...context,
        boundary: componentName ?? 'FaroErrorBoundary',
      };

      // Add route if available
      if (typeof window !== 'undefined') {
        errorContext['path'] = window.location.pathname;
        errorContext['url'] = window.location.href.split('?')[0] ?? '';
      }

      // Report to Faro
      faro.api.pushError(new Error(scrubbedError.message), {
        context: errorContext,
        stackFrames: componentStack
          ? [{ filename: 'react-component-stack', function: componentStack }]
          : undefined,
        type: 'react-error-boundary',
      });

      // Also push as event for tracking
      faro.api.pushEvent('react_error_boundary', {
        boundary: componentName ?? 'FaroErrorBoundary',
        errorType: error.name,
        errorMessage: scrubbedError.message.substring(0, 100),
      });
    } catch {
      // Silently fail
    }
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Render fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }

      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <div
          style={{
            padding: '1rem',
            border: '1px solid #dc2626',
            borderRadius: '0.5rem',
            backgroundColor: '#fef2f2',
            color: '#7f1d1d',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>
            Something went wrong
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
            {process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={this.reset}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#dc2626',
              backgroundColor: 'white',
              border: '1px solid #dc2626',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap a component with FaroErrorBoundary.
 *
 * @param WrappedComponent - Component to wrap
 * @param options - Error boundary options
 * @returns Wrapped component
 *
 * @example
 * ```tsx
 * const SafeDashboard = withFaroErrorBoundary(Dashboard, {
 *   componentName: 'Dashboard',
 * });
 * ```
 */
export function withFaroErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<FaroErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary: React.FC<P> = (props) => (
    <FaroErrorBoundary componentName={displayName} {...options}>
      <WrappedComponent {...props} />
    </FaroErrorBoundary>
  );

  WithErrorBoundary.displayName = `withFaroErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}
