import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EprintDetailContent } from './eprint-content';
import { EprintDetailSkeleton } from './loading';
import { createServerClient } from '@/lib/api/client';
import type { Record as SubmissionRecord } from '@/lib/api/generated/types/pub/chive/eprint/submission';

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
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.eprint.getSubmission({ uri: fullUri });
    const data = response.data;

    // Cast value to SubmissionRecord type (value is unknown per ATProto pattern)
    const value = data.value as SubmissionRecord;
    const firstAuthor = value.authors[0];
    const authorName = firstAuthor?.name ?? 'Unknown';

    // Extract plain text abstract from rich content items
    let abstractText = value.abstractPlainText ?? '';
    if (!abstractText && Array.isArray(value.abstract)) {
      abstractText = value.abstract
        .filter((item) => typeof item === 'object' && 'type' in item && item.type === 'text')
        .map((item) => (item as { type: 'text'; content: string }).content)
        .join(' ');
    }

    // Build OG image URL with query params for the eprint template
    const ogImageParams = new URLSearchParams({
      type: 'eprint',
      uri: fullUri,
      title: value.title.slice(0, 200),
      author: authorName,
    });
    const ogImageUrl = `/api/og?${ogImageParams.toString()}`;

    return {
      title: value.title,
      description: abstractText.slice(0, 200),
      openGraph: {
        title: value.title,
        description: abstractText.slice(0, 200),
        type: 'article',
        authors: [authorName],
        publishedTime: value.createdAt,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: value.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: value.title,
        description: abstractText.slice(0, 200),
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
