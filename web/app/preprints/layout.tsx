import { PageContainer } from '@/components/layout';

/**
 * Layout for preprints route group.
 *
 * @remarks
 * Provides a consistent layout for preprint-related pages.
 * Uses the "browse" variant for list views; detail pages
 * can override with their own width constraints.
 */
export default function PreprintsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
