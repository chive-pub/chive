import { Suspense } from 'react';
import type { Metadata } from 'next';

import { FieldDetailContent } from './field-content';
import { FieldDetailSkeleton } from './loading';
import { createServerClient } from '@/lib/api/client';

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
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.graph.getNode({
      id: decodedId,
      includeEdges: false,
    });
    const data = response.data;

    return {
      title: data.label,
      description: data.description ?? `Eprints in ${data.label} on Chive`,
    };
  } catch {
    return { title: 'Field' };
  }
}

/**
 * Field detail page component.
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
