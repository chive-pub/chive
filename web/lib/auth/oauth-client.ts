/**
 * ATProto OAuth client for Chive authentication.
 *
 * @remarks
 * Uses the official @atproto/oauth-client-browser library which handles
 * all OAuth complexities including PKCE, DPoP, PAR, and session management.
 *
 * @see {@link https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser | ATProto OAuth Client}
 * @see {@link https://atproto.com/specs/oauth | ATProto OAuth Specification}
 */

import { BrowserOAuthClient, type OAuthSession } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import type { DID, Handle, ChiveUser, LoginOptions } from './types';

/**
 * Get the base URL for OAuth endpoints.
 *
 * @remarks
 * For local development with ATProto OAuth, you need a publicly accessible URL.
 * Set NEXT_PUBLIC_OAUTH_BASE_URL to your ngrok/tunnel URL:
 *
 * ```bash
 * # Start ngrok
 * ngrok http 3000
 *
 * # Set the environment variable (in .env.local)
 * NEXT_PUBLIC_OAUTH_BASE_URL=https://abc123.ngrok.io
 * ```
 *
 * For loopback development, ATProto requires 127.0.0.1 (NOT localhost).
 * This function automatically rewrites localhost to 127.0.0.1.
 */
function getOAuthBaseUrl(): string {
  // Check for explicit override (for ngrok/tunnel development)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_OAUTH_BASE_URL) {
    return process.env.NEXT_PUBLIC_OAUTH_BASE_URL;
  }

  // In browser, use current origin but rewrite localhost to 127.0.0.1
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // ATProto requires 127.0.0.1 for loopback, NOT localhost
    if (origin.includes('localhost')) {
      return origin.replace('localhost', '127.0.0.1');
    }
    return origin;
  }

  // Fallback for production
  return 'https://chive.pub';
}

/**
 * Get the OAuth client ID.
 *
 * @remarks
 * For loopback addresses, ATProto OAuth requires:
 * 1. The client ID must be 127.0.0.1 (NOT localhost)
 * 2. No path component (just origin)
 *
 * For production URLs, we use the full path to the client metadata document.
 *
 * @see {@link https://atproto.com/specs/oauth | ATProto OAuth Specification}
 */
function getClientId(): string {
  const baseUrl = getOAuthBaseUrl();
  const url = new URL(baseUrl);

  // ATProto requires 127.0.0.1 (NOT localhost) for loopback clients
  if (url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
    return url.origin; // No path for loopback
  }

  // localhost should be rewritten to 127.0.0.1 for ATProto compliance
  if (url.hostname === 'localhost') {
    return `http://127.0.0.1:${url.port || '3000'}`;
  }

  // For production, use full client metadata URL
  return `${baseUrl}/oauth/client-metadata.json`;
}

/**
 * Singleton BrowserOAuthClient instance.
 *
 * @remarks
 * The client is lazily initialized on first use and cached.
 * It manages session storage in IndexedDB automatically.
 */
let oauthClient: BrowserOAuthClient | null = null;
let clientInitPromise: Promise<BrowserOAuthClient> | null = null;

/**
 * Get or initialize the OAuth client.
 *
 * @remarks
 * The client handles:
 * - PKCE (Proof Key for Code Exchange)
 * - DPoP (Demonstrating Proof of Possession)
 * - PAR (Pushed Authorization Requests)
 * - Session storage in IndexedDB
 * - Automatic token refresh
 *
 * @returns Promise resolving to BrowserOAuthClient instance
 */
export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (oauthClient) return oauthClient;

  // Prevent multiple initialization attempts
  if (clientInitPromise) return clientInitPromise;

  const clientId = getClientId();

  clientInitPromise = BrowserOAuthClient.load({
    clientId,
    handleResolver: 'https://bsky.social',
  }).then((client) => {
    oauthClient = client;
    return client;
  });

  return clientInitPromise;
}

/**
 * Current OAuth session (set after successful authentication).
 */
let currentSession: OAuthSession | null = null;

/**
 * Current ATProto Agent (set after successful authentication).
 */
let currentAgent: Agent | null = null;

/**
 * Get the current OAuth session.
 */
export function getCurrentSession(): OAuthSession | null {
  return currentSession;
}

/**
 * Get the current ATProto Agent.
 *
 * @remarks
 * The agent can be used to make authenticated requests to the user's PDS.
 */
export function getCurrentAgent(): Agent | null {
  return currentAgent;
}

/**
 * Resolve a handle to a DID and PDS endpoint.
 *
 * @param handle - ATProto handle (e.g., "alice.bsky.social")
 * @returns DID and PDS endpoint
 */
