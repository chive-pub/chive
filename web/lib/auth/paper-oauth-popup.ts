/**
 * Popup-based OAuth flow for paper accounts.
 *
 * @remarks
 * Handles OAuth authentication for paper accounts using a popup window.
 * This keeps the user's main session intact while authenticating a secondary account.
 *
 * **Flow:**
 * 1. Main window calls `authenticatePaperInPopup(handle)`
 * 2. Popup opens at `/oauth/paper-popup?handle={handle}`
 * 3. Popup redirects to paper's PDS for OAuth
 * 4. After OAuth, popup lands at `/oauth/paper-callback`
 * 5. Callback page posts session data to opener via `postMessage`
 * 6. Main window receives message and creates paper session
 * 7. Popup closes
 *
 * **Security:**
 * - Origin is validated on both sender and receiver
 * - Popup is opened by direct user action (avoids popup blockers)
 * - No credentials are passed through URL (only handle)
 *
 * @packageDocumentation
 */

import type { OAuthSession } from '@atproto/oauth-client-browser';
import { setPaperSession, type PaperSession } from './paper-session';
import { logger } from '@/lib/observability';

const paperOAuthLogger = logger.child({ component: 'paper-oauth-popup' });

/**
 * Message sent from popup callback to main window.
 */
export interface PaperOAuthMessage {
  type: 'paper-oauth-callback';
  success: boolean;
  session?: {
    did: string;
    handle: string;
    pdsEndpoint: string;
  };
  error?: string;
}

/**
 * State for pending popup OAuth flow.
 */
