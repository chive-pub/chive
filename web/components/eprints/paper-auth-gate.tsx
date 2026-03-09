'use client';

/**
 * Gate component for paper account authentication.
 *
 * @remarks
 * Wraps edit/delete actions for paper-centric eprints. Requires
 * paper account authentication before allowing modifications.
 *
 * @packageDocumentation
 */

import type { Agent } from '@atproto/api';
import { useState, type ReactNode } from 'react';

import { getPaperSession } from '@/lib/auth/paper-session';

import { PaperAuthPrompt } from './paper-auth-prompt';

/**
 * Eprint data for auth checking.
 */
interface EprintData {
  /** DID of the paper account (if paper-centric) */
  paperDid?: string;
}

/**
 * Props for PaperAuthGate.
 */
interface PaperAuthGateProps {
  /** Eprint data containing paperDid */
  eprint: EprintData;
  /** Render function that receives the paper agent (null if not paper-centric) */
  children: (paperAgent: Agent | null) => ReactNode;
  /** Callback when paper authentication succeeds */
  onAuthenticated?: () => void;
}

/**
 * Gate for paper-centric eprint modifications.
 *
 * @remarks
 * For paper-centric eprints (paperDid is set), this component shows
 * the authentication prompt instead of children until the user
 * authenticates as the paper account.
 *
 * For traditional eprints (no paperDid), children are rendered directly.
 *
 * @param props - component props
 * @param props.eprint - eprint data containing optional paperDid
 * @param props.children - render function receiving the paper agent (null if not paper-centric)
 * @param props.onAuthenticated - callback invoked when paper authentication succeeds
 * @returns React element rendering either children or auth prompt
 *
 * @example
 * ```tsx
 * <PaperAuthGate
 *   eprint={eprint}
 *   onAuthenticated={() => console.log('authenticated')}
 * >
 *   {(paperAgent) => <DeleteButton eprint={eprint} paperAgent={paperAgent} />}
 * </PaperAuthGate>
 * ```
 */
export function PaperAuthGate({ eprint, children, onAuthenticated }: PaperAuthGateProps) {
  const [isPaperAuthenticated, setIsPaperAuthenticated] = useState(false);

  // If not paper-centric, render children with no paper agent
  if (!eprint.paperDid) {
    return <>{children(null)}</>;
  }

  // For paper-centric eprints, require paper auth
  if (!isPaperAuthenticated) {
    return (
      <PaperAuthPrompt
        paperDid={eprint.paperDid}
        onSuccess={() => {
          setIsPaperAuthenticated(true);
          onAuthenticated?.();
        }}
      />
    );
  }

  // After auth, pass the paper agent to children
  const paperSession = getPaperSession(eprint.paperDid);
  return <>{children(paperSession?.agent ?? null)}</>;
}
