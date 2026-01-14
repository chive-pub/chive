import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TagDetailContent } from './tag-detail-content';
import { TagDetailSkeleton } from './loading';

/**
 * Tag detail page props.
 */
interface TagPageProps {
  params: Promise<{ tag: string }>;
}

/**
 * Generate metadata for tag page.
 */
export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  return {
    title: `${decodedTag} | Tags`,
    description: `Browse eprints tagged with "${decodedTag}" on Chive.`,
  };
}

/**
 * Tag detail page.
 *
 * @remarks
 * Displays all eprints with a specific tag.
 *
 * @example
 * URL: /tags/machine-learning
 */
export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  if (!decodedTag) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">#{decodedTag}</h1>
        <p className="mt-2 text-muted-foreground">Eprints tagged with &quot;{decodedTag}&quot;</p>
      </header>

      <Suspense fallback={<TagDetailSkeleton />}>
        <TagDetailContent tag={decodedTag} />
      </Suspense>
    </div>
  );
}
