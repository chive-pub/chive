/**
 * OAuth 2.0 module with PKCE support.
 *
 * @remarks
 * Implements OAuth 2.0 authorization code flow per RFC 6749
 * with PKCE extension per RFC 7636.
 *
 * @packageDocumentation
 * @public
 */

export { OAuthService } from './oauth-service.js';
export type {
  AuthorizationRequest,
  TokenRequest,
  TokenResponse,
  OAuthServiceConfig,
  OAuthServiceOptions,
} from './oauth-service.js';

export { OAuthClientManager } from './oauth-client.js';
export type {
  ClientType,
  GrantType,
  OAuthClient,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  OAuthClientManagerConfig,
  OAuthClientManagerOptions,
} from './oauth-client.js';

export {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  verifyCodeChallenge,
} from './pkce.js';
export type { CodeChallengeMethod, PKCEPair } from './pkce.js';
