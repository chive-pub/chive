import { Suspense } from 'react';
import type { Metadata } from 'next';

import { FieldDetailContent } from './field-content';
import { FieldDetailSkeleton } from './loading';
import { api } from '@/lib/api/client';

/**
 * Field detail page route parameters.
 */
interface FieldPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Generate metadata for field page.
 */
export async function generateMetadata({ params }: FieldPageProps): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  try {
    const { data } = await api.GET('/xrpc/pub.chive.graph.getField', {
      params: {
        query: {
          id: decodedId,
          includeRelationships: false,
          includeChildren: false,
          includeAncestors: false,
        },
      },
    });

    if (!data) {
      return { title: 'Field Not Found | Chive' };
    }

    return {
      title: `${data.name} | Chive`,
      description: data.description ?? `Preprints in ${data.name} on Chive`,
    };
  } catch {
    return { title: 'Field | Chive' };
  }
}

/**
 * Field detail page component.
 *
 * @remarks
 * Server component that renders a field's detail page.
 * Includes hierarchy, relationships, and preprints.
 *
 * @example
 * URL: /fields/computer-science
 */
export default async function FieldPage({ params }: FieldPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  return (
    <Suspense fallback={<FieldDetailSkeleton />}>
      <FieldDetailContent fieldId={decodedId} />
    </Suspense>
  );
}
