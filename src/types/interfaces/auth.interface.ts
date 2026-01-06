/**
 * Authentication service interfaces for DID-based authentication.
 *
 * @remarks
 * Provides type definitions for authentication services including:
 * - DID-based authentication via AT Protocol
 * - Session token issuance and verification
 * - Token refresh and revocation
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * Token issuance options.
 *
 * @public
 */
export interface TokenOptions {
  /**
   * Token expiry in seconds.
   *
   * @remarks
   * Maximum allowed value is 3600 (1 hour) for access tokens.
   * Refresh tokens have a separate expiry controlled by the session manager.
   *
   * @defaultValue 3600
   */
  readonly expiresIn?: number;

  /**
   * Scopes to grant.
   *
   * @remarks
   * Scopes follow the format `{resource}:{action}` (e.g., "read:preprints").
   *
   * @example ["read:preprints", "write:reviews"]
   */
  readonly scope?: readonly string[];

  /**
   * Include refresh token in response.
   *
   * @defaultValue true
   */
  readonly includeRefreshToken?: boolean;

  /**
   * Session ID to associate with the token.
   *
   * @remarks
   * If not provided, a new session will be created.
   */
  readonly sessionId?: string;
}

/**
 * Authentication credential types.
 *
 * @remarks
 * Credentials used to authenticate with the PDS.
 *
 * @public
 */
export interface AuthCredential {
  /**
   * Credential type.
   *
   * @remarks
   * - `password`: User password (not recommended for production)
   * - `app_password`: Scoped application password
   * - `pds_token`: Pre-authenticated PDS session token
   * - `webauthn`: WebAuthn credential response
   */
  readonly type: 'password' | 'app_password' | 'pds_token' | 'webauthn';

  /**
   * Credential value.
   *
   * @remarks
   * For password/app_password: the password string
   * For pds_token: the session JWT from PDS
   * For webauthn: serialized PublicKeyCredential JSON
   */
  readonly value: string;
}

/**
 * Session token response.
 *
 * @remarks
 * Returned after successful authentication or token refresh.
 *
 * @public
 */
export interface SessionToken {
  /**
   * JWT access token.
   *
   * @remarks
   * Short-lived token (1 hour) for API access.
   * Signed with ES256 algorithm.
   */
  readonly accessToken: string;

  /**
   * Refresh token for obtaining new access tokens.
   *
   * @remarks
   * Single-use token that is rotated on each refresh.
   * Only included if `includeRefreshToken` was true.
   */
  readonly refreshToken?: string;

  /**
   * Access token expiry in seconds.
   */
  readonly expiresIn: number;

  /**
   * Token type.
   *
   * @remarks
   * Always "Bearer" per RFC 6750.
   */
  readonly tokenType: 'Bearer';

  /**
   * Granted scopes.
   *
   * @remarks
   * May be a subset of requested scopes if user
   * does not have all requested permissions.
   */
  readonly scope?: readonly string[];
}

/**
 * JWT token claims.
 *
 * @remarks
 * Standard JWT claims with Chive-specific extensions.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7519 | RFC 7519}
 *
 * @public
 */
export interface TokenClaims {
  /**
   * Subject - user's DID.
   */
  readonly sub: DID;

  /**
   * Issuer - Chive API URL.
   */
  readonly iss: string;

  /**
   * Audience - intended recipient.
   */
  readonly aud: string;

  /**
   * Expiration time (Unix timestamp).
   */
  readonly exp: number;

  /**
   * Issued at time (Unix timestamp).
   */
  readonly iat: number;

  /**
   * JWT ID - unique identifier.
   */
  readonly jti: string;

  /**
   * Granted scopes.
   */
  readonly scope?: readonly string[];

  /**
   * Associated session ID.
   */
  readonly sessionId?: string;

  /**
   * User's handle.
   */
  readonly handle?: string;
}

/**
 * MFA challenge response.
 *
 * @remarks
 * Returned when MFA is required to complete authentication.
 *
 * @public
 */
export interface MFAChallenge {
  /**
   * Challenge identifier.
   *
   * @remarks
   * Must be included when completing the MFA challenge.
   */
  readonly challengeId: string;

  /**
   * Available MFA methods.
   */
  readonly methods: readonly MFAMethod[];

  /**
   * Challenge expiry (Unix timestamp).
   */
  readonly expiresAt: number;
}

/**
 * MFA method descriptor.
 *
 * @public
 */
export interface MFAMethod {
  /**
   * Method type.
   */
  readonly type: 'totp' | 'webauthn' | 'backup_code';

  /**
   * Method identifier.
   *
   * @remarks
   * For webauthn, this is the credential ID.
   * For TOTP, this is a stable identifier.
   */
  readonly id: string;

  /**
   * Human-readable method name.
   *
   * @example "Authenticator app", "Security key - YubiKey"
   */
  readonly name?: string;
}

