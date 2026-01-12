'use client';

/**
 * Submit page component.
 *
 * @remarks
 * Provides the eprint submission wizard.
 * Requires AT Protocol authentication.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/layout';
import { SubmissionWizard } from '@/components/submit';
import { useAuth } from '@/lib/auth/auth-context';
import type { CreateRecordResult } from '@/lib/atproto';

export default function SubmitPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  // Handle successful submission
  const handleSuccess = (result: CreateRecordResult) => {
    // Redirect to the newly created eprint
    const encodedUri = encodeURIComponent(result.uri);
    router.push(`/eprints/${encodedUri}?new=true`);
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Submit a Eprint"
          description="Share your research with the world through decentralized publishing"
        />
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">
            Loading authentication status...
          </div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Submit a Eprint"
          description="Share your research with the world through decentralized publishing"
        />

        <Alert>
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You need to sign in with your AT Protocol account to submit a eprint. Your eprint
            will be stored in your Personal Data Server (PDS), giving you full control over your
            research.
          </AlertDescription>
        </Alert>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">How It Works</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Unlike traditional eprint servers, Chive doesn&apos;t store your eprints. Instead,
              your work lives in your Personal Data Server (PDS) on AT Protocol.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>Your PDF is uploaded to your PDS, not Chive&apos;s servers</li>
              <li>You maintain full ownership and control of your data</li>
              <li>Chive indexes your eprint and makes it discoverable</li>
              <li>You can update or remove your eprint at any time</li>
            </ul>
          </div>
        </section>

        <div className="flex gap-4">
          <Button onClick={() => login({})}>Sign In to Submit</Button>
          <Button variant="outline" asChild>
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show submission wizard when authenticated
  return (
    <div className="space-y-8">
      <PageHeader
        title="Submit a Eprint"
        description="Share your research with the world through decentralized publishing"
      />

      <SubmissionWizard onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
