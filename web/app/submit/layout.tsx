import type { Metadata } from 'next';

import { PageContainer } from '@/components/layout';

/**
 * Submit page metadata.
 */
export const metadata: Metadata = {
  title: 'Submit a Preprint | Chive',
  description:
    'Submit your research to Chive, a decentralized preprint server built on AT Protocol.',
};

/**
 * Layout for the submit page.
 *
 * @remarks
 * Uses a narrow container for form content.
 */
export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="narrow" as="main">
      {children}
    </PageContainer>
  );
}
