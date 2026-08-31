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
  // This used to answer `at://<serviceDid>/site.standard.publication/self`
  // unconditionally. Two things were wrong with that, and they compound:
  //
  //   - No such record exists. The collection is absent from the service
  //     repository entirely, so a reader following the URI gets nothing.
  //   - `self` is not a legal record key here. `site.standard.publication`
  //     declares `key: tid`, so the rkey is a timestamp identifier and cannot
  //     be a fixed literal.
  //
  // Advertising a URI that cannot resolve is worse than advertising none: it
  // reads as a broken publication rather than an unconfigured one. So the URI
  // is now configuration, and absent configuration this answers 404.
  const publicationUri = process.env.CHIVE_PUBLICATION_URI;

  if (!publicationUri) {
    return c.text('No publication record is configured for this deployment.', 404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  }

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
