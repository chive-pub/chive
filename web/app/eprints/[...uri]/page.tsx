import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EprintDetailContent } from './eprint-content';
import { EprintDetailSkeleton } from './loading';
import { EprintFaroErrorBoundary } from './eprint-error-boundary';
import { createServerClient } from '@/lib/api/client';
import type { Record as SubmissionRecord } from '@/lib/api/generated/types/pub/chive/eprint/submission';
import {
  buildEntityHeadTags,
  type EntityHeadTag,
  type EntityExternalId,
} from '@/lib/metadata/entity-metadata';
import { EntityHeadTags } from '@/lib/metadata/EntityHeadTags';

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

  // Build `<head>` tag descriptors for Zotero/Citoid/Semble aggregation.
  // Fetched here in addition to `generateMetadata` — Next.js request-level
  // dedup makes this effectively one network round-trip.
  let headTags: EntityHeadTag[] = [];
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.eprint.getSubmission({ uri: fullUri });
    const value = response.data.value as SubmissionRecord;
    const canonicalUrl = `https://chive.pub/eprints/${encodeURIComponent(fullUri)}`;
    const externalIds: EntityExternalId[] = [];
    const publishedDoi = value.publishedVersion?.doi;
    if (publishedDoi) {
      externalIds.push({
        system: 'doi',
        identifier: publishedDoi,
        uri: `https://doi.org/${publishedDoi}`,
      });
    }
    const ext = value.externalIds;
    if (ext) {
      if (ext.arxivId) {
        externalIds.push({
          system: 'arxiv',
          identifier: ext.arxivId,
          uri: `https://arxiv.org/abs/${ext.arxivId}`,
        });
      }
      if (ext.pmid) {
        externalIds.push({
          system: 'pmid',
          identifier: ext.pmid,
          uri: `https://pubmed.ncbi.nlm.nih.gov/${ext.pmid}`,
        });
      }
      if (ext.zenodoDoi) {
        externalIds.push({
          system: 'doi',
          identifier: ext.zenodoDoi,
          uri: `https://doi.org/${ext.zenodoDoi}`,
        });
      }
    }

    let abstractText = value.abstractPlainText ?? '';
    if (!abstractText && Array.isArray(value.abstract)) {
      abstractText = value.abstract
        .filter((item) => typeof item === 'object' && 'type' in item && item.type === 'text')
        .map((item) => (item as { type: 'text'; content: string }).content)
        .join(' ');
    }

    headTags = buildEntityHeadTags({
      atUri: fullUri,
      canonicalUrl,
      title: value.title,
      description: abstractText.slice(0, 500),
      entityType: 'research',
      authors: value.authors.map((a) => a.name ?? ''),
      publishedDate: value.createdAt,
      journalTitle: value.publishedVersion?.journal,
      externalIds,
    });
  } catch {
    // Head tags are best-effort; missing eprint returns empty tags.
  }

  return (
    <>
      <EntityHeadTags tags={headTags} />
      <Suspense fallback={<EprintDetailSkeleton />}>
        <EprintFaroErrorBoundary uri={fullUri}>
          <EprintDetailContent uri={fullUri} />
        </EprintFaroErrorBoundary>
      </Suspense>
    </>
  );
}
