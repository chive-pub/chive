import type { Metadata } from 'next';

import { AlphaGate } from '@/components/alpha';
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
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function EditCollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AlphaGate>
        <PageContainer variant="narrow" as="main">
          {children}
        </PageContainer>
      </AlphaGate>
    </AuthGuard>
  );
}
