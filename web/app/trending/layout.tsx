import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for trending route group.
 *
 * @remarks
 * Provides layout for trending content pages.
 * Protected by AlphaGate during alpha period.
 */
export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
