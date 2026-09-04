import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AuthorPageContent } from './author-content';
import { AuthorPageSkeleton } from './loading';
import { createServerClient } from '@/lib/api/client';
import { resolveChivePublication } from '@/lib/metadata/publication-link';

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
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.author.getProfile({ did: decodedDid });
    const data = response.data;

    const name = data.profile.displayName ?? data.profile.handle ?? decodedDid;
    const handle = data.profile.handle ?? '';
    const bio = data.profile.bio ?? '';
    const affiliation = data.profile.affiliation ?? '';
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
      title: name,
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
    return { title: 'Author' };
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

  // This page is the url an author's Chive publication names, which makes it
  // that publication's home page. Bluesky will not render an enhanced card for
  // any article in a publication whose home page does not advertise it, so the
  // link belongs here as much as on the eprint.
  const publicationUri = await resolveChivePublication(decodedDid);

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {publicationUri && <link rel="site.standard.publication" href={publicationUri} />}
      <Suspense fallback={<AuthorPageSkeleton />}>
        <AuthorPageContent did={decodedDid} />
      </Suspense>
    </div>
  );
}
