import type { Metadata } from 'next';

import { AlphaGate } from '@/components/alpha';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * New collection page metadata.
 */
export const metadata: Metadata = {
  title: 'Create Collection',
  description: 'Create a curated collection of eprints, authors, and resources on Chive.',
};

/**
 * Layout for the new collection page.
 *
 * @remarks
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function NewCollectionLayout({ children }: { children: React.ReactNode }) {
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
