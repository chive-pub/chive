/**
 * Authentication and authorization module.
 *
 * @remarks
 * Provides comprehensive authentication and authorization services:
 * - DID-based authentication via AT Protocol
 * - OAuth 2.0 + PKCE flows
 * - Role-based access control (RBAC)
 * - Zero Trust architecture
 *
 * Chive does not offer second-factor authentication. The WebAuthn, TOTP and
 * JWT-session layer that once lived here was never reachable — no route, no
 * handler and no service imported it — and its credentials were held only in
 * Redis with TTLs, so a flush would have locked users out of a factor they
 * could never have enrolled in. It was removed rather than wired up. Identity
 * comes from AT Protocol OAuth and service auth; authorization comes from
 * roles.
 *
 * @packageDocumentation
 * @public
 */

export * from './errors.js';
export * from './did/index.js';
export * from './jwt/index.js';
export * from './authorization/index.js';
export * from './zero-trust/index.js';
