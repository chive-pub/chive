import { PageContainer } from '@/components/layout';

/**
 * Layout for eprints route group.
 *
 * @remarks
 * Provides a consistent layout for eprint-related pages.
 * Uses the "browse" variant for list views; detail pages
 * can override with their own width constraints.
 */
export default function EprintsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
