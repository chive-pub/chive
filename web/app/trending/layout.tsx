import { PageContainer } from '@/components/layout';

/**
 * Layout for trending route group.
 *
 * @remarks
 * Provides layout for trending content pages.
 */
export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
