import { PageContainer } from '@/components/layout';

/**
 * Layout for about page.
 */
export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="narrow" as="main">
      {children}
    </PageContainer>
  );
}
