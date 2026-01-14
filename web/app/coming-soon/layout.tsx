import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for coming-soon page.
 *
 * @remarks
 * Protected by AlphaGate during alpha period.
 */
export default function ComingSoonLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="narrow" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
