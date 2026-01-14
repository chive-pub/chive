import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for authorities route group.
 *
 * @remarks
 * Provides layout for authority control records.
 * Protected by AlphaGate during alpha period.
 */
export default function AuthoritiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
