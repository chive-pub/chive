import { PageContainer } from '@/components/layout';

/**
 * Layout for search route group.
 *
 * @remarks
 * Provides a consistent layout for search-related pages.
 * Uses the "browse" variant (max-w-7xl) for search results.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
