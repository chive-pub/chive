import { PageContainer } from '@/components/layout';

/**
 * Layout for authors route group.
 *
 * @remarks
 * Provides a consistent layout for author profile pages.
 * Uses the "browse" variant for author listings.
 */
export default function AuthorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
