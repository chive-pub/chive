/**
 * Canonical ROR route: `/ror/02nr0ka47`.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface RorPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RorPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `ROR ${id}`,
    description: `Chive resolver for ROR ${id}`,
  };
}

export default async function RorResolverPage({ params }: RorPageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'ror',
      identifier,
    });
    if (response.data.found) webPath = response.data.webPath;
  } catch {
    // Fall through.
  }
  if (webPath) redirect(webPath);
  notFound();
}