export async function resolveHandle(handle: Handle): Promise<{ did: DID; pdsEndpoint: string }> {
  // Use the public API to resolve handle
  const response = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to resolve handle: ${handle}`);
  }

  const data = (await response.json()) as { did: string };
  const did = data.did as DID;

  // Get PDS endpoint from DID document
  const pdsEndpoint = await getPDSEndpoint(did);

  return { did, pdsEndpoint };
}

/**
 * Get PDS endpoint from DID document.
 *
 * @param did - User's DID
 * @returns PDS endpoint URL
 */
async function getPDSEndpoint(did: DID): Promise<string> {
  // Resolve DID to get service endpoint
  const plcUrl = did.startsWith('did:plc:') ? `https://plc.directory/${did}` : null;

  if (plcUrl) {
    const response = await fetch(plcUrl);
    if (response.ok) {
      const doc = (await response.json()) as {
        service?: Array<{ id: string; serviceEndpoint: string }>;
      };
      const pds = doc.service?.find((s) => s.id === '#atproto_pds');
      if (pds?.serviceEndpoint) {
        return pds.serviceEndpoint;
      }
    }
  }

  // Fallback to bsky.social
  return 'https://bsky.social';
}

/**
 * Start the OAuth login flow.
 *
 * @remarks
 * Uses the BrowserOAuthClient which handles PKCE, DPoP, and PAR automatically.
 *
 * @param options - Login options
 * @returns Authorization URL to redirect to
 */
export async function startLogin(options: LoginOptions): Promise<string> {
  const { handle } = options;

  if (!handle) {
    throw new Error('Handle is required');
  }

  const client = await getOAuthClient();

  try {
    // The signIn method initiates the OAuth flow
    // It will redirect to the authorization server
    const url = await client.authorize(handle, {
      scope: 'atproto transition:generic',
    });

    return url.toString();
  } catch (error) {
    console.error('OAuth authorize error:', error);
    throw error;
  }
}

/**
 * Initialize OAuth client and handle any pending callback.
 *
 * @remarks
 * Call this on app startup to:
 * 1. Handle OAuth callbacks (if returning from authorization)
 * 2. Restore existing sessions from IndexedDB
 *
 * @returns Session result if callback was handled, null otherwise
 */
