import type { Metadata } from 'next';

import { PageContainer } from '@/components/layout';

/**
 * Collection detail page metadata.
 */
export const metadata: Metadata = {
  title: 'Collection',
  description: 'View a curated collection of eprints, authors, and resources on Chive.',
};

/**
 * Layout for the collection detail page.
 *
 * @remarks
 * Uses the "reading" variant for comfortable content width on detail pages.
 */
export default function CollectionDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="reading" as="main">
      {children}
    </PageContainer>
  );
}
