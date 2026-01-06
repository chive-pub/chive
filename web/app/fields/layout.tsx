import { PageContainer } from '@/components/layout';

/**
 * Layout for fields route group.
 *
 * @remarks
 * Provides a consistent layout for field-related pages.
 * Uses the "browse" variant for knowledge graph exploration.
 */
export default function FieldsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="browse" as="main">
      {children}
    </PageContainer>
  );
}
