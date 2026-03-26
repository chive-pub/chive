import { PageContainer } from '@/components/layout';

/**
 * Layout for coming-soon page.
 */
export default function ComingSoonLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="narrow" as="main">
      {children}
    </PageContainer>
  );
}
