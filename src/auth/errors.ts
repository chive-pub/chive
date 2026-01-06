/**
 * Authentication and authorization error types.
 *
 * @remarks
 * Extends the base ChiveError hierarchy with auth-specific errors.
 * These errors map to appropriate HTTP status codes in the API layer.
 *
 * @packageDocumentation
 * @public
 */

import { ChiveError } from '../types/errors.js';

/**
 * Token validation error types.
 *
 * @public
 */
export type TokenErrorType =
  | 'expired'
  | 'invalid_signature'
  | 'invalid_claims'
  | 'invalid_token'
  | 'revoked'
  | 'malformed'
  | 'missing';

/**
 * Token validation error.
 *
 * @remarks
 * Thrown when JWT validation fails.
 * HTTP mapping: 401 Unauthorized
 *
 * @public
 */
export class TokenValidationError extends ChiveError {
  readonly code = 'TOKEN_VALIDATION_ERROR';

  /**
   * Specific token error type.
   */
  readonly tokenError: TokenErrorType;

  /**
   * Creates a new TokenValidationError.
   *
   * @param tokenError - Specific error type
   * @param message - Error message
   * @param cause - Original error
   */
  constructor(tokenError: TokenErrorType, message: string, cause?: Error) {
    super(message, cause);
    this.tokenError = tokenError;
  }
}

/**
 * Token expired error.
 *
 * @remarks
 * Thrown when a JWT has expired.
 * HTTP mapping: 401 Unauthorized
 *
 * @public
 */
export class TokenExpiredError extends TokenValidationError {
  /**
   * Token expiration timestamp.
   */
  readonly expiredAt: Date;

  /**
   * Creates a new TokenExpiredError.
   *
   * @param expiredAt - When the token expired
   */
  constructor(expiredAt: Date) {
    super('expired', `Token expired at ${expiredAt.toISOString()}`);
    this.expiredAt = expiredAt;
  }
}

/**
 * Session revoked error.
 *
 * @remarks
 * Thrown when attempting to use a revoked session.
 * HTTP mapping: 401 Unauthorized
 *
 * @public
 */
export class SessionRevokedError extends ChiveError {
  readonly code = 'SESSION_REVOKED';

  /**
   * Session ID that was revoked.
   */
  readonly sessionId: string;

  /**
   * Creates a new SessionRevokedError.
   *
   * @param sessionId - Revoked session ID
   */
  constructor(sessionId: string) {
    super('Session has been revoked');
    this.sessionId = sessionId;
  }
}

/**
 * MFA required error.
 *
 * @remarks
 * Thrown when MFA is required but not provided.
 * HTTP mapping: 401 Unauthorized with MFA challenge
 *
 * @public
 */
export class MFARequiredError extends ChiveError {
  readonly code = 'MFA_REQUIRED';

  /**
   * Challenge ID for MFA completion.
   */
  readonly challengeId: string;

  /**
   * Available MFA methods.
   */
  readonly methods: readonly string[];

  /**
   * Challenge expiration timestamp.
   */
  readonly expiresAt: Date;

  /**
   * Creates a new MFARequiredError.
   *
   * @param challengeId - Challenge identifier
   * @param methods - Available MFA methods
   * @param expiresAt - Challenge expiration
   */
  constructor(challengeId: string, methods: readonly string[], expiresAt: Date) {
    super('Multi-factor authentication required');
    this.challengeId = challengeId;
    this.methods = methods;
    this.expiresAt = expiresAt;
  }
}

/**
 * MFA verification error.
 *
 * @remarks
 * Thrown when MFA verification fails.
 * HTTP mapping: 401 Unauthorized
 *
 * @public
 */
export class MFAVerificationError extends ChiveError {
  readonly code = 'MFA_VERIFICATION_FAILED';

  /**
   * MFA method that failed.
   */
  readonly method: string;

  /**
   * Remaining attempts before lockout.
   */
  readonly attemptsRemaining?: number;

  /**
   * Creates a new MFAVerificationError.
   *
   * @param method - MFA method that failed
   * @param message - Error message
   * @param attemptsRemaining - Remaining attempts
   */
  constructor(method: string, message: string, attemptsRemaining?: number) {
    super(message);
    this.method = method;
    this.attemptsRemaining = attemptsRemaining;
  }
}

/**
 * WebAuthn error.
 *
 * @remarks
 * Thrown when WebAuthn operations fail.
 * HTTP mapping: 400 Bad Request or 401 Unauthorized
 *
 * @public
 */
