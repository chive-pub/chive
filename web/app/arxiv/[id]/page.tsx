/**
 * Canonical arXiv route: `/arxiv/2301.12345`.
 *
 * @remarks
 * Resolves an arXiv identifier to the Chive entity that declares it
 * (eprint submission or graph node) and redirects. See
 * `web/app/doi/[...id]/page.tsx` for the shared convention.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface ArxivPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ArxivPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `arXiv ${id}`,
    description: `Chive resolver for arXiv ${id}`,
  };
}

export default async function ArxivResolverPage({ params }: ArxivPageProps) {
  const { id } = await params;
  const identifier = decodeURIComponent(id);

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'arxiv',
      identifier,
    });
    if (response.data.found) webPath = response.data.webPath;
  } catch {
    // Fall through.
  }
  if (webPath) redirect(webPath);
  notFound();
}
