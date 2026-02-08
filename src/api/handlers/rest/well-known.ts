/**
 * Well-known endpoint handlers.
 *
 * @remarks
 * Implements .well-known endpoints for service discovery and interoperability.
 * These endpoints follow IETF RFC 8615 conventions.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';

import type { ChiveEnv } from '../../types/context.js';

/**
 * Handler for /.well-known/site.standard.publication endpoint.
 *
 * @remarks
 * Returns the AT-URI of Chive's site.standard.publication record.
 * This enables cross-platform discovery of Chive as a publishing platform
 * within the ATProto ecosystem.
 *
 * Other ATProto publishing platforms can query this endpoint to:
 * - Discover Chive's publication identity
 * - Fetch Chive's publication metadata (name, description, avatar)
 * - Display Chive branding when showing aggregated content
 *
 * @param c - Hono context
 * @returns AT-URI pointing to the publication record
 *
 * @example Response:
 * ```
 * at://did:web:chive.pub/site.standard.publication/self
 * ```
 *
 * @public
 */
export function standardPublicationHandler(c: Context<ChiveEnv>): Response {
  // Get service DID from environment
  const serviceDid = process.env.CHIVE_SERVICE_DID ?? 'did:web:chive.pub';

  // Return the AT-URI pointing to Chive's publication record
  const publicationUri = `at://${serviceDid}/site.standard.publication/self`;

  return c.text(publicationUri, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
  });
}

/**
 * Registers well-known routes on a Hono app.
 *
 * @param app - Hono application instance
 *
 * @remarks
 * Registers:
 * - `/.well-known/site.standard.publication` - standard.site publication discovery
 *
 * @public
 */
export function registerWellKnownRoutes(app: Hono<ChiveEnv>): void {
  app.get('/.well-known/site.standard.publication', standardPublicationHandler);
}
