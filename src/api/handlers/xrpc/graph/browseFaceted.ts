/**
 * XRPC handler for pub.chive.graph.browseFaceted.
 *
 * @remarks
 * Browse eprints using dynamic faceted classification. Facets are fetched
 * from the knowledge graph (subkind='facet') rather than being hardcoded.
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
  type FacetDefinition,
} from '../../../schemas/graph.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.graph.browseFaceted query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated faceted browse parameters
 * @returns Matching eprints with available facet refinements
 *
 * @remarks
 * Facets are fetched dynamically from the knowledge graph where subkind='facet'.
 * This allows users to propose new facets through governance.
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.graph.browseFaceted?facets={"methodology":["meta-analysis"]}
 *
 * Response:
 * {
 *   "hits": [...],
 *   "facets": [
 *     { "slug": "methodology", "label": "Research Methodology", "values": [...] },
 *     { "slug": "time-period", "label": "Time Period", "values": [...] }
 *   ],
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
  const { graph, nodeService, edgeService } = c.get('services');
  const logger = c.get('logger');

  logger.debug('Browsing faceted', {
    q: params.q,
    facets: params.facets,
    limit: params.limit,
  });

  // Call graph service with faceted browse query
  const results = await graph.browseFaceted({
    q: params.q,
    facets: params.facets ?? {},
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });

  // Fetch all facet definitions from the graph (subkind='facet')
  const facetNodes = await nodeService.listNodes({
    subkind: 'facet',
    status: 'established',
    limit: 100,
  });

  // Build facet definitions with values from the knowledge graph
  // Facet values are linked via 'has-value' edges from facet to value nodes
  const facetDefinitions: FacetDefinition[] = [];

  for (const facetNode of facetNodes.nodes) {
    // Use slug from node if available, otherwise generate from label
    const slug =
      facetNode.slug ??
      facetNode.label
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    // Fetch value nodes connected to this facet via 'has-value' edges
    const valueEdges = await edgeService.listEdges({
      sourceUri: facetNode.uri,
      relationSlug: 'has-value',
      status: 'established',
      limit: 100,
    });

    // Get counts from aggregation results (if available)
    const aggregationCounts = results.availableFacets[slug] ?? [];
    const countMap = new Map(aggregationCounts.map((v) => [v.value, v.count]));

    // Fetch target nodes for each edge to get value labels (deduplicated)
    const values: { value: string; label?: string; count: number }[] = [];
    const seenSlugs = new Set<string>();

    for (const edge of valueEdges.edges) {
      // Get the target node (the value node)
      const valueNode = await nodeService.getNode(edge.targetUri);
      if (valueNode) {
        // Use slug from node if available, otherwise generate from label
        const valueSlug =
          valueNode.slug ??
          valueNode.label
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        // Skip duplicates
        if (seenSlugs.has(valueSlug)) {
          continue;
        }
        seenSlugs.add(valueSlug);

        values.push({
          value: valueSlug,
          label: valueNode.label,
          count: countMap.get(valueSlug) ?? 0,
        });
      }
    }

    // Sort by count (descending) for better UX
    values.sort((a, b) => b.count - a.count);

    facetDefinitions.push({
      slug,
      label: facetNode.label,
      description: facetNode.description,
      values,
    });
  }

  // Map service response to API response format
  const response: FacetedBrowseResponse = {
    hits: results.eprints.map((p) => ({
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
        contributions: a.contributions.map((contrib) => ({
          typeUri: contrib.typeUri,
          typeId: contrib.typeId,
          typeLabel: contrib.typeLabel,
          degree: contrib.degree,
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
    facets: facetDefinitions,
    cursor: results.cursor,
    hasMore: results.hasMore,
    total: results.total,
  };

  logger.info('Faceted browse completed', {
    q: params.q,
    facetFilters: params.facets,
    facetCount: facetDefinitions.length,
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
  description: 'Browse eprints using dynamic faceted classification from the knowledge graph',
  inputSchema: browseFacetedParamsSchema,
  outputSchema: facetedBrowseResponseSchema,
  handler: browseFacetedHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
