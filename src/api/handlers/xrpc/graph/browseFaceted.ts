/**
 * XRPC handler for pub.chive.graph.browseFaceted.
 *
 * @remarks
 * Browse preprints using PMEST (Personality, Matter, Energy, Space, Time)
 * faceted classification. Supports dynamic refinement based on selected facets.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  browseFacetedParamsSchema,
  facetedBrowseResponseSchema,
  type BrowseFacetedParams,
  type FacetedBrowseResponse,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.browseFaceted query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated faceted browse parameters
 * @returns Matching preprints with available facet refinements
 *
 * @remarks
 * PMEST Facets:
 * - Personality: Discipline/subject (e.g., "physics", "biology")
 * - Matter: Material/substance (e.g., "graphene", "protein")
 * - Energy: Process/action (e.g., "synthesis", "analysis")
 * - Space: Location/geography (e.g., "arctic", "laboratory")
 * - Time: Time period/era (e.g., "2020s", "prehistoric")
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.browseFaceted?personality=physics&energy=simulation
 *
 * Response:
 * {
 *   "preprints": [...],
 *   "facets": {
 *     "matter": [{ "value": "graphene", "count": 15 }, ...],
 *     "space": [{ "value": "laboratory", "count": 42 }, ...]
 *   },
 *   "total": 150
 * }
 * ```
 *
 * @public
 */
export async function browseFacetedHandler(
  c: Context<ChiveEnv>,
  params: BrowseFacetedParams
): Promise<FacetedBrowseResponse> {
  const { graph } = c.get('services');
  const logger = c.get('logger');

  const facets = {
    personality: params.personality,
    matter: params.matter,
    energy: params.energy,
    space: params.space,
    time: params.time,
  };

  logger.debug('Browsing faceted', {
    facets,
    limit: params.limit,
  });

  // Call graph service with faceted browse query
  const results = await graph.browseFaceted({
    facets,
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

  // Map service response to API response format
  // Uses `hits` to match frontend SearchResultsResponse interface
  const response: FacetedBrowseResponse = {
    hits: results.preprints.map((p) => ({
      uri: p.uri as string,
      cid: p.cid,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors.map((a) => ({
        did: a.did,
        name: a.name,
        orcid: a.orcid,
        email: a.email,
        order: a.order,
        affiliations: a.affiliations.map((af) => ({
          name: af.name,
          rorId: af.rorId,
          department: af.department,
        })),
        contributions: a.contributions.map((c) => ({
          typeUri: c.typeUri,
          typeId: c.typeId,
          typeLabel: c.typeLabel,
          degree: c.degree,
        })),
        isCorrespondingAuthor: a.isCorrespondingAuthor,
        isHighlighted: a.isHighlighted,
        handle: a.handle,
        avatarUrl: a.avatarUrl,
      })),
      submittedBy: p.submittedBy,
      paperDid: p.paperDid,
      fields: p.fields?.map((f) => ({
        uri: f.uri,
        name: f.name,
        id: f.id,
        parentUri: f.parentUri,
      })),
      license: p.license ?? 'CC-BY-4.0',
      keywords: p.keywords ? [...p.keywords] : undefined,
      createdAt: p.createdAt.toISOString(),
      indexedAt: p.indexedAt.toISOString(),
      source: {
        pdsEndpoint: p.source.pdsEndpoint,
        recordUrl: p.source.recordUrl,
        blobUrl: p.source.blobUrl,
        lastVerifiedAt: p.source.lastVerifiedAt?.toISOString(),
        stale: p.source.stale,
      },
      score: p.score,
    })),
    facets: {
      personality: results.availableFacets.personality?.map((f) => ({
        value: f.value,
        label: f.label,
        count: f.count,
      })),
      matter: results.availableFacets.matter?.map((f) => ({
        value: f.value,
        label: f.label,
        count: f.count,
      })),
      energy: results.availableFacets.energy?.map((f) => ({
        value: f.value,
        label: f.label,
        count: f.count,
      })),
      space: results.availableFacets.space?.map((f) => ({
        value: f.value,
        label: f.label,
        count: f.count,
      })),
      time: results.availableFacets.time?.map((f) => ({
        value: f.value,
        label: f.label,
        count: f.count,
      })),
    },
    cursor: results.cursor,
    hasMore: results.hasMore,
    total: results.total,
  };

  logger.info('Faceted browse completed', {
    facets,
    total: results.total,
    returned: response.hits.length,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.graph.browseFaceted.
 *
 * @public
 */
export const browseFacetedEndpoint: XRPCEndpoint<BrowseFacetedParams, FacetedBrowseResponse> = {
  method: 'pub.chive.graph.browseFaceted' as never,
  type: 'query',
  description: 'Browse preprints using PMEST faceted classification',
  inputSchema: browseFacetedParamsSchema,
  outputSchema: facetedBrowseResponseSchema,
  handler: browseFacetedHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
