import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EprintDetailContent } from './eprint-content';
import { EprintDetailSkeleton } from './loading';
import { api } from '@/lib/api/client';

/**
 * Eprint detail page route parameters.
 */
interface EprintPageProps {
  params: Promise<{
    uri: string[];
  }>;
}

/**
 * Generate metadata for eprint page.
 */
export async function generateMetadata({ params }: EprintPageProps): Promise<Metadata> {
  const { uri } = await params;
  const fullUri = decodeURIComponent(uri.join('/'));

  try {
    const { data } = await api.GET('/xrpc/pub.chive.eprint.getSubmission', {
      params: { query: { uri: fullUri } },
    });

    if (!data) {
      return { title: 'Eprint Not Found' };
    }

    // API returns the eprint directly (not wrapped in { eprint: ... })
    const eprint = data as unknown as {
      title: string;
      abstract: string;
      authors: Array<{ name: string; handle?: string; did?: string }>;
      createdAt: string;
      fields?: Array<{ label: string }>;
    };
    const firstAuthor = eprint.authors[0];
    const authorName = firstAuthor?.name ?? 'Unknown';
    const authorHandle = firstAuthor?.handle ?? '';
    const fieldLabels = eprint.fields?.map((f) => f.label).slice(0, 3) ?? [];

    // Build OG image URL with query params for the eprint template
    const ogImageParams = new URLSearchParams({
      type: 'eprint',
      uri: fullUri,
      title: eprint.title.slice(0, 200),
      author: authorName,
      handle: authorHandle,
      fields: fieldLabels.join(','),
    });
    const ogImageUrl = `/api/og?${ogImageParams.toString()}`;

    return {
      title: eprint.title,
      description: eprint.abstract.slice(0, 200),
      openGraph: {
        title: eprint.title,
        description: eprint.abstract.slice(0, 200),
        type: 'article',
        authors: [authorName],
        publishedTime: eprint.createdAt,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: eprint.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: eprint.title,
        description: eprint.abstract.slice(0, 200),
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: 'Eprint' };
  }
}

/**
 * Eprint detail page component.
 *
 * @remarks
 * Server component that renders an eprint's detail page.
 * Uses catch-all route to handle AT Protocol URIs which contain slashes.
 *
 * @example
 * URL: /eprints/at://did:plc:abc/pub.chive.eprint.submission/123
 */
export default async function EprintPage({ params }: EprintPageProps) {
  const { uri } = await params;

  // Reconstruct the AT URI from path segments
  const fullUri = decodeURIComponent(uri.join('/'));

  // Validate it looks like an AT URI
  if (!fullUri.startsWith('at://')) {
    notFound();
  }

  return (
    <Suspense fallback={<EprintDetailSkeleton />}>
      <EprintDetailContent uri={fullUri} />
    </Suspense>
  );
}
