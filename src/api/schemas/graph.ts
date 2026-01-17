/**
 * Knowledge graph API schemas.
 *
 * @remarks
 * Zod schemas for unified knowledge graph nodes and edges.
 * All knowledge graph entities are represented as nodes with kind + subkind.
 *
 * @packageDocumentation
 * @public
 */

import { z } from './base.js';
import { paginationQuerySchema, didSchema } from './common.js';
import { eprintAuthorRefSchema, eprintSourceInfoSchema, fieldRefSchema } from './eprint.js';

// =============================================================================
// UNIFIED NODE/EDGE SCHEMAS
// =============================================================================

/**
 * Node kind - distinguishes classifications from instances.
 *
 * @public
 */
export const nodeKindSchema = z.enum(['type', 'object']).describe('Node kind');

/**
 * Node kind type.
 *
 * @public
 */
export type NodeKind = z.infer<typeof nodeKindSchema>;

/**
 * Node status in the governance lifecycle.
 *
 * @public
 */
export const nodeStatusSchema = z
  .enum(['proposed', 'provisional', 'established', 'deprecated'])
  .describe('Node status');

/**
 * Node status type.
 *
 * @public
 */
export type NodeStatus = z.infer<typeof nodeStatusSchema>;

/**
 * Edge status.
 *
 * @public
 */
export const edgeStatusSchema = z
  .enum(['proposed', 'established', 'deprecated'])
  .describe('Edge status');

/**
 * Edge status type.
 *
 * @public
 */
export type EdgeStatus = z.infer<typeof edgeStatusSchema>;

/**
 * External identifier system.
 *
 * @public
 */
export const externalIdSystemSchema = z
  .enum([
    'wikidata',
    'ror',
    'orcid',
    'isni',
    'viaf',
    'lcsh',
    'fast',
    'credit',
    'spdx',
    'fundref',
    'mesh',
    'aat',
    'gnd',
    'anzsrc',
    'arxiv',
  ])
  .describe('External identifier system');

/**
 * External identifier system type.
 *
 * @public
 */
export type ExternalIdSystem = z.infer<typeof externalIdSystemSchema>;

/**
 * SKOS match type for external ID mapping.
 *
 * @public
 */
export const skosMatchTypeSchema = z
  .enum(['exact', 'close', 'broader', 'narrower', 'related'])
  .describe('SKOS match type');

/**
 * External identifier schema.
 *
 * @public
 */
export const externalIdSchema = z.object({
  system: externalIdSystemSchema.describe('Source system'),
  identifier: z.string().describe('External identifier'),
  uri: z.string().url().optional().describe('External URI'),
  matchType: skosMatchTypeSchema.optional().describe('SKOS match type'),
});

/**
 * External identifier type.
 *
 * @public
 */
export type ExternalId = z.infer<typeof externalIdSchema>;

/**
 * Organization status.
 *
 * @public
 */
export const organizationStatusSchema = z
  .enum(['active', 'merged', 'inactive', 'defunct'])
  .describe('Organization operational status');

/**
 * Organization status type.
 *
 * @public
 */
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>;

/**
 * Node metadata schema.
 *
 * @remarks
 * Subkind-specific metadata for nodes (institutions, licenses, etc.).
 *
 * @public
 */
export const nodeMetadataSchema = z.object({
  country: z.string().max(2).optional().describe('ISO 3166-1 alpha-2 country code'),
  city: z.string().optional().describe('City name'),
  website: z.string().url().optional().describe('Official website URL'),
  organizationStatus: organizationStatusSchema.optional().describe('Organization status'),
  mimeTypes: z.array(z.string()).optional().describe('MIME types (for document-format)'),
  spdxId: z.string().optional().describe('SPDX license identifier'),
  displayOrder: z.number().int().optional().describe('Display order for UI sorting'),
  inverseSlug: z.string().optional().describe('Slug of inverse relation'),
});

/**
 * Node metadata type.
 *
 * @public
 */
export type NodeMetadata = z.infer<typeof nodeMetadataSchema>;

/**
 * Unified graph node schema.
 *
 * @remarks
 * All knowledge graph entities are represented as nodes with kind + subkind.
 *
 * @public
 */
