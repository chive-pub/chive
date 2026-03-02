import { PageContainer } from '@/components/layout';

/**
 * Layout for the collection detail page.
 *
 * @remarks
 * Uses the "reading" variant for comfortable content width on detail pages.
 * Metadata is generated dynamically by page.tsx via generateMetadata.
 */
export default function CollectionDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="reading" as="main">
      {children}
    </PageContainer>
  );
}
