'use client';

/**
 * New proposal page.
 *
 * @remarks
 * Provides the form for creating governance proposals.
 * Requires AT Protocol authentication.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader } from '@/components/layout';
import { ProposalForm } from '@/components/governance';
import { useAuth } from '@/lib/auth/auth-context';
import type { Proposal } from '@/lib/api/schema';

export default function NewProposalPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  // Handle successful proposal creation
  const handleSuccess = (proposal: Proposal) => {
    router.push(`/governance/proposals/${proposal.id}`);
  };

  // Handle cancel
  const handleCancel = () => {
    router.push('/governance/proposals');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="New Proposal"
          description="Propose a change to the knowledge graph"
          showBack
          onBack={() => router.push('/governance/proposals')}
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
          title="New Proposal"
          description="Propose a change to the knowledge graph"
          showBack
          onBack={() => router.push('/governance/proposals')}
        />

        <Alert>
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You need to sign in with your AT Protocol account to create proposals. Your proposal
            will be stored in your Personal Data Server (PDS).
          </AlertDescription>
        </Alert>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">About Proposals</h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Chive uses a Wikipedia-style governance model where community members propose and vote
              on changes to the knowledge graph.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>Create new fields for emerging research areas</li>
              <li>Update existing field descriptions and relationships</li>
              <li>Merge duplicate or overlapping fields</li>
              <li>Deprecate outdated or unused fields</li>
            </ul>
          </div>
        </section>

        <div className="flex gap-4">
          <Button onClick={() => login({})}>Sign In to Propose</Button>
          <Button variant="outline" asChild>
            <Link href="/governance">Learn About Governance</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show proposal form when authenticated
  return (
    <div className="space-y-8">
      <PageHeader
        title="New Proposal"
        description="Propose a change to the knowledge graph"
        showBack
        onBack={() => router.push('/governance/proposals')}
      />

      <ProposalForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
