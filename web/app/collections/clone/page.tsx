'use client';

/**
 * Graph clone collection page.
 *
 * @remarks
 * Renders the graph clone wizard behind auth gate.
 * Users select nodes from the knowledge graph and save them as a
 * personal collection.
 */

import { AuthGuard } from '@/components/auth/auth-guard';
import { GraphCloneWizard } from '@/components/collection/graph-clone-wizard';

export default function CloneCollectionPage() {
  return (
    <AuthGuard>
      <div className="container max-w-4xl py-8">
        <GraphCloneWizard />
      </div>
    </AuthGuard>
  );
}
