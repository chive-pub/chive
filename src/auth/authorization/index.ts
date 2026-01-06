/**
 * Authorization module using Casbin RBAC.
 *
 * @remarks
 * Provides role-based access control with hierarchical roles
 * and resource ownership checks.
 *
 * @packageDocumentation
 * @public
 */

export { AuthorizationService } from './authorization-service.js';
export type {
  AuthorizationServiceConfig,
  AuthorizationServiceOptions,
} from './authorization-service.js';