export async function initializeOAuth(): Promise<{
  user: ChiveUser;
  session: OAuthSession;
  agent: Agent;
} | null> {
  const client = await getOAuthClient();

  // Check for OAuth callback parameters in URL
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (code && state) {
    // Handle the OAuth callback
    try {
      // The client will exchange the code for tokens
      const result = await client.callback(params);

      if (result?.session) {
        currentSession = result.session;
        currentAgent = new Agent(result.session);

        // Fetch user profile
        const user = await fetchUserProfile(result.session);

        // Clean up URL parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('iss');
        window.history.replaceState({}, '', url.toString());

        return { user, session: result.session, agent: currentAgent };
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  }

  return null;
}

/**
 * Restore an existing session.
 *
 * @remarks
 * Attempts to restore a session from IndexedDB storage.
 *
 * @param did - Optional DID to restore (uses any stored session if not provided)
 * @returns Session result if restored, null if no session
 */
export async function restoreSession(did?: string): Promise<{
  user: ChiveUser;
  session: OAuthSession;
  agent: Agent;
} | null> {
  const client = await getOAuthClient();

  try {
    // If no DID specified, try to find any active session
    const session = did ? await client.restore(did) : await tryRestoreAnySession(client);

    if (session) {
      currentSession = session;
      currentAgent = new Agent(session);

      const user = await fetchUserProfile(session);

      return { user, session, agent: currentAgent };
    }
  } catch (error) {
    console.error('Failed to restore session:', error);
  }

  return null;
}

/**
 * Try to restore any active session from storage.
 */
async function tryRestoreAnySession(client: BrowserOAuthClient): Promise<OAuthSession | null> {
  // The BrowserOAuthClient stores sessions in IndexedDB
  // We need to check if there's a stored session
  try {
    // Get all stored session DIDs
    const result = await client.init();
    if (result?.session) {
      return result.session;
    }
  } catch {
    // No stored session
  }

  return null;
}

/**
 * Extract PDS endpoint URL from session.
 *
 * @param session - OAuth session
 * @returns PDS endpoint URL string
 */
function getPdsEndpoint(session: OAuthSession): string {
  const server = session.server;
  if (!server) return 'https://bsky.social';

  // Handle URL object
  if (server instanceof URL) {
    return server.toString();
  }

  // Handle string
  if (typeof server === 'string') {
    return server;
  }

  // Handle object with href or origin property
  if (typeof server === 'object') {
    const serverObj = server as { href?: string; origin?: string; toString?: () => string };
    if (serverObj.href) return serverObj.href;
    if (serverObj.origin) return serverObj.origin;
    if (typeof serverObj.toString === 'function') {
      const str = serverObj.toString();
      if (str !== '[object Object]') return str;
    }
  }

  return 'https://bsky.social';
}

/**
 * Fetch user profile from PDS.
 *
 * @param session - OAuth session
 * @returns User profile
 */
async function fetchUserProfile(session: OAuthSession): Promise<ChiveUser> {
  const agent = new Agent(session);
  const pdsEndpoint = getPdsEndpoint(session);

  try {
    const profile = await agent.getProfile({ actor: session.did });

    return {
      did: session.did as DID,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
      description: profile.data.description,
      pdsEndpoint,
    };
  } catch (error) {
    console.error('Failed to fetch profile:', error);

    // Return minimal user info
    return {
      did: session.did as DID,
      handle: session.did,
      pdsEndpoint,
    };
  }
}

/**
 * Log out and clear all auth state.
 *
 * @remarks
 * Revokes the session with the authorization server and clears local storage.
 */
export async function logout(): Promise<void> {
  if (currentSession) {
    try {
      // Revoke the session
      await currentSession.signOut?.();
    } catch (error) {
      console.error('Session signOut error:', error);
    }
  }

  currentSession = null;
  currentAgent = null;
}

/**
 * Get current access token (refresh if needed).
 *
 * @remarks
 * The BrowserOAuthClient handles token refresh automatically.
 *
 * @returns Access token or null if not authenticated
 */
export function getAccessToken(): string | null {
  // The session handles token management internally
  // For direct access, use the agent instead
  return null;
}

/**
 * Check if access token needs refresh.
 *
 * @remarks
 * With BrowserOAuthClient, this is handled automatically.
 */
export function needsTokenRefresh(): boolean {
  return false;
}

/**
 * Refresh the access token.
 *
 * @remarks
 * With BrowserOAuthClient, this is handled automatically by the session.
 */
export async function refreshAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  throw new Error('Token refresh is handled automatically by BrowserOAuthClient');
}

// =============================================================================
// E2E TEST SUPPORT
// =============================================================================

/**
 * Counter for generating unique record keys in E2E tests.
 */
let e2eRecordCounter = 0;

/**
 * Set up a mock agent for E2E testing.
 *
 * @remarks
 * This creates a mock Agent that simulates PDS operations for E2E tests.
 * It follows the ATProto Agent interface pattern and returns mock data
 * for uploadBlob and createRecord operations.
 *
 * This approach follows industry best practices:
 * - Auth.js Testing Guide: "Mock External Services"
 * - Playwright Auth Guide: Use storageState for auth, mock external services
 *
 * @param userDid - The DID of the test user
 * @param userHandle - The handle of the test user
 * @see https://authjs.dev/guides/testing
 * @see https://playwright.dev/docs/auth
 */
export function setE2EMockAgent(userDid: string, userHandle: string): void {
  // Create a mock agent that implements the required Agent interface
  // for preprint submission (uploadBlob, com.atproto.repo.createRecord)
  // The Agent class in @atproto/api exposes `did` as a top-level getter
  const mockAgent = {
    // Top-level did property matching Agent class interface
    // This is what getAgentDid() checks: agent.did
    did: userDid,

    // Session information (for compatibility with session-based checks)
    session: {
      did: userDid,
      handle: userHandle,
      accessJwt: 'mock-e2e-access-jwt',
      refreshJwt: 'mock-e2e-refresh-jwt',
    },

    // Mock blob upload: returns a mock blob reference.
    uploadBlob: async (
      _data: Uint8Array | Blob,
      _opts?: { encoding: string }
    ): Promise<{ success: boolean; data: { blob: unknown } }> => {
      // Generate a mock CID (content identifier)
      const mockCid = `bafybeig${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

      return {
        success: true,
        data: {
          blob: {
            $type: 'blob',
            ref: { $link: mockCid },
            mimeType: 'application/pdf',
            size: _data instanceof Blob ? _data.size : (_data as Uint8Array).length,
          },
        },
      };
    },

    // ATProto repo operations
    com: {
      atproto: {
        repo: {
          // Mock createRecord: returns a mock record URI and CID.
          createRecord: async (params: {
            repo: string;
            collection: string;
            record: unknown;
            rkey?: string;
          }): Promise<{ data: { uri: string; cid: string } }> => {
            e2eRecordCounter++;
            const rkey = params.rkey || `e2e${Date.now().toString(36)}${e2eRecordCounter}`;
            const mockCid = `bafyreie2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

            return {
              data: {
                uri: `at://${params.repo}/${params.collection}/${rkey}`,
                cid: mockCid,
              },
            };
          },

          // Mock deleteRecord
          deleteRecord: async (_params: {
            repo: string;
            collection: string;
            rkey: string;
          }): Promise<{ success: boolean }> => {
            return { success: true };
          },
        },
      },
    },

    // Mock getProfile
    getProfile: async (params: {
      actor: string;
    }): Promise<{
      data: {
        did: string;
        handle: string;
        displayName?: string;
        description?: string;
        avatar?: string;
      };
    }> => {
      return {
        data: {
          did: params.actor,
          handle: userHandle,
          displayName: 'E2E Test User',
          description: 'Mock profile for E2E testing',
          avatar: undefined,
        },
      };
    },
  };

  // Set the mock agent as the current agent
  // TypeScript casting is needed because our mock doesn't implement the full Agent interface
  currentAgent = mockAgent as unknown as Agent;

  console.log('[E2E] Mock agent set for user:', userDid);
}

/**
 * Check if we're in E2E test mode.
 *
 * @returns True if E2E mock session data exists in localStorage
 */
export function isE2ETestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('chive_session_metadata') !== null;
}

/**
 * Clear E2E mock agent.
 */
export function clearE2EMockAgent(): void {
  currentAgent = null;
  currentSession = null;
}
