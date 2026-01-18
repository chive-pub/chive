/**
 * Paper PDS session management.
 *
 * @remarks
 * Manages OAuth sessions for paper accounts (separate from the user's main session).
 * Paper sessions are in-memory only (not persisted across page refreshes by design).
 *
 * **ATProto Compliance:**
 * - Users authenticate with paper account credentials directly
 * - No cross-repo writing (ATProto OAuth constraint)
 * - DPoP tokens are per-session and not shared
 *
 * **Session Lifecycle:**
 * 1. User clicks "Authenticate Paper Account"
 * 2. Popup opens with OAuth flow for paper account
 * 3. On success, session stored here (not in `currentAgent`)
 * 4. Paper session used for record creation when selected
 * 5. Session cleared when wizard closes or page refreshes
 *
 * @packageDocumentation
 */

import { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import type { DID, Handle } from './types';

/**
 * Paper session data.
 *
 * @public
 */
export interface PaperSession {
  /**
   * Paper account DID.
   */
  readonly paperDid: DID;

  /**
   * Paper account handle.
   */
  readonly paperHandle: Handle;

  /**
   * ATProto Agent for the paper account.
   */
  readonly agent: Agent;

  /**
   * PDS endpoint URL.
   */
  readonly pdsEndpoint: string;

  /**
   * When the paper session was authenticated.
   */
  readonly authenticatedAt: number;

  /**
   * Original OAuth session (for debugging/token refresh).
   */
  readonly session: OAuthSession;
}

/**
 * In-memory storage for paper sessions (separate from main user session).
 *
 * @remarks
 * Keyed by paper DID. Only one paper session is typically needed at a time,
 * but we support multiple for future use cases.
 */
const paperSessions = new Map<string, PaperSession>();

/**
 * Currently active paper session (for the submission wizard).
 */
let activePaperDid: string | null = null;

/**
 * Store a paper session after successful popup OAuth.
 *
 * @param session - OAuth session from paper account login
 * @param pdsEndpoint - Paper's PDS endpoint URL
 * @param handle - Paper's handle
 * @returns Paper session object
 *
 * @remarks
 * Creates an Agent from the OAuth session and stores it.
 * Also sets this as the active paper session.
 *
 * @example
 * ```typescript
 * // In popup callback handler
 * const session = await handleOAuthCallback();
 * const paperSession = setPaperSession(session, pdsEndpoint, handle);
 * console.log(`Authenticated as ${paperSession.paperHandle}`);
 * ```
 *
 * @public
 */
export function setPaperSession(
  session: OAuthSession,
  pdsEndpoint: string,
  handle: string
): PaperSession {
  const agent = new Agent(session);

  const paperSession: PaperSession = {
    paperDid: session.did as DID,
    paperHandle: handle as Handle,
    agent,
    pdsEndpoint,
    authenticatedAt: Date.now(),
    session,
  };

  paperSessions.set(session.did, paperSession);
  activePaperDid = session.did;

  return paperSession;
}

/**
 * Get paper session by DID.
 *
 * @param paperDid - Paper account DID
 * @returns Paper session or null if not found
 *
 * @public
 */
export function getPaperSession(paperDid: string): PaperSession | null {
  return paperSessions.get(paperDid) ?? null;
}

/**
 * Get the currently active paper session.
 *
 * @remarks
 * Returns the session that was most recently authenticated.
 * Used by the submission wizard to determine which agent to use.
 *
 * @returns Active paper session or null
 *
 * @public
 */
export function getActivePaperSession(): PaperSession | null {
  if (!activePaperDid) return null;
  return paperSessions.get(activePaperDid) ?? null;
}

/**
 * Check if there's an active paper session.
 *
 * @returns True if a paper session is active
 *
 * @public
 */
export function hasPaperSession(): boolean {
  return activePaperDid !== null && paperSessions.has(activePaperDid);
}

/**
 * Clear a specific paper session.
 *
 * @param paperDid - Paper DID to clear (optional, clears active if not specified)
 *
 * @public
 */
export function clearPaperSession(paperDid?: string): void {
  const didToClear = paperDid ?? activePaperDid;

  if (didToClear) {
    paperSessions.delete(didToClear);

    if (activePaperDid === didToClear) {
      activePaperDid = null;
    }
  }
}

/**
 * Clear all paper sessions.
 *
 * @remarks
 * Called when the user leaves the submission wizard or logs out.
 *
 * @public
 */
export function clearAllPaperSessions(): void {
  paperSessions.clear();
  activePaperDid = null;
}

/**
 * Check if a paper session is still valid.
 *
 * @param paperDid - Paper account DID
 * @param maxAgeMs - Maximum session age in milliseconds (default: 1 hour)
 * @returns True if session exists and is not expired
 *
 * @remarks
 * Sessions older than maxAgeMs are considered invalid.
 * Default is 1 hour, which is conservative for ATProto OAuth tokens.
 *
 * @public
 */
export function isPaperSessionValid(paperDid: string, maxAgeMs: number = 3600000): boolean {
  const session = paperSessions.get(paperDid);

  if (!session) return false;

  const age = Date.now() - session.authenticatedAt;
  return age < maxAgeMs;
}

/**
 * Get the paper agent for record creation.
 *
 * @returns Paper Agent or null if no active session
 *
 * @remarks
 * Use this when creating records to submit to a paper's PDS.
 *
 * @example
 * ```typescript
 * const paperAgent = getPaperAgent();
 * if (paperAgent) {
 *   await createEprintRecord(userAgent, data, paperAgent);
 * }
 * ```
 *
 * @public
 */
export function getPaperAgent(): Agent | null {
  const session = getActivePaperSession();
  return session?.agent ?? null;
}

/**
 * Get all stored paper sessions (for debugging).
 *
 * @returns Array of paper sessions
 *
 * @internal
 */
export function getAllPaperSessions(): PaperSession[] {
  return Array.from(paperSessions.values());
}
