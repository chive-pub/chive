/**
 * Canonical ISBN route: `/isbn/9780252067952`.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface IsbnPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: IsbnPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `ISBN ${id}`,
    description: `Chive resolver for ISBN ${id}`,
  };
}

export default async function IsbnResolverPage({ params }: IsbnPageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'isbn',
      identifier,
    });
    if (response.data.found) webPath = response.data.webPath;
  } catch {
    // Fall through.
  }
  if (webPath) redirect(webPath);
  notFound();
}
