import type { Metadata } from 'next';

import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * Submit page metadata.
 */
export const metadata: Metadata = {
  title: 'Submit an Eprint',
  description: 'Submit your research to Chive, a decentralized eprint service on ATProto.',
};

/**
 * Layout for the submit page.
 *
 * @remarks
 * Uses a narrow container for form content.
 * Protected by AuthGuard (requires authentication).
 */
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PageContainer variant="narrow" as="main">
        {children}
      </PageContainer>
    </AuthGuard>
  );
}
