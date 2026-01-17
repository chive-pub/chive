/**
 * Base schema exports for OpenAPI integration.
 *
 * @remarks
 * Re-exports `z` from `@hono/zod-openapi` which extends Zod with
 * `.openapi()` method for OpenAPI metadata. All schema files should
 * import `z` from this module instead of directly from 'zod'.
 *
 * @packageDocumentation
 * @public
 */

export { z } from '@hono/zod-openapi';
