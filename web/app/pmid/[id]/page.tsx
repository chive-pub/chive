/**
 * Canonical PubMed ID route: `/pmid/12345678`.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface PmidPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PmidPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `PMID ${id}`,
    description: `Chive resolver for PubMed ID ${id}`,
  };
}

export default async function PmidResolverPage({ params }: PmidPageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'pmid',
      identifier,
    });
    if (response.data.found) webPath = response.data.webPath;
  } catch {
    // Fall through.
  }
  if (webPath) redirect(webPath);
  notFound();
}
