import { Suspense } from 'react';
import type { Metadata } from 'next';

import { BrowsePageContent } from './browse-content';
import { BrowsePageSkeleton } from './loading';

/**
 * Browse page metadata.
 */
export const metadata: Metadata = {
  title: 'Browse Eprints',
  description:
    'Browse eprints using our 10-dimensional faceted classification system based on PMEST and FAST.',
};

/**
 * Browse page route parameters.
 */
interface BrowsePageProps {
  searchParams: Promise<{
    q?: string;
    personality?: string | string[];
    matter?: string | string[];
    energy?: string | string[];
    space?: string | string[];
    time?: string | string[];
    person?: string | string[];
    organization?: string | string[];
    event?: string | string[];
    work?: string | string[];
    formGenre?: string | string[];
  }>;
}

/**
 * Browse page component.
 *
 * @remarks
 * Server component that renders the faceted browse page.
 * Supports URL-based filter state for shareable links.
 *
 * @example
 * URL: /browse?personality=physics&matter=quantum&person=einstein
 */
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;

  // Normalize params to arrays
  const normalizedParams = {
    q: params.q,
    personality: normalizeParam(params.personality),
    matter: normalizeParam(params.matter),
    energy: normalizeParam(params.energy),
    space: normalizeParam(params.space),
    time: normalizeParam(params.time),
    person: normalizeParam(params.person),
    organization: normalizeParam(params.organization),
    event: normalizeParam(params.event),
    work: normalizeParam(params.work),
    formGenre: normalizeParam(params.formGenre),
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Browse</h1>
        <p className="mt-2 text-muted-foreground">
          Explore eprints using 10-dimensional faceted classification
        </p>
      </header>

      <Suspense fallback={<BrowsePageSkeleton />}>
        <BrowsePageContent initialParams={normalizedParams} />
      </Suspense>
    </div>
  );
}

/**
 * Normalizes a search param value to an array.
 */
function normalizeParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
