/**
 * Canonical DOI route: `/doi/10.1234/foo`.
 *
 * @remarks
 * Resolves a DOI to its corresponding Chive entity (eprint or graph node)
 * via `pub.chive.resolve.byExternalId` and redirects to the entity's
 * canonical page. DOIs contain slashes, so we use a catch-all route
 * (`[...id]`) and reconstruct the DOI from the path segments.
 *
 * This URL format is what Chive emits in `<link rel="alternate">` tags
 * on entity pages and in Cosmik card metadata, so cross-app crawlers
 * (Citoid, Zotero, Semble) can canonically identify a paper by DOI
 * regardless of which Chive record declares it.
 *
 * @packageDocumentation
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { createServerClient } from '@/lib/api/client';

interface DoiPageProps {
  params: Promise<{ id: string[] }>;
}

export async function generateMetadata({ params }: DoiPageProps): Promise<Metadata> {
  const { id } = await params;
  const doi = id.join('/');
  return {
    title: `DOI ${doi}`,
    description: `Chive resolver for DOI ${doi}`,
  };
}

export default async function DoiResolverPage({ params }: DoiPageProps) {
  const { id } = await params;
  const doi = decodeURIComponent(id.join('/'));

  let webPath: string | undefined;
  try {
    const serverApi = createServerClient();
    const response = await serverApi.pub.chive.resolve.byExternalId({
      system: 'doi',
      identifier: doi,
    });
    if (response.data.found) {
      webPath = response.data.webPath;
    }
  } catch {
    // Fall through to notFound below.
  }

  if (webPath) {
    redirect(webPath);
  }
  notFound();
}
