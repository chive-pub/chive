import { AlphaGate } from '@/components/alpha';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout';

/**
 * Layout for onboarding route group.
 *
 * @remarks
 * Provides layout for onboarding flows like account linking.
 * Protected by AuthGuard (requires authentication) and AlphaGate (requires alpha approval).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
