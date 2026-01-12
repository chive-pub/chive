/**
 * Authentication and authorization module.
 *
 * @remarks
 * Provides comprehensive authentication and authorization services:
 * - DID-based authentication via AT Protocol
 * - OAuth 2.0 + PKCE flows
 * - JWT session management
 * - Role-based access control (RBAC)
 * - WebAuthn/Passkey support
 * - Multi-factor authentication
 * - Zero Trust architecture
 *
 * @packageDocumentation
 * @public
 */

export * from './errors.js';
export * from './did/index.js';
export * from './jwt/index.js';
export * from './session/index.js';
export * from './authorization/index.js';
export * from './webauthn/index.js';
export * from './mfa/index.js';
export * from './zero-trust/index.js';
export { AuthenticationService } from './authentication-service.js';
export type {
  AuthenticationServiceConfig,
  AuthenticationServiceOptions,
} from './authentication-service.js';
