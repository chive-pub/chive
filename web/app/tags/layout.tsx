import { PageContainer } from '@/components/layout';

/**
 * Layout for tags route group.
 *
 * @remarks
 * Provides a consistent layout for tag browsing pages.
 * Uses the "browse" variant for list/grid views.
 */
export default function TagsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
