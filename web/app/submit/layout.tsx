import type { Metadata } from 'next';

import { AlphaGate } from '@/components/alpha';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * Submit page metadata.
 */
export const metadata: Metadata = {
  title: 'Submit an Eprint',
  description: 'Submit your research to Chive, a decentralized eprint server built on AT Protocol.',
};

/**
 * Layout for the submit page.
 *
 * @remarks
 * Uses a narrow container for form content.
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
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
