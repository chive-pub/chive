'use client';

/**
 * Faro initialization component for early observability setup.
 *
 * @remarks
 * This component initializes Grafana Faro as early as possible in the
 * React lifecycle to capture errors during hydration. It should be
 * placed at the root of the application, before other providers.
 *
 * @packageDocumentation
 */

import { useEffect, useRef } from 'react';
import { initializeFaro, initWebVitals } from '@/lib/observability/faro';

/**
 * Props for FaroInit component.
 */
export interface FaroInitProps {
  /** Disable Faro initialization (for testing) */
  disabled?: boolean;
  /** Disable Web Vitals tracking */
  disableWebVitals?: boolean;
}

/**
 * Initialize Faro observability early in the React lifecycle.
 *
 * @remarks
 * Place this component at the root of your application to ensure
 * errors during hydration are captured. This component renders null
 * and only handles Faro initialization.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <FaroInit />
 *         <Providers>{children}</Providers>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function FaroInit({ disabled = false, disableWebVitals = false }: FaroInitProps) {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initializedRef.current || disabled) return;
    initializedRef.current = true;

    // Initialize Faro
    const faro = initializeFaro();

    // Initialize Web Vitals tracking
    if (!disableWebVitals && faro) {
      initWebVitals();
    }
  }, [disabled, disableWebVitals]);

  // This component renders nothing
  return null;
}