/**
 * Authentication result.
 *
 * @remarks
 * Returned from authentication attempts.
 *
 * @public
 */
export interface AuthenticationResult {
  /**
   * Whether authentication succeeded.
   *
   * @remarks
   * If true, `sessionToken` will be populated.
   * If false, `errors` will describe the failure.
   * If MFA is required, `mfaRequired` will be true.
   */
  readonly success: boolean;

  /**
   * Authenticated user's DID.
   *
   * @remarks
   * Only present if `success` is true or `mfaRequired` is true.
   */
  readonly did?: DID;

  /**
   * Session tokens.
   *
   * @remarks
   * Only present if `success` is true and MFA is not required.
   */
  readonly sessionToken?: SessionToken;

  /**
   * Whether MFA is required to complete authentication.
   *
   * @remarks
   * If true, client should prompt for MFA and call
   * `completeMFAChallenge` with the provided challenge.
   */
  readonly mfaRequired?: boolean;

  /**
   * MFA challenge details.
   *
   * @remarks
   * Present when `mfaRequired` is true.
   */
  readonly mfaChallenge?: MFAChallenge;

  /**
   * Error messages.
   *
   * @remarks
   * Present when `success` is false.
   */
  readonly errors?: readonly string[];
}

/**
 * Authentication service interface.
 *
 * @remarks
 * Provides DID-based authentication for AT Protocol users.
 * Issues short-lived JWTs for session management.
 *
 * @example
 * ```typescript
 * const authService = container.resolve<IAuthenticationService>('IAuthenticationService');
 *
 * const result = await authService.authenticateWithDID(
 *   'did:plc:abc123' as DID,
 *   { type: 'app_password', value: 'my-app-password' }
 * );
 *
 * if (result.success) {
 *   console.log('Access token:', result.sessionToken?.accessToken);
 * } else if (result.mfaRequired) {
 *   console.log('MFA required:', result.mfaChallenge?.methods);
 * }
 * ```
 *
 * @public
 */
export interface IAuthenticationService {
  /**
   * Authenticate user via DID and PDS credential verification.
   *
   * @remarks
   * Verifies the credential with the user's PDS and issues
   * a Chive session token upon successful authentication.
   *
   * Rate limit: 5 attempts per 15 minutes per IP address.
   *
   * @param did - User's decentralized identifier
   * @param credential - Authentication credential
   * @returns Authentication result with session token or MFA challenge
   *
   * @throws AuthenticationError if credential verification fails
   * @throws RateLimitError if rate limit exceeded
   *
   * @public
   */
  authenticateWithDID(did: DID, credential: AuthCredential): Promise<AuthenticationResult>;

  /**
   * Issue JWT session token for authenticated user.
   *
   * @remarks
   * Generates a new JWT access token and optional refresh token.
   * The access token is signed with ES256 and includes the user's
   * DID and granted scopes.
   *
   * @param did - Authenticated user's DID
   * @param options - Token options
   * @returns Session token with access and optional refresh token
   *
   * @public
   */
  issueSessionToken(did: DID, options?: TokenOptions): Promise<SessionToken>;

  /**
   * Refresh access token using valid refresh token.
   *
   * @remarks
   * Validates the refresh token and issues a new access token.
   * The refresh token is rotated (single-use) for security.
   *
   * @param refreshToken - Single-use refresh token
   * @returns New session token with rotated refresh token
   *
   * @throws AuthenticationError if refresh token is invalid or reused
   *
   * @public
   */
  refreshToken(refreshToken: string): Promise<SessionToken>;

  /**
   * Revoke token and invalidate session.
   *
   * @remarks
   * Adds the token to a blacklist in Redis. The token will be
   * rejected for all subsequent requests until it naturally expires.
   *
   * This method is idempotent.
   *
   * @param token - Access or refresh token to revoke
   *
   * @public
   */
  revokeToken(token: string): Promise<void>;

  /**
   * Verify JWT and extract claims.
   *
   * @remarks
   * Validates the JWT signature, expiration, issuer, and audience.
   * Checks if the token has been revoked.
   *
   * @param token - JWT access token
   * @returns Token claims if valid
   *
   * @throws TokenExpiredError if token has expired
   * @throws TokenValidationError if signature is invalid or token is revoked
   *
   * @public
   */
  verifyToken(token: string): Promise<TokenClaims>;

  /**
   * Complete MFA challenge.
   *
   * @remarks
   * Verifies the MFA code/credential and completes authentication
   * if successful.
   *
   * @param challengeId - Challenge ID from MFAChallenge
   * @param method - MFA method type used
   * @param value - MFA code or credential
   * @returns Authentication result with session token
   *
   * @throws AuthenticationError if MFA verification fails
   *
   * @public
   */
  completeMFAChallenge(
    challengeId: string,
    method: 'totp' | 'webauthn' | 'backup_code',
    value: string
  ): Promise<AuthenticationResult>;
}
