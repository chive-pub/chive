/**
 * AT Protocol repository module.
 *
 * @remarks
 * Provides read-only access to AT Protocol repositories (user PDSes).
 *
 * @packageDocumentation
 * @public
 */

export { ATRepository } from './at-repository.js';
export {
  type ATRepositoryConfig,
  type ATRepositoryOptions,
  DEFAULT_CONFIG,
} from './at-repository.config.js';