export const graphNodeSchema = z.object({
  id: z.string().uuid().describe('Node UUID identifier'),
  uri: z.string().describe('AT-URI of the node'),
  kind: nodeKindSchema.describe('Node kind: type or object'),
  subkind: z.string().optional().describe('Subkind slug (e.g., field, institution)'),
  subkindUri: z.string().optional().describe('AT-URI of the subkind type node'),
  label: z.string().describe('Primary display label'),
  alternateLabels: z.array(z.string()).optional().describe('Alternate labels/synonyms'),
  description: z.string().optional().describe('Detailed description'),
  externalIds: z.array(externalIdSchema).optional().describe('External identifier mappings'),
  metadata: nodeMetadataSchema.optional().describe('Subkind-specific metadata'),
  status: nodeStatusSchema.describe('Lifecycle status'),
  deprecatedBy: z.string().optional().describe('AT-URI of superseding node'),
  proposalUri: z.string().optional().describe('AT-URI of creating proposal'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  createdBy: z.string().optional().describe('DID of creator'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

/**
 * Graph node type.
 *
 * @public
 */
export type GraphNodeResponse = z.infer<typeof graphNodeSchema>;

/**
 * Edge metadata schema.
 *
 * @public
 */
export const edgeMetadataSchema = z.object({
  confidence: z.number().min(0).max(1).optional().describe('Confidence score'),
  startDate: z.string().datetime().optional().describe('Temporal start'),
  endDate: z.string().datetime().optional().describe('Temporal end'),
  source: z.string().optional().describe('Source of the assertion'),
});

/**
 * Edge metadata type.
 *
 * @public
 */
export type EdgeMetadata = z.infer<typeof edgeMetadataSchema>;

/**
 * Graph edge schema.
 *
 * @remarks
 * Typed relationships between nodes. Relation types are themselves nodes with subkind=relation.
 *
 * @public
 */
export const graphEdgeSchema = z.object({
  id: z.string().uuid().describe('Edge UUID identifier'),
  uri: z.string().describe('AT-URI of the edge'),
  sourceUri: z.string().describe('AT-URI of source node'),
  targetUri: z.string().describe('AT-URI of target node'),
  relationUri: z.string().optional().describe('AT-URI of relation type node'),
  relationSlug: z.string().describe('Relation slug (broader, narrower, related, etc.)'),
  weight: z.number().min(0).max(1).optional().describe('Edge weight'),
  metadata: edgeMetadataSchema.optional().describe('Edge-specific metadata'),
  status: edgeStatusSchema.describe('Edge lifecycle status'),
  proposalUri: z.string().optional().describe('AT-URI of creating proposal'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  createdBy: z.string().optional().describe('DID of creator'),
  updatedAt: z.string().datetime().optional().describe('Last update timestamp'),
});

/**
 * Graph edge type.
 *
 * @public
 */
export type GraphEdgeResponse = z.infer<typeof graphEdgeSchema>;

// =============================================================================
// NODE API SCHEMAS
// =============================================================================

/**
 * Get node query params schema.
 *
 * @public
 */
export const getNodeParamsSchema = z.object({
  id: z.string().describe('Node ID'),
  includeEdges: z.coerce.boolean().default(false).describe('Include connected edges'),
});

/**
 * Get node params type.
 *
 * @public
 */
export type GetNodeParams = z.infer<typeof getNodeParamsSchema>;

/**
 * Node with connected edges response.
 *
 * @public
 */
export const nodeWithEdgesSchema = graphNodeSchema.extend({
  edges: z.array(graphEdgeSchema).optional().describe('Connected edges'),
});

/**
 * Node with edges type.
 *
 * @public
 */
export type NodeWithEdges = z.infer<typeof nodeWithEdgesSchema>;

/**
 * List nodes query params schema.
 *
 * @public
 */
export const listNodesParamsSchema = paginationQuerySchema.extend({
  kind: nodeKindSchema.optional().describe('Filter by kind'),
  subkind: z.string().optional().describe('Filter by subkind'),
  status: nodeStatusSchema.optional().describe('Filter by status'),
});

/**
 * List nodes params type.
 *
 * @public
 */
export type ListNodesParams = z.infer<typeof listNodesParamsSchema>;

/**
 * Node list response schema.
 *
 * @public
 */
export const nodeListResponseSchema = z.object({
  nodes: z.array(graphNodeSchema).describe('Node list'),
  cursor: z.string().optional().describe('Pagination cursor'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total count'),
});

/**
 * Node list response type.
 *
 * @public
 */
export type NodeListResponse = z.infer<typeof nodeListResponseSchema>;

/**
 * Search nodes query params schema.
 *
 * @public
 */
export const searchNodesParamsSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  kind: nodeKindSchema.optional().describe('Filter by kind'),
  subkind: z.string().optional().describe('Filter by subkind'),
  status: nodeStatusSchema.optional().describe('Filter by status'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20).describe('Maximum results'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

/**
 * Search nodes params type.
 *
 * @public
 */
export type SearchNodesParams = z.infer<typeof searchNodesParamsSchema>;

/**
 * Node search response schema.
 *
 * @public
 */
export const nodeSearchResponseSchema = z.object({
  nodes: z.array(graphNodeSchema).describe('Search results'),
  cursor: z.string().optional().describe('Pagination cursor'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total count'),
});

/**
 * Node search response type.
 *
 * @public
 */
export type NodeSearchResponse = z.infer<typeof nodeSearchResponseSchema>;

/**
 * Get subkinds response schema.
 *
 * @public
 */
export const subkindsResponseSchema = z.object({
  subkinds: z.array(graphNodeSchema).describe('Available subkind type nodes'),
});

/**
 * Subkinds response type.
 *
 * @public
 */
export type SubkindsResponse = z.infer<typeof subkindsResponseSchema>;

/**
 * Node hierarchy item type (recursive).
 *
 * @public
 */
export interface NodeHierarchyItem {
  node: GraphNodeResponse;
  children: NodeHierarchyItem[];
  depth: number;
}

/**
 * Base hierarchy item schema (without children).
 *
 * @internal
 */
const baseHierarchyItemSchema = z.object({
  node: graphNodeSchema.describe('Node data'),
  depth: z.number().int().describe('Depth in hierarchy'),
});

/**
 * Node hierarchy item schema (recursive).
 *
 * @remarks
 * Uses z.lazy() for recursive children with manual OpenAPI schema
 * definition using $ref for proper recursive type handling.
 *
 * @public
 */
export const nodeHierarchyItemSchema: z.ZodType<NodeHierarchyItem> = baseHierarchyItemSchema
  .extend({
    children: z
      .lazy(() => z.array(nodeHierarchyItemSchema))
      .openapi({
        type: 'array',
        items: {
          $ref: '#/components/schemas/NodeHierarchyItem',
        },
      }),
  })
  .openapi('NodeHierarchyItem');

/**
 * Get hierarchy params schema.
 *
 * @public
 */
export const getHierarchyParamsSchema = z.object({
  subkind: z.string().describe('Subkind to get hierarchy for'),
  relationSlug: z.string().default('broader').describe('Relation slug for hierarchy'),
});

/**
 * Get hierarchy params type.
 *
 * @public
 */
export type GetHierarchyParams = z.infer<typeof getHierarchyParamsSchema>;

/**
 * Hierarchy response schema.
 *
 * @public
 */
export const hierarchyResponseSchema = z.object({
  roots: z.array(nodeHierarchyItemSchema).describe('Root nodes with children'),
  subkind: z.string().describe('Subkind of hierarchy'),
  relationSlug: z.string().describe('Relation used for hierarchy'),
});

/**
 * Hierarchy response type.
 *
 * @public
 */
export type HierarchyResponse = z.infer<typeof hierarchyResponseSchema>;

// =============================================================================
// EDGE API SCHEMAS
// =============================================================================

/**
 * Get edge query params schema.
 *
 * @public
 */
export const getEdgeParamsSchema = z.object({
  uri: z.string().describe('Edge AT-URI'),
});

/**
 * Get edge params type.
 *
 * @public
 */
export type GetEdgeParams = z.infer<typeof getEdgeParamsSchema>;

/**
 * List edges query params schema.
 *
 * @public
 */
export const listEdgesParamsSchema = paginationQuerySchema.extend({
  sourceUri: z.string().optional().describe('Filter by source node'),
  targetUri: z.string().optional().describe('Filter by target node'),
  relationSlug: z.string().optional().describe('Filter by relation type'),
  status: edgeStatusSchema.optional().describe('Filter by status'),
});

/**
 * List edges params type.
 *
 * @public
 */
export type ListEdgesParams = z.infer<typeof listEdgesParamsSchema>;

/**
 * Edge list response schema.
 *
 * @public
 */
export const edgeListResponseSchema = z.object({
  edges: z.array(graphEdgeSchema).describe('Edge list'),
  cursor: z.string().optional().describe('Pagination cursor'),
  hasMore: z.boolean().describe('Whether more results exist'),
  total: z.number().int().describe('Total count'),
});

/**
 * Edge list response type.
 *
 * @public
 */
export type EdgeListResponse = z.infer<typeof edgeListResponseSchema>;

/**
 * Relation type schema for getRelations response.
 *
 * @public
 */
export const relationTypeSchema = z.object({
  slug: z.string().describe('Relation slug'),
  label: z.string().describe('Display label'),
  description: z.string().optional().describe('Description'),
  inverseSlug: z.string().optional().describe('Slug of inverse relation'),
});

/**
 * Relation type.
 *
 * @public
 */
export type RelationType = z.infer<typeof relationTypeSchema>;

/**
 * Get relations response schema.
 *
 * @public
 */
export const relationsResponseSchema = z.object({
  relations: z.array(relationTypeSchema).describe('Available relation types'),
});

/**
 * Relations response type.
 *
 * @public
 */
export type RelationsResponse = z.infer<typeof relationsResponseSchema>;

/**
 * Dynamic facet filter schema.
 *
 * @remarks
 * Facets are fetched dynamically from the knowledge graph (subkind='facet').
 * Filter values are keyed by facet slug.
 *
 * @public
 */
export const dynamicFacetFiltersSchema = z
  .record(z.string(), z.array(z.string()))
  .optional()
  .describe('Facet filters keyed by facet slug');

/**
 * Dynamic facet filters type.
 *
 * @public
 */
export type DynamicFacetFilters = z.infer<typeof dynamicFacetFiltersSchema>;

/**
 * Preprocessor for facets query parameter.
 *
 * @remarks
 * XRPC query params are always strings. This preprocessor parses the JSON string
 * into an object before validation.
 */
const facetsPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as unknown;
    } catch {
      return val;
    }
  }
  return val;
}, dynamicFacetFiltersSchema);

/**
 * Browse faceted query params schema.
 *
 * @remarks
 * Uses dynamic facet filters fetched from the knowledge graph.
 *
 * @public
 */
export const browseFacetedParamsSchema = paginationQuerySchema.extend({
  q: z.string().optional().describe('Text query'),
  facets: facetsPreprocess.describe('Facet filters keyed by facet slug'),
});

/**
 * Browse faceted params type.
 *
 * @public
 */
export type BrowseFacetedParams = z.infer<typeof browseFacetedParamsSchema>;

/**
 * Facet value with count schema.
 *
 * @public
 */
export const facetValueSchema = z.object({
  value: z.string().describe('Facet value'),
  label: z.string().optional().describe('Display label'),
  count: z.number().int().describe('Number of eprints'),
});

/**
 * Eprint summary for faceted browse results.
 *
 * @remarks
 * Uses the unified author model matching EprintSummary.
 *
 * @public
 */
export const facetedEprintSummarySchema = z.object({
  uri: z.string().describe('AT URI'),
  cid: z.string().describe('CID of indexed version'),
  title: z.string().describe('Eprint title'),
  abstract: z.string().describe('Eprint abstract'),
  authors: z.array(eprintAuthorRefSchema).describe('All authors with contributions'),
  submittedBy: didSchema.describe('DID of human user who submitted'),
  paperDid: didSchema.optional().describe('Paper DID if paper has its own PDS'),
  fields: z.array(fieldRefSchema).optional().describe('Subject fields'),
  license: z.string().describe('License identifier'),
  keywords: z.array(z.string()).optional().describe('Keywords'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  indexedAt: z.string().datetime().describe('Index timestamp'),
  source: eprintSourceInfoSchema.describe('Source PDS information'),
  score: z.number().optional().describe('Relevance score'),
  highlights: z.record(z.string(), z.array(z.string())).optional().describe('Search highlights'),
});

/**
 * Faceted eprint summary type.
 *
 * @public
 */
export type FacetedEprintSummary = z.infer<typeof facetedEprintSummarySchema>;

/**
 * Facet definition from the knowledge graph.
 *
 * @public
 */
export const facetDefinitionSchema = z.object({
  slug: z.string().describe('Facet slug (unique identifier)'),
  label: z.string().describe('Display label'),
  description: z.string().optional().describe('Facet description'),
  values: z.array(facetValueSchema).describe('Available values with counts'),
});

/**
 * Facet definition type.
 *
 * @public
 */
export type FacetDefinition = z.infer<typeof facetDefinitionSchema>;

/**
 * Faceted browse response schema.
 *
 * @remarks
 * Uses `hits` to match the frontend SearchResultsResponse interface.
 * Facets are dynamic and keyed by slug.
 *
 * @public
 */
export const facetedBrowseResponseSchema = z.object({
  hits: z.array(facetedEprintSummarySchema).describe('Matching eprints'),
  facets: z.array(facetDefinitionSchema).describe('Available facet refinements'),
  cursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().int(),
  impressionId: z.string().uuid().optional().describe('Impression ID for click tracking'),
});

/**
 * Faceted browse response type.
 *
 * @public
 */
export type FacetedBrowseResponse = z.infer<typeof facetedBrowseResponseSchema>;

// =============================================================================
// RECOMMENDATION SCHEMAS
// =============================================================================

/**
 * Recommendation reason schema.
 *
 * @public
 */
export const recommendationReasonSchema = z
  .enum([
    'similar-fields',
    'cited-by-interests',
    'coauthor-network',
    'trending-in-field',
    'similar-content',
  ])
  .describe('Reason for recommendation');

/**
 * Recommendation reason type.
 *
 * @public
 */
export type RecommendationReason = z.infer<typeof recommendationReasonSchema>;

/**
 * Paper recommendation result schema.
 *
 * @public
 */
export const paperRecommendationSchema = z.object({
  uri: z.string().describe('Paper AT-URI'),
  title: z.string().describe('Paper title'),
  abstract: z.string().optional().describe('Paper abstract'),
  authors: z.array(z.string()).describe('Author names'),
  score: z.number().describe('Recommendation score'),
  reason: recommendationReasonSchema.describe('Recommendation reason'),
  relatedFields: z.array(z.string()).describe('Related field names'),
});

/**
 * Paper recommendation type.
 *
 * @public
 */
export type PaperRecommendation = z.infer<typeof paperRecommendationSchema>;

/**
 * Get recommendations params schema.
 *
 * @public
 */
export const getRecommendationsParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20).describe('Maximum results'),
});

/**
 * Get recommendations params type.
 *
 * @public
 */
export type GetRecommendationsParams = z.infer<typeof getRecommendationsParamsSchema>;

/**
 * Recommendations response schema.
 *
 * @public
 */
export const recommendationsResponseSchema = z.object({
  recommendations: z.array(paperRecommendationSchema).describe('Paper recommendations'),
  generatedAt: z.string().datetime().describe('Timestamp when generated'),
});

/**
 * Recommendations response type.
 *
 * @public
 */
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;

// =============================================================================
// TRENDING PAPERS SCHEMAS
// =============================================================================

/**
 * Trend time window schema.
 *
 * @public
 */
export const trendWindowSchema = z
  .enum(['24h', '7d', '30d', 'all'])
  .describe('Time window for trending');

/**
 * Trend window type.
 *
 * @public
 */
export type TrendWindow = z.infer<typeof trendWindowSchema>;

/**
 * Trending paper result schema.
 *
 * @public
 */
export const trendingPaperSchema = z.object({
  uri: z.string().describe('Paper AT-URI'),
  title: z.string().describe('Paper title'),
  authors: z.array(z.string()).describe('Author names'),
  fieldUri: z.string().optional().describe('Primary field URI'),
  fieldName: z.string().optional().describe('Primary field name'),
  score: z.number().describe('Trending score'),
  viewCount: z.number().int().describe('Number of views'),
  citationCount: z.number().int().describe('Recent citations'),
  engagementCount: z.number().int().describe('Engagement count'),
  trendWindow: trendWindowSchema.describe('Time window'),
});

/**
 * Trending paper type.
 *
 * @public
 */
export type TrendingPaper = z.infer<typeof trendingPaperSchema>;

/**
 * Get trending params schema.
 *
 * @public
 */
export const getTrendingParamsSchema = z.object({
  window: trendWindowSchema.optional().default('7d').describe('Time window'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20).describe('Maximum results'),
  fieldUri: z.string().optional().describe('Filter by field'),
});

/**
 * Get trending params type.
 *
 * @public
 */
export type GetTrendingParams = z.infer<typeof getTrendingParamsSchema>;

/**
 * Trending response schema.
 *
 * @public
 */
export const trendingResponseSchema = z.object({
  papers: z.array(trendingPaperSchema).describe('Trending papers'),
  window: trendWindowSchema.describe('Time window'),
  generatedAt: z.string().datetime().describe('Timestamp when generated'),
});

/**
 * Trending response type.
 *
 * @public
 */
export type TrendingResponse = z.infer<typeof trendingResponseSchema>;

// =============================================================================
// SIMILAR PAPERS SCHEMAS
// =============================================================================

/**
 * Similarity reason schema.
 *
 * @public
 */
export const similarityReasonSchema = z
  .enum(['co-citation', 'bibliographic-coupling', 'field-overlap', 'author-overlap'])
  .describe('Reason for similarity');

/**
 * Similarity reason type.
 *
 * @public
 */
export type SimilarityReason = z.infer<typeof similarityReasonSchema>;

/**
 * Similar paper result schema.
 *
 * @public
 */
export const similarPaperSchema = z.object({
  uri: z.string().describe('Paper AT-URI'),
  title: z.string().describe('Paper title'),
  authors: z.array(z.string()).describe('Author names'),
  similarity: z.number().describe('Similarity score'),
  reason: similarityReasonSchema.describe('Similarity reason'),
  sharedReferences: z.number().int().describe('Shared references count'),
  sharedCiters: z.number().int().describe('Shared citers count'),
});

/**
 * Similar paper type.
 *
 * @public
 */
export type SimilarPaper = z.infer<typeof similarPaperSchema>;

/**
 * Get similar papers params schema.
 *
 * @public
 */
export const getSimilarPapersParamsSchema = z.object({
  uri: z.string().describe('Paper AT-URI'),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10).describe('Maximum results'),
});

/**
 * Get similar papers params type.
 *
 * @public
 */
export type GetSimilarPapersParams = z.infer<typeof getSimilarPapersParamsSchema>;

/**
 * Similar papers response schema.
 *
 * @public
 */
export const similarPapersResponseSchema = z.object({
  papers: z.array(similarPaperSchema).describe('Similar papers'),
  sourcePaperUri: z.string().describe('Source paper URI'),
});

/**
 * Similar papers response type.
 *
 * @public
 */
export type SimilarPapersResponse = z.infer<typeof similarPapersResponseSchema>;

// =============================================================================
// COMMUNITY DETECTION SCHEMAS
// =============================================================================

/**
 * Community detection algorithm schema.
 *
 * @public
 */
export const communityAlgorithmSchema = z
  .enum(['louvain', 'label-propagation'])
  .describe('Community detection algorithm');

/**
 * Community algorithm type.
 *
 * @public
 */
export type CommunityAlgorithm = z.infer<typeof communityAlgorithmSchema>;

/**
 * Get communities params schema.
 *
 * @public
 */
export const getCommunitiesParamsSchema = z.object({
  algorithm: communityAlgorithmSchema.optional().default('louvain').describe('Detection algorithm'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Maximum communities'),
  minSize: z.coerce.number().int().min(1).optional().default(2).describe('Minimum community size'),
});

/**
 * Get communities params type.
 *
 * @public
 */
export type GetCommunitiesParams = z.infer<typeof getCommunitiesParamsSchema>;

/**
 * Community result schema.
 *
 * @public
 */
export const communityResultSchema = z.object({
  communityId: z.number().int().describe('Community identifier'),
  members: z.array(z.string()).describe('Member URIs'),
  size: z.number().int().describe('Number of members'),
  representativeMembers: z
    .array(
      z.object({
        uri: z.string(),
        name: z.string(),
      })
    )
    .optional()
    .describe('Representative members with names'),
});

/**
 * Community result type.
 *
 * @public
 */
export type CommunityResult = z.infer<typeof communityResultSchema>;

/**
 * Communities response schema.
 *
 * @public
 */
export const communitiesResponseSchema = z.object({
  communities: z.array(communityResultSchema).describe('Detected communities'),
  algorithm: communityAlgorithmSchema.describe('Algorithm used'),
  total: z.number().int().describe('Total communities found'),
  generatedAt: z.string().datetime().describe('Timestamp when generated'),
});

/**
 * Communities response type.
 *
 * @public
 */
export type CommunitiesResponse = z.infer<typeof communitiesResponseSchema>;
