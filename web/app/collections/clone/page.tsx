'use client';

/**
 * Graph clone collection page.
 *
 * @remarks
 * Renders the graph clone wizard behind auth and alpha gates.
 * Users select nodes from the knowledge graph and save them as a
 * personal collection.
 */

import { AuthGuard } from '@/components/auth/auth-guard';
import { AlphaGate } from '@/components/alpha';
import { GraphCloneWizard } from '@/components/collection/graph-clone-wizard';

export default function CloneCollectionPage() {
  return (
    <AuthGuard>
      <AlphaGate>
        <div className="container max-w-4xl py-8">
          <GraphCloneWizard />
        </div>
      </AlphaGate>
    </AuthGuard>
  );
}
