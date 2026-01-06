/**
 * Authentication types for Chive ATProto OAuth integration.
 *
 * @remarks
 * These types define the authentication state and user session
 * for the Chive frontend. Authentication uses ATProto OAuth with PKCE.
 *
 * @see {@link https://atproto.com/specs/oauth | ATProto OAuth Specification}
 */

/**
 * Decentralized identifier (DID) string.
 *
 * @remarks
 * Format: `did:method:identifier`
 * Supported methods: `did:plc:*`, `did:web:*`
 *
 * @example "did:plc:abc123xyz789"
 */
export type DID = `did:${string}:${string}`;

/**
 * ATProto handle (username).
 *
 * @remarks
 * Handles are domain-based identifiers that resolve to DIDs.
 *
 * @example "alice.bsky.social"
 */
export type Handle = string;

/**
 * Authenticated user information.
 *
 * @remarks
 * Retrieved from the user's PDS after successful authentication.
 */
export interface ChiveUser {
  /** Decentralized identifier */
  did: DID;

  /** ATProto handle */
  handle: Handle;

  /** Display name (optional, from profile) */
  displayName?: string;

  /** Bio/description (optional, from profile) */
  description?: string;

  /** Avatar URL (optional, from profile) */
  avatar?: string;

  /** User's PDS endpoint */
  pdsEndpoint: string;
}

/**
 * Authentication session tokens.
 *
 * @remarks
 * Access tokens are short-lived JWTs (1 hour).
 * Refresh tokens are opaque and long-lived (30 days).
 */
export interface AuthSession {
  /** JWT access token */
  accessToken: string;

  /** Opaque refresh token */
  refreshToken: string;

  /** Access token expiry timestamp (Unix ms) */
  expiresAt: number;

  /** Granted scopes */
  scope: string[];
}

/**
 * Full authentication state.
 */
export interface AuthState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Whether auth state is being loaded/verified */
  isLoading: boolean;

  /** Authenticated user (null if not authenticated) */
  user: ChiveUser | null;

  /** Session tokens (null if not authenticated) */
  session: AuthSession | null;

  /** Error message if authentication failed */
  error: string | null;
}

/**
 * Login options for initiating authentication.
 */
export interface LoginOptions {
  /** ATProto handle to authenticate (e.g., "alice.bsky.social") */
  handle?: string;

  /** PDS URL to authenticate against (optional, auto-discovered from handle) */
  pdsUrl?: string;

  /** URL to redirect to after successful login */
  redirectUrl?: string;
}

/**
 * Authentication actions available in the auth context.
 */
export interface AuthActions {
  /** Initiate login flow */
  login: (options: LoginOptions) => Promise<void>;

  /** Log out and clear session */
  logout: () => Promise<void>;

  /** Refresh the access token */
  refresh: () => Promise<void>;

  /** Get current access token (refreshes if needed) */
  getAccessToken: () => Promise<string | null>;
}

/**
 * Combined auth context value.
 */
export interface AuthContextValue extends AuthState, AuthActions {}

/**
 * OAuth callback parameters.
 *
 * @remarks
 * Received from PDS after user authorizes.
 */
export interface OAuthCallbackParams {
  /** Authorization code */
  code: string;

  /** State parameter for CSRF protection */
  state: string;

  /** Issuer (PDS URL) */
  iss?: string;
}

/**
 * Token response from OAuth token endpoint.
 */
export interface TokenResponse {
  /** JWT access token */
  access_token: string;

  /** Refresh token */
  refresh_token: string;

  /** Token type (always "Bearer") */
  token_type: 'Bearer';

  /** Expiry in seconds */
  expires_in: number;

  /** Granted scope (space-separated) */
  scope: string;

  /** Subject DID */
  sub: DID;
}
