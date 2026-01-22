/**
 * React hook for accessing Faro instance.
 *
 * @remarks
 * Provides access to the Faro API for custom instrumentation.
 *
 * @packageDocumentation
 */

'use client';

import { useCallback, useMemo } from 'react';
import type { Faro, PushLogOptions } from '@grafana/faro-web-sdk';
import { LogLevel } from '@grafana/faro-web-sdk';

import { getFaro } from '../initialize';
import { scrubObject, scrubError } from '../privacy';
import type { UserContext } from '../session';

/**
 * Faro hook return type.
 */
export interface UseFaroReturn {
  /** Faro instance (null if not initialized) */
  faro: Faro | null;
  /** Whether Faro is available */
  isAvailable: boolean;
  /** Push a custom event */
  pushEvent: (name: string, attributes?: Record<string, string>) => void;
  /** Push an error */
  pushError: (error: Error, context?: Record<string, string>) => void;
  /** Push a log message */
  pushLog: (
    message: string,
    level?: 'debug' | 'info' | 'warn' | 'error',
    context?: Record<string, unknown>
  ) => void;
  /** Set user context */
  setUser: (user: UserContext) => void;
  /** Clear user context */
  clearUser: () => void;
  /** Push a measurement */
  pushMeasurement: (name: string, values: Record<string, number>) => void;
}

/**
 * Map log level string to Faro LogLevel.
 */
function mapLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogLevel {
  switch (level) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Hash a string for privacy (simple hash, not cryptographic).
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

/**
 * Hook to access Faro API.
 *
 * @returns Faro API methods
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { pushEvent, pushError } = useFaro();
 *
 *   const handleClick = () => {
 *     pushEvent('button_click', { buttonId: 'submit' });
 *   };
 *
 *   const handleError = (error: Error) => {
 *     pushError(error, { component: 'MyComponent' });
 *   };
 * }
 * ```
 */
export function useFaro(): UseFaroReturn {
  const faro = getFaro();
  const isAvailable = faro !== null;

  const pushEvent = useCallback(
    (name: string, attributes?: Record<string, string>) => {
      if (!faro) return;

      try {
        // Scrub attributes for privacy
        const scrubbed = attributes
          ? (scrubObject(attributes) as Record<string, string>)
          : undefined;
        faro.api.pushEvent(name, scrubbed);
      } catch {
        // Silently fail
      }
    },
    [faro]
  );

  const pushError = useCallback(
    (error: Error, context?: Record<string, string>) => {
      if (!faro) return;

      try {
        const scrubbed = scrubError(error);
        const scrubbedContext = context
          ? (scrubObject(context) as Record<string, string>)
          : undefined;

        faro.api.pushError(new Error(scrubbed.message), {
          context: scrubbedContext,
          stackFrames: scrubbed.stack
            ? [{ filename: 'unknown', function: scrubbed.stack }]
            : undefined,
        });
      } catch {
        // Silently fail
      }
    },
    [faro]
  );

  const pushLog = useCallback(
    (
      message: string,
      level: 'debug' | 'info' | 'warn' | 'error' = 'info',
      context?: Record<string, unknown>
    ) => {
      if (!faro) return;

      try {
        const scrubbed = scrubObject({ message, ...context }) as { message: string };
        const options: PushLogOptions = {
          level: mapLogLevel(level),
          context: context ? (scrubObject(context) as Record<string, string>) : undefined,
        };
        faro.api.pushLog([scrubbed.message], options);
      } catch {
        // Silently fail
      }
    },
    [faro]
  );

  const setUser = useCallback(
    (user: UserContext) => {
      if (!faro) return;

      try {
        faro.api.setUser({
          id: user.id ? hashString(user.id) : undefined,
          username: user.username ? 'authenticated' : undefined,
          email: user.email ? 'provided' : undefined,
          attributes: user.attributes,
        });
      } catch {
        // Silently fail
      }
    },
    [faro]
  );

  const clearUser = useCallback(() => {
    if (!faro) return;

    try {
      faro.api.resetUser();
    } catch {
      // Silently fail
    }
  }, [faro]);

  const pushMeasurement = useCallback(
    (name: string, values: Record<string, number>) => {
      if (!faro) return;

      try {
        faro.api.pushMeasurement({
          type: name,
          values,
        });
      } catch {
        // Silently fail
      }
    },
    [faro]
  );

  return useMemo(
    () => ({
      faro,
      isAvailable,
      pushEvent,
      pushError,
      pushLog,
      setUser,
      clearUser,
      pushMeasurement,
    }),
    [faro, isAvailable, pushEvent, pushError, pushLog, setUser, clearUser, pushMeasurement]
  );
}
