import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AuthorPageContent } from './author-content';
import { AuthorPageSkeleton } from './loading';
import { api } from '@/lib/api/client';

/**
 * Author page route parameters.
 */
interface AuthorPageProps {
  params: Promise<{
    did: string;
  }>;
}

/**
 * Generate metadata for author page.
 */
export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { did } = await params;
  const decodedDid = decodeURIComponent(did);

  try {
    const { data } = await api.GET('/xrpc/pub.chive.author.getProfile', {
      params: { query: { did: decodedDid } },
    });

    if (!data) {
      return { title: 'Author Not Found | Chive' };
    }

    const name = data.profile.displayName ?? data.profile.handle ?? decodedDid;
    const handle = data.profile.handle ?? '';
    const bio = data.profile.bio ?? '';
    const affiliation = (data.profile as { affiliation?: string }).affiliation ?? '';
    const avatar = data.profile.avatar;

    // Build OG image URL with query params for the author template
    const ogImageParams = new URLSearchParams({
      type: 'author',
      did: decodedDid,
      name: name.slice(0, 100),
      handle,
      bio: bio.slice(0, 200),
      affiliation,
      ...(avatar ? { avatar } : {}),
    });
    const ogImageUrl = `/api/og?${ogImageParams.toString()}`;

    return {
      title: `${name} | Chive`,
      description: bio || `Eprints by ${name} on Chive`,
      openGraph: {
        title: name,
        description: bio || `Eprints by ${name}`,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: name,
        description: bio || `Eprints by ${name}`,
        images: [ogImageUrl],
      },
    };
  } catch {
    return { title: 'Author | Chive' };
  }
}

/**
 * Author profile page component.
 *
 * @remarks
 * Server component that renders an author's profile page.
 * Includes header, stats, and list of eprints.
 *
 * @example
 * URL: /authors/did:plc:abc123
 */
export default async function AuthorPage({ params }: AuthorPageProps) {
  const { did } = await params;
  const decodedDid = decodeURIComponent(did);

  // Validate DID format
  if (!decodedDid.startsWith('did:')) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Suspense fallback={<AuthorPageSkeleton />}>
        <AuthorPageContent did={decodedDid} />
      </Suspense>
    </div>
  );
}
