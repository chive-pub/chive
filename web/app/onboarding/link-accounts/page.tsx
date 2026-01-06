'use client';

import { useRouter } from 'next/navigation';

import { AccountLinkingWizard } from '@/components/discovery/onboarding/account-linking-wizard';
import { useCurrentUser } from '@/lib/auth';

/**
 * Account linking onboarding page.
 *
 * @remarks
 * Guides new users through linking their academic accounts to enable
 * personalized paper recommendations.
 */
export default function LinkAccountsPage() {
  const router = useRouter();
  const user = useCurrentUser();

  const handleComplete = () => {
    // Navigate to dashboard after completing the wizard
    router.push('/dashboard');
  };

  const handleCancel = () => {
    // Navigate to dashboard if user skips onboarding
    router.push('/dashboard');
  };

  return (
    <div className="container max-w-3xl py-8">
      <AccountLinkingWizard
        displayName={user?.displayName}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