interface PopupState {
  resolve: (session: PaperSession) => void;
  reject: (error: Error) => void;
  popup: Window | null;
  handle: string;
  /**
   * Timers belonging to this attempt.
   *
   * @remarks
   * These used to live only in the promise closure, so the success path could
   * not clear them. The poll interval then ran forever, and the five-minute
   * timeout stayed armed against whatever attempt was pending when it finally
   * fired — a second authentication started within five minutes had its popup
   * closed and its promise left unsettled, which the UI showed as a spinner
   * that never stopped.
   */
  checkClosedTimer: ReturnType<typeof setInterval> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Clears the pending attempt and both of its timers.
 *
 * @returns The state that was pending, or null if there was none
 */
function takePendingPopup(): PopupState | null {
  const state = pendingPopup;
  pendingPopup = null;

  if (state?.checkClosedTimer) {
    clearInterval(state.checkClosedTimer);
  }
  if (state?.timeoutTimer) {
    clearTimeout(state.timeoutTimer);
  }

  return state;
}

/**
 * Currently pending popup authentication.
 */
let pendingPopup: PopupState | null = null;

/**
 * Message listener registered once.
 */
let messageListenerRegistered = false;

/**
 * Register the postMessage listener for popup callbacks.
 */
function ensureMessageListener(): void {
  if (messageListenerRegistered) return;

  window.addEventListener('message', handlePaperOAuthMessage);
  messageListenerRegistered = true;
}

/**
 * Handle postMessage from popup callback.
 *
 * @param event - Message event from popup
 */
function handlePaperOAuthMessage(event: MessageEvent): void {
  // Validate origin
  if (event.origin !== window.location.origin) {
    return;
  }

  const data = event.data as PaperOAuthMessage;

  // Check if this is a paper OAuth callback
  if (data?.type !== 'paper-oauth-callback') {
    return;
  }

  if (!pendingPopup) {
    paperOAuthLogger.warn('Received callback but no pending popup');
    return;
  }

  const { resolve, reject, popup } = pendingPopup;
  takePendingPopup();

  // Close the popup if still open
  if (popup && !popup.closed) {
    popup.close();
  }

  if (data.success && data.session) {
    // Create a mock OAuthSession for setPaperSession
    // The real session is already created in the popup
    const mockSession = {
      did: data.session.did,
      server: data.session.pdsEndpoint,
    } as unknown as OAuthSession;

    const paperSession = setPaperSession(
      mockSession,
      data.session.pdsEndpoint,
      data.session.handle
    );

    resolve(paperSession);
  } else {
    reject(new Error(data.error ?? 'Paper OAuth failed'));
  }
}

/**
 * Start OAuth flow for paper account in popup.
 *
 * @param paperHandle - Paper's ATProto handle (e.g., "my-paper.bsky.social")
 * @returns Promise resolving to paper session
 *
 * @remarks
 * Opens a popup window for OAuth flow. The user logs in with the paper
 * account's credentials. On success, the session is stored and returned.
 *
 * **Important:** Must be called from a direct user action (click handler)
 * to avoid popup blockers.
 *
 * @throws Error if popup is blocked
 * @throws Error if OAuth fails
 * @throws Error if popup is closed before completion
 *
 * @example
 * ```tsx
 * const handleAuthenticatePaper = async () => {
 *   try {
 *     const session = await authenticatePaperInPopup('my-paper.bsky.social');
 *     console.log(`Authenticated as ${session.paperHandle}`);
 *   } catch (error) {
 *     console.error('Paper auth failed:', error);
 *   }
 * };
 *
 * <Button onClick={handleAuthenticatePaper}>
 *   Authenticate Paper Account
 * </Button>
 * ```
 *
 * @public
 */
export async function authenticatePaperInPopup(paperHandle: string): Promise<PaperSession> {
  ensureMessageListener();

  // Check if there's already a pending popup
  if (pendingPopup) {
    throw new Error('Paper authentication already in progress');
  }

  // Build popup URL
  const popupUrl = new URL('/oauth/paper-popup', window.location.origin);
  popupUrl.searchParams.set('handle', paperHandle);

  // Open popup
  const popup = window.open(
    popupUrl.toString(),
    'paper-oauth',
    'width=500,height=700,popup=yes,toolbar=no,menubar=no,location=yes,status=yes'
  );

  if (!popup) {
    throw new Error('Failed to open popup - it may have been blocked by the browser');
  }

  // Create promise that will be resolved by the message handler
  return new Promise<PaperSession>((resolve, reject) => {
    pendingPopup = {
      resolve,
      reject,
      popup,
      handle: paperHandle,
      checkClosedTimer: null,
      timeoutTimer: null,
    };

    // Check if popup was closed without completing auth
    const checkClosed = setInterval(() => {
      if (popup.closed && pendingPopup) {
        takePendingPopup();
        reject(new Error('Popup was closed before authentication completed'));
      }
    }, 500);

    // Timeout after 5 minutes
    const timeoutTimer = setTimeout(
      () => {
        if (pendingPopup) {
          takePendingPopup();
          if (!popup.closed) {
            popup.close();
          }
          reject(new Error('Paper authentication timed out'));
        }
      },
      5 * 60 * 1000
    );

    if (pendingPopup) {
      pendingPopup.checkClosedTimer = checkClosed;
      pendingPopup.timeoutTimer = timeoutTimer;
    }
  });
}

/**
 * Cancel any pending paper authentication.
 *
 * @remarks
 * Closes the popup and rejects the pending promise.
 *
 * @public
 */
export function cancelPaperAuthentication(): void {
  if (pendingPopup) {
    const { popup, reject } = pendingPopup;
    takePendingPopup();

    if (popup && !popup.closed) {
      popup.close();
    }

    reject(new Error('Paper authentication cancelled'));
  }
}

/**
 * Check if paper authentication is in progress.
 *
 * @returns True if a popup is open
 *
 * @public
 */
export function isPaperAuthInProgress(): boolean {
  return pendingPopup !== null;
}

/**
 * Post session data from popup callback to opener window.
 *
 * @param session - Session data from OAuth callback
 *
 * @remarks
 * Called by the `/oauth/paper-callback` page after successful OAuth.
 * Posts the session data to the opener window and closes the popup.
 *
 * @public
 */
export function postPaperSessionToOpener(session: {
  did: string;
  handle: string;
  pdsEndpoint: string;
}): void {
  if (!window.opener) {
    paperOAuthLogger.error('No opener window found when posting session');
    return;
  }

  const message: PaperOAuthMessage = {
    type: 'paper-oauth-callback',
    success: true,
    session,
  };

  window.opener.postMessage(message, window.location.origin);
}

/**
 * Post error from popup callback to opener window.
 *
 * @param error - Error message
 *
 * @remarks
 * Called by the `/oauth/paper-callback` page if OAuth fails.
 *
 * @public
 */
export function postPaperErrorToOpener(error: string): void {
  if (!window.opener) {
    paperOAuthLogger.error('No opener window found when posting error', undefined, { error });
    return;
  }

  const message: PaperOAuthMessage = {
    type: 'paper-oauth-callback',
    success: false,
    error,
  };

  window.opener.postMessage(message, window.location.origin);
}
