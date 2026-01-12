'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/navigation';

/**
 * Paths where the header should be hidden.
 */
const HEADERLESS_PATHS = ['/', '/apply', '/pending'];

/**
 * Conditionally renders the site header.
 *
 * @remarks
 * Hides the header on alpha pages (landing, apply, pending) to provide
 * a simple, focused experience. Shows on all other pages.
 */
export function ConditionalHeader() {
  const pathname = usePathname();

  // Hide header on alpha-related pages
  if (HEADERLESS_PATHS.includes(pathname)) {
    return null;
  }

  return <SiteHeader />;
}
