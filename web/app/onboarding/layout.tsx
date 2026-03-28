import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * Layout for onboarding route group.
 *
 * @remarks
 * Provides layout for onboarding flows like account linking.
 * Protected by AuthGuard (requires authentication).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PageContainer variant="narrow" as="main">
        {children}
      </PageContainer>
    </AuthGuard>
  );
}
