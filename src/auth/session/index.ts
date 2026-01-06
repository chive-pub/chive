/**
 * Session management module.
 *
 * @remarks
 * Provides session lifecycle management and refresh token handling.
 *
 * @packageDocumentation
 * @public
 */

export { SessionManager } from './session-manager.js';
export type { SessionManagerConfig, SessionManagerOptions } from './session-manager.js';
export { RefreshTokenManager } from './refresh-token-manager.js';
export type {
  RefreshTokenManagerConfig,
  RefreshTokenManagerOptions,
  RefreshToken,
  RefreshTokenData,
} from './refresh-token-manager.js';
