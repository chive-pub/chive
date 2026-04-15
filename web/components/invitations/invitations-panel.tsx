'use client';

/**
 * Invitations panel showing the signed-in user's pending collaboration
 * invites and existing active collaborations.
 *
 * @remarks
 * Renders pending invites with accept / decline buttons, and accepted
 * invites with a "leave" option. Generic over subject type — in v1 we
 * render inline links to the subject record's canonical page.
 *
 * @packageDocumentation
 */

import { useMemo, useState } from 'react';
import { CheckCircle, XCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createLogger } from '@/lib/observability/logger';
import {
  useListInvites,
  useAcceptInvite,
  useWithdrawAcceptance,
  type CollaborationInviteView,
} from '@/lib/hooks/use-collaboration';

const logger = createLogger({ context: { component: 'invitations-panel' } });

/**
 * Props for {@link InvitationsPanel}.
 *
 * @public
 */
export interface InvitationsPanelProps {
  /** DID of the signed-in user viewing their inbox. */
  viewerDid: string;
}

/**
 * Collaboration invitations panel.
 *
 * @public
 */
export function InvitationsPanel({ viewerDid }: InvitationsPanelProps) {
  const pendingQuery = useListInvites({ invitee: viewerDid, state: 'pending' });
  const acceptedQuery = useListInvites({ invitee: viewerDid, state: 'accepted' });
  const acceptInvite = useAcceptInvite();
  const withdrawAcceptance = useWithdrawAcceptance();

  const pending = useMemo<CollaborationInviteView[]>(
    () => pendingQuery.data?.invites ?? [],
    [pendingQuery.data]
  );
  const accepted = useMemo<CollaborationInviteView[]>(
    () => acceptedQuery.data?.invites ?? [],
    [acceptedQuery.data]
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">Pending Invites</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((invite) => (
              <PendingInviteCard
                key={invite.uri}
                invite={invite}
                onAccept={async () => {
                  try {
                    await acceptInvite.mutateAsync({
                      inviteUri: invite.uri,
                      // cid lookup is via strongRef at write time — we persist
                      // the cid alongside the invite record on our side.
                      inviteCid: '',
                      subjectUri: invite.subjectUri,
                      subjectCid: '',
                    });
                    toast.success('Invitation accepted.');
                  } catch (err) {
                    logger.error('Accept failed', err);
                    toast.error('Could not accept invitation.');
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Active Collaborations</h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not currently collaborating on anything.</p>
        ) : (
          <div className="space-y-3">
            {accepted.map((invite) => (
              <AcceptedInviteCard
                key={invite.uri}
                invite={invite}
                onLeave={async () => {
                  if (!invite.acceptanceUri) return;
                  try {
                    await withdrawAcceptance.mutateAsync({
                      acceptanceUri: invite.acceptanceUri,
                    });
                    toast.success('Left the collaboration.');
                  } catch (err) {
                    logger.error('Withdraw failed', err);
                    toast.error('Could not leave.');
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Card for a pending invite with accept / decline actions.
 *
 * @internal
 */
function PendingInviteCard({
  invite,
  onAccept,
}: {
  invite: CollaborationInviteView;
  onAccept: () => Promise<void>;
}) {
  const [actioning, setActioning] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 pb-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{invite.role ?? 'collaborator'}</Badge>
            <SubjectLabel invite={invite} />
          </div>
          <p className="text-xs text-muted-foreground">
            from <code className="font-mono">{invite.inviter}</code>
          </p>
          {invite.message && <p className="text-sm italic">“{invite.message}”</p>}
        </div>
      </CardHeader>
      <CardContent className="flex gap-2 pt-0">
        <Button
          size="sm"
          disabled={actioning}
          onClick={async () => {
            setActioning(true);
            try {
              await onAccept();
            } finally {
              setActioning(false);
            }
          }}
        >
          <CheckCircle className="h-4 w-4 mr-1.5" />
          Accept
        </Button>
        <Button size="sm" variant="ghost" disabled title="Decline = ignore the invite">
          <XCircle className="h-4 w-4 mr-1.5" />
          Ignore
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Card for an accepted invite with leave action.
 *
 * @internal
 */
function AcceptedInviteCard({
  invite,
  onLeave,
}: {
  invite: CollaborationInviteView;
  onLeave: () => Promise<void>;
}) {
  const [actioning, setActioning] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 pb-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="default">{invite.role ?? 'collaborator'}</Badge>
            <SubjectLabel invite={invite} />
          </div>
          <p className="text-xs text-muted-foreground">
            with <code className="font-mono">{invite.inviter}</code>
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          size="sm"
          variant="ghost"
          disabled={actioning}
          onClick={async () => {
            setActioning(true);
            try {
              await onLeave();
            } finally {
              setActioning(false);
            }
          }}
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          Leave
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a link to the subject record.
 *
 * @internal
 */
function SubjectLabel({ invite }: { invite: CollaborationInviteView }) {
  // For collections (graph nodes with subkind=collection), link to the
  // collection detail page. For other subject types we render the AT-URI
  // directly — future iterations will resolve to subject-type-specific
  // pages as those get invite UIs.
  if (invite.subjectCollection === 'pub.chive.graph.node') {
    return (
      <Link
        href={`/collections/${encodeURIComponent(invite.subjectUri)}`}
        className="text-sm font-medium hover:underline"
      >
        collection
      </Link>
    );
  }
  return (
    <span className="text-sm font-mono text-muted-foreground truncate">{invite.subjectUri}</span>
  );
}
