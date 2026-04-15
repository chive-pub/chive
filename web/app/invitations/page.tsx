'use client';

/**
 * Collaboration invitations page.
 *
 * @remarks
 * Shows the signed-in user their pending and active collaboration
 * invitations. Unified inbox across any Chive subject type that supports
 * collaboration (collections in v1).
 *
 * @packageDocumentation
 */

import { InvitationsPanel } from '@/components/invitations/invitations-panel';
import { useCurrentUser } from '@/lib/auth';

export default function InvitationsPage() {
  const user = useCurrentUser();

  if (!user?.did) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-muted-foreground">Sign in to view your collaboration invitations.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pending and active collaboration invitations across your Chive records.
        </p>
      </header>
      <InvitationsPanel viewerDid={user.did} />
    </main>
  );
}
