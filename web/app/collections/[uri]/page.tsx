import type { Metadata } from 'next';

import { CollectionDetailClient } from './collection-detail-client';
import { createServerClient } from '@/lib/api/client';
import type { CollectionDetailResponse } from '@/lib/hooks/use-collections';

/**
 * Collection detail route parameters.
 */
interface CollectionPageProps {
  params: Promise<{
    uri: string;
  }>;
}

/**
 * Generate metadata for the collection page, including Open Graph and
 * Twitter card data with a dynamic OG image.
 */
export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { uri: encodedUri } = await params;
  const decodedUri = decodeURIComponent(encodedUri);

  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.collection.get({ uri: decodedUri });
    const data = response.data as unknown as CollectionDetailResponse;
    const collection = data.collection;

    const description = collection.description
      ? collection.description.slice(0, 200)
      : `A curated collection of ${collection.itemCount} items on Chive.`;

    const ownerDisplay = collection.ownerHandle ?? collection.ownerDid;

    // Build OG image URL with query params for the collection template
    const ogImageParams = new URLSearchParams({
      type: 'collection',
      name: collection.label.slice(0, 200),
      owner: ownerDisplay,
      itemCount: String(collection.itemCount),
      visibility: collection.visibility,
    });
    if (collection.description) {
      ogImageParams.set('description', collection.description.slice(0, 150));
    }
    if (collection.tags && collection.tags.length > 0) {
      ogImageParams.set('tags', collection.tags.slice(0, 3).join(','));
    }

    const ogImageUrl = `/api/og?${ogImageParams.toString()}`;

    return {
      title: collection.label,
      description,
      openGraph: {
        title: collection.label,
        description,
        type: 'website',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: collection.label,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: collection.label,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: 'Collection' };
  }
}

/**
 * Collection detail page (server component).
 *
 * @remarks
 * Delegates rendering to CollectionDetailClient, which handles all
 * client-side data fetching and interactivity via TanStack Query hooks.
 */
export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { uri: encodedUri } = await params;
  const decodedUri = decodeURIComponent(encodedUri);

  return <CollectionDetailClient uri={decodedUri} />;
}
