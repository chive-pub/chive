import { PageContainer } from '@/components/layout';

/**
 * Layout for public legal pages (Terms, Privacy, Community Guidelines).
 *
 * @remarks
 * NOT wrapped in AlphaGate because OAuth spec requires tos_uri and
 * policy_uri to be publicly accessible, and users must be able to
 * read terms before authenticating.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer variant="reading" as="article">
      {children}
    </PageContainer>
  );
}
