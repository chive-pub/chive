'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/navigation';

/**
 * Paths where the header should be hidden.
 */
const HEADERLESS_PATHS = ['/login'];

/**
 * Conditionally renders the site header.
 *
 * @remarks
 * Hides the header on the login page to provide
 * a simple, focused experience. Shows on all other pages.
 */
export function ConditionalHeader() {
  const pathname = usePathname();

  // Hide header on headerless pages
  if (HEADERLESS_PATHS.includes(pathname)) {
    return null;
  }

  return <SiteHeader />;
}