export class WebAuthnError extends ChiveError {
  readonly code = 'WEBAUTHN_ERROR';

  /**
   * Specific WebAuthn error type.
   */
  readonly webauthnError:
    | 'registration_failed'
    | 'authentication_failed'
    | 'credential_not_found'
    | 'invalid_challenge'
    | 'counter_mismatch'
    | 'attestation_failed';

  /**
   * Creates a new WebAuthnError.
   *
   * @param webauthnError - Specific error type
   * @param message - Error message
   * @param cause - Original error
   */
  constructor(webauthnError: WebAuthnError['webauthnError'], message: string, cause?: Error) {
    super(message, cause);
    this.webauthnError = webauthnError;
  }
}

/**
 * Refresh token error.
 *
 * @remarks
 * Thrown when refresh token is invalid or reused.
 * HTTP mapping: 401 Unauthorized
 *
 * @public
 */
export class RefreshTokenError extends ChiveError {
  readonly code = 'REFRESH_TOKEN_ERROR';

  /**
   * Specific refresh token error.
   */
  readonly refreshError: 'invalid' | 'expired' | 'reused' | 'revoked';

  /**
   * Creates a new RefreshTokenError.
   *
   * @param refreshError - Specific error type
   * @param message - Error message
   */
  constructor(refreshError: RefreshTokenError['refreshError'], message: string) {
    super(message);
    this.refreshError = refreshError;
  }
}

/**
 * DID resolution error.
 *
 * @remarks
 * Thrown when DID resolution fails.
 * HTTP mapping: 400 Bad Request or 502 Bad Gateway
 *
 * @public
 */
export class DIDResolutionError extends ChiveError {
  readonly code = 'DID_RESOLUTION_ERROR';

  /**
   * DID that failed to resolve.
   */
  readonly did: string;

  /**
   * Specific resolution error.
   */
  readonly resolutionError: 'not_found' | 'network_error' | 'invalid_format' | 'timeout';

  /**
   * Creates a new DIDResolutionError.
   *
   * @param did - DID that failed
   * @param resolutionError - Specific error type
   * @param message - Error message
   * @param cause - Original error
   */
  constructor(
    did: string,
    resolutionError: DIDResolutionError['resolutionError'],
    message: string,
    cause?: Error
  ) {
    super(message, cause);
    this.did = did;
    this.resolutionError = resolutionError;
  }
}

/**
 * OAuth error.
 *
 * @remarks
 * Thrown for OAuth 2.0 protocol errors.
 * HTTP mapping: 400 Bad Request or 401 Unauthorized
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-5.2 | RFC 6749 Error Response}
 *
 * @public
 */
export class OAuthError extends ChiveError {
  readonly code = 'OAUTH_ERROR';

  /**
   * OAuth error code per RFC 6749.
   */
  readonly oauthError:
    | 'invalid_request'
    | 'invalid_client'
    | 'invalid_grant'
    | 'unauthorized_client'
    | 'unsupported_grant_type'
    | 'invalid_scope'
    | 'access_denied'
    | 'server_error';

  /**
   * OAuth error description.
   */
  readonly errorDescription?: string;

  /**
   * OAuth error URI for documentation.
   */
  readonly errorUri?: string;

  /**
   * Creates a new OAuthError.
   *
   * @param oauthError - OAuth error code
   * @param errorDescription - Error description
   * @param errorUri - Documentation URI
   */
  constructor(oauthError: OAuthError['oauthError'], errorDescription?: string, errorUri?: string) {
    super(errorDescription ?? oauthError);
    this.oauthError = oauthError;
    this.errorDescription = errorDescription;
    this.errorUri = errorUri;
  }
}

/**
 * PKCE validation error.
 *
 * @remarks
 * Thrown when PKCE code challenge/verifier validation fails.
 * HTTP mapping: 400 Bad Request
 *
 * @public
 */
export class PKCEError extends ChiveError {
  readonly code = 'PKCE_ERROR';

  /**
   * Specific PKCE error.
   */
  readonly pkceError: 'invalid_verifier' | 'missing_challenge' | 'method_not_supported';

  /**
   * Creates a new PKCEError.
   *
   * @param pkceError - Specific error type
   * @param message - Error message
   */
  constructor(pkceError: PKCEError['pkceError'], message: string) {
    super(message);
    this.pkceError = pkceError;
  }
}
