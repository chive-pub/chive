import type { Metadata } from 'next';

import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * Edit collection page metadata.
 */
export const metadata: Metadata = {
  title: 'Edit Collection',
  description: 'Edit your collection on Chive.',
};

/**
 * Layout for the edit collection page.
 *
 * @remarks
 * Protected by AuthGuard (requires authentication).
 */
export default function EditCollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PageContainer variant="narrow" as="main">
        {children}
      </PageContainer>
    </AuthGuard>
  );
}
