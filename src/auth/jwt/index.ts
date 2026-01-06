/**
 * JWT authentication module.
 *
 * @remarks
 * Provides JWT issuance, verification, and key management using ES256.
 *
 * @packageDocumentation
 * @public
 */

export { KeyManager } from './key-manager.js';
export type { KeyPair, KeyManagerConfig, KeyManagerOptions } from './key-manager.js';
export { JWTService } from './jwt-service.js';
export type {
  JWTServiceConfig,
  JWTServiceOptions,
  IssueTokenOptions,
  IssuedToken,
  VerifiedToken,
} from './jwt-service.js';
