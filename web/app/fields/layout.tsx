import { AlphaGate } from '@/components/alpha';
import { PageContainer } from '@/components/layout';

/**
 * Layout for fields route group.
 *
 * @remarks
 * Provides a consistent layout for field-related pages.
 * Uses the "browse" variant for knowledge graph exploration.
 * Protected by AlphaGate during alpha period.
 */
export default function FieldsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlphaGate>
      <PageContainer variant="browse" as="main">
        {children}
      </PageContainer>
    </AlphaGate>
  );
}
