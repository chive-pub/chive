/**
 * Canonical ORCID route: `/orcid/0000-0001-2345-6789`.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface OrcidPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrcidPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `ORCID ${id}`,
    description: `Chive resolver for ORCID ${id}`,
  };
}

export default async function OrcidResolverPage({ params }: OrcidPageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'orcid',
      identifier,
    });
    if (response.data.found) webPath = response.data.webPath;
  } catch {
    // Fall through.
  }
  if (webPath) redirect(webPath);
  notFound();
}
