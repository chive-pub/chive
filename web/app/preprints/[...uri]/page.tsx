import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PreprintDetailContent } from './preprint-content';
import { PreprintDetailSkeleton } from './loading';
import { api } from '@/lib/api/client';

/**
 * Preprint detail page route parameters.
 */
interface PreprintPageProps {
  params: Promise<{
    uri: string[];
  }>;
}

/**
 * Generate metadata for preprint page.
 */
export async function generateMetadata({ params }: PreprintPageProps): Promise<Metadata> {
  const { uri } = await params;
  const fullUri = decodeURIComponent(uri.join('/'));

  try {
    const { data } = await api.GET('/xrpc/pub.chive.preprint.getSubmission', {
      params: { query: { uri: fullUri } },
    });

    if (!data) {
      return { title: 'Preprint Not Found | Chive' };
    }

    // API returns the preprint directly (not wrapped in { preprint: ... })
    const preprint = data as unknown as {
      title: string;
      abstract: string;
      authors: Array<{ name: string; handle?: string; did?: string }>;
      createdAt: string;
      fields?: Array<{ label: string }>;
    };
    const firstAuthor = preprint.authors[0];
    const authorName = firstAuthor?.name ?? 'Unknown';
    const authorHandle = firstAuthor?.handle ?? '';
    const fieldLabels = preprint.fields?.map((f) => f.label).slice(0, 3) ?? [];

    // Build OG image URL with query params for the preprint template
    const ogImageParams = new URLSearchParams({
      type: 'preprint',
      uri: fullUri,
      title: preprint.title.slice(0, 200),
      author: authorName,
      handle: authorHandle,
      fields: fieldLabels.join(','),
    });
    const ogImageUrl = `/api/og?${ogImageParams.toString()}`;

    return {
      title: `${preprint.title} | Chive`,
      description: preprint.abstract.slice(0, 200),
      openGraph: {
        title: preprint.title,
        description: preprint.abstract.slice(0, 200),
        type: 'article',
        authors: [authorName],
        publishedTime: preprint.createdAt,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: preprint.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: preprint.title,
        description: preprint.abstract.slice(0, 200),
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: 'Preprint | Chive' };
  }
}

/**
 * Preprint detail page component.
 *
 * @remarks
 * Server component that renders a preprint's detail page.
 * Uses catch-all route to handle AT Protocol URIs which contain slashes.
 *
 * @example
 * URL: /preprints/at://did:plc:abc/pub.chive.preprint.submission/123
 */
export default async function PreprintPage({ params }: PreprintPageProps) {
  const { uri } = await params;

  // Reconstruct the AT URI from path segments
  const fullUri = decodeURIComponent(uri.join('/'));

  // Validate it looks like an AT URI
  if (!fullUri.startsWith('at://')) {
    notFound();
  }

  return (
    <Suspense fallback={<PreprintDetailSkeleton />}>
      <PreprintDetailContent uri={fullUri} />
    </Suspense>
  );
}
