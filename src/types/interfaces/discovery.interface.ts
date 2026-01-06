/**
 * Discovery service interfaces for enhanced preprint recommendations.
 *
 * @remarks
 * This module defines interfaces for Chive's discovery system, which provides:
 * - Personalized recommendations using Semantic Scholar and OpenAlex data
 * - Citation graph traversal for related paper discovery
 * - Concept-based similarity matching
 *
 * **Critical Constraint**: All discovery features recommend only preprints
 * indexed in Chive, not external papers. External APIs (S2, OpenAlex) are
 * used strictly as enrichment signals.
 *
 * **External API Integration:**
 * - Semantic Scholar Recommendations API uses SPECTER2 embeddings and supports
 *   multi-example learning with positive and negative paper lists.
 * - OpenAlex `/text` endpoint classifies text into topics, keywords, and concepts.
 *
 * @see {@link https://api.semanticscholar.org/api-docs/recommendations | Semantic Scholar Recommendations API}
 * @see {@link https://docs.openalex.org/api-entities/aboutness-endpoint-text | OpenAlex /text Endpoint}
 * @see {@link https://docs.openalex.org/api-entities/topics | OpenAlex Topics}
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { AtUri, DID } from '../atproto.js';

import type { IPluginManager } from './plugin.interface.js';
import type { RankableItem } from './ranking.interface.js';

// =============================================================================
// DISCOVERY SERVICE INTERFACE
// =============================================================================

/**
 * Input data for preprint enrichment.
 *
 * @public
 * @since 0.1.0
 */
export interface EnrichmentInput {
  /**
   * AT-URI of the preprint to enrich.
   */
  readonly uri: AtUri;

  /**
   * DOI if available (for external API lookup).
   */
  readonly doi?: string;

  /**
   * arXiv ID if available.
   */
  readonly arxivId?: string;

  /**
   * Preprint title (for text classification fallback).
   */
  readonly title: string;

  /**
   * Abstract text (for text classification fallback).
   */
  readonly abstract?: string;
}

/**
 * Result of preprint enrichment from external sources.
 *
 * @public
 * @since 0.1.0
 */
export interface EnrichmentResult {
  /**
   * AT-URI of the enriched preprint.
   */
  readonly uri: AtUri;

  /**
   * Semantic Scholar paper ID if found.
   */
  readonly semanticScholarId?: string;

  /**
   * OpenAlex work ID if found.
   */
  readonly openAlexId?: string;

  /**
   * Citation count from external sources.
   */
  readonly citationCount?: number;

  /**
   * Influential citation count (from Semantic Scholar).
   */
  readonly influentialCitationCount?: number;

  /**
   * OpenAlex concepts with scores.
   */
  readonly concepts?: readonly OpenAlexConceptMatch[];

  /**
   * OpenAlex topics.
   */
  readonly topics?: readonly OpenAlexTopicMatch[];

  /**
   * Number of Chive-to-Chive citations indexed.
   */
  readonly chiveCitationsIndexed?: number;

  /**
   * Whether enrichment was successful.
   */
  readonly success: boolean;

  /**
   * Error message if enrichment failed.
   */
  readonly error?: string;
}

/**
 * OpenAlex concept with relevance score.
 *
 * @public
 * @since 0.1.0
 */
export interface OpenAlexConceptMatch {
  /**
   * Concept ID (e.g., "C41008148").
   */
  readonly id: string;

  /**
   * Display name (e.g., "Computer Science").
   */
  readonly displayName: string;

  /**
   * Wikidata ID for cross-referencing.
   */
  readonly wikidataId?: string;

  /**
   * Relevance score (0-1).
   */
  readonly score: number;

  /**
   * Hierarchy level (0 = most general).
   */
  readonly level: number;
}

/**
 * OpenAlex topic with score.
 *
 * @public
 * @since 0.1.0
 */
export interface OpenAlexTopicMatch {
  /**
   * Topic ID.
   */
  readonly id: string;

  /**
   * Display name.
   */
  readonly displayName: string;

  /**
   * Subfield name.
   */
  readonly subfield?: string;

  /**
   * Field name.
   */
  readonly field?: string;

  /**
   * Domain name.
   */
  readonly domain?: string;

  /**
   * Relevance score (0-1).
   */
  readonly score: number;
}

/**
 * Paper identifier for external lookup.
 *
 * @public
 * @since 0.1.0
 */
export interface PaperIdentifier {
  /**
   * DOI.
   */
  readonly doi?: string;

  /**
   * arXiv ID.
   */
  readonly arxivId?: string;

  /**
   * Semantic Scholar paper ID.
   */
  readonly semanticScholarId?: string;

  /**
   * OpenAlex work ID.
   */
  readonly openAlexId?: string;
}

/**
 * Unified paper metadata from external sources.
 *
 * @public
 * @since 0.1.0
 */
export interface UnifiedPaperMetadata {
  /**
   * Paper title.
   */
  readonly title: string;

  /**
   * Authors.
   */
  readonly authors: readonly { readonly name: string; readonly orcid?: string }[];

  /**
   * Publication year.
   */
  readonly year?: number;

  /**
   * Abstract text.
   */
  readonly abstract?: string;

  /**
   * DOI.
   */
  readonly doi?: string;

  /**
   * Venue (journal/conference).
   */
  readonly venue?: string;

  /**
   * Citation count.
   */
  readonly citationCount?: number;

  /**
   * External source IDs.
   */
  readonly externalIds: PaperIdentifier;

  /**
   * OpenAlex concepts.
   */
  readonly concepts?: readonly OpenAlexConceptMatch[];
}

/**
 * Options for finding related preprints.
 *
 * @public
 * @since 0.1.0
 */
export interface RelatedPreprintOptions {
  /**
   * Maximum number of results.
   *
   * @defaultValue 10
   */
  readonly limit?: number;

  /**
   * Signals to include.
   *
   * @defaultValue ['citations', 'concepts', 'semantic']
   */
  readonly signals?: readonly RelatedPreprintSignal[];

  /**
   * Minimum similarity score (0-1).
   *
   * @defaultValue 0.3
   */
  readonly minScore?: number;

  /**
   * User DID for personalization context.
   */
  readonly userDid?: DID;
}

/**
 * Signals used for finding related preprints.
 *
 * @public
 * @since 0.1.0
 */
export type RelatedPreprintSignal =
  | 'citations' // Co-citation and bibliographic coupling
  | 'concepts' // OpenAlex concept overlap
  | 'semantic' // SPECTER2 embedding similarity
  | 'authors' // Co-author network
  | 'topics'; // OpenAlex topic overlap

/**
 * Related preprint with relationship metadata.
 *
 * @public
 * @since 0.1.0
 */
export interface RelatedPreprint extends RankableItem {
  /**
   * AT-URI of the related preprint.
   */
  readonly uri: AtUri;

  /**
   * Overall similarity score (0-1).
   */
  readonly score: number;

  /**
   * Type of relationship.
   */
  readonly relationshipType: RelatedPreprintRelationship;

  /**
   * Human-readable explanation.
   */
  readonly explanation: string;

  /**
   * Individual signal scores.
   */
  readonly signalScores?: {
    readonly citations?: number;
    readonly concepts?: number;
    readonly semantic?: number;
    readonly authors?: number;
    readonly topics?: number;
  };
}

/**
 * Type of relationship between preprints.
 *
 * @public
 * @since 0.1.0
 */
export type RelatedPreprintRelationship =
  | 'cites' // Source cites target
  | 'cited-by' // Source is cited by target
  | 'co-cited' // Frequently cited together
  | 'same-author' // Share an author
  | 'similar-topics' // Similar OpenAlex topics
  | 'semantically-similar'; // High SPECTER2 similarity

/**
 * Options for personalized recommendations.
 *
 * @public
 * @since 0.1.0
 */
export interface RecommendationOptions {
  /**
   * Maximum number of recommendations.
   *
   * @defaultValue 20
   */
  readonly limit?: number;

  /**
   * Cursor for pagination.
   */
  readonly cursor?: string;

  /**
   * Signals to use for recommendations.
   */
  readonly signals?: readonly RecommendationSignal[];

  /**
   * Whether to include explanation for each recommendation.
   *
   * @defaultValue true
   */
  readonly includeExplanations?: boolean;
}

/**
 * Signals used for personalized recommendations.
 *
 * @public
 * @since 0.1.0
 */
export type RecommendationSignal =
  | 'fields' // User's research fields
  | 'citations' // Papers citing user's work
  | 'collaborators' // Papers from co-authors
  | 'trending' // Trending in user's fields
  | 'semantic'; // SPECTER2-based similarity to claimed papers

/**
 * Result of personalized recommendations.
 *
 * @public
 * @since 0.1.0
 */
export interface RecommendationResult {
  /**
   * Recommended preprints.
   */
  readonly recommendations: readonly ScoredRecommendation[];

  /**
   * Cursor for next page.
   */
  readonly cursor?: string;

  /**
   * Whether more results are available.
   */
  readonly hasMore: boolean;
}

/**
 * Single recommendation with score and explanation.
 *
 * @public
 * @since 0.1.0
 */
export interface ScoredRecommendation extends RankableItem {
  /**
   * AT-URI of the recommended preprint.
   */
  readonly uri: AtUri;

  /**
   * Overall recommendation score (0-1).
   */
  readonly score: number;

  /**
   * Explanation of why this was recommended.
   */
  readonly explanation: RecommendationExplanation;

  /**
   * Individual signal scores.
   */
  readonly signalScores?: {
    readonly fields?: number;
    readonly citations?: number;
    readonly collaborators?: number;
    readonly trending?: number;
    readonly semantic?: number;
  };
}

/**
 * Explanation for a recommendation.
 *
 * @public
 * @since 0.1.0
 */
export interface RecommendationExplanation {
  /**
   * Primary reason type.
   */
  readonly type: RecommendationReasonType;

  /**
   * Human-readable explanation text.
   */
  readonly text: string;

  /**
   * Weight of this signal in the final score.
   */
  readonly weight: number;

  /**
   * Supporting data for the explanation.
   */
  readonly data?: {
    /**
     * Title of a similar paper from user's history.
     */
    readonly similarPaperTitle?: string;

    /**
     * Number of shared citations.
     */
    readonly sharedCitations?: number;

    /**
     * Matching concepts.
     */
    readonly matchingConcepts?: readonly string[];

    /**
     * Matching fields.
     */
    readonly matchingFields?: readonly string[];

    /**
     * Collaborator name.
     */
    readonly collaboratorName?: string;
  };
}

/**
 * Types of recommendation reasons.
 *
 * @public
 * @since 0.1.0
 */
export type RecommendationReasonType =
  | 'semantic-similarity' // Similar to papers you've claimed
  | 'citation-overlap' // Shares citations with your work
  | 'field-match' // Matches your research fields
  | 'collaborator' // From someone you've co-authored with
  | 'trending' // Popular in your fields
  | 'concept-match'; // Similar OpenAlex concepts

/**
 * User interaction for feedback loop.
 *
 * @public
 * @since 0.1.0
 */
export interface UserInteraction {
  /**
   * Type of interaction.
   */
  readonly type: UserInteractionType;

  /**
   * AT-URI of the preprint.
   */
  readonly preprintUri: AtUri;

  /**
   * ID of the recommendation that led here (if applicable).
   */
  readonly recommendationId?: string;

  /**
   * Timestamp of interaction.
   */
  readonly timestamp: Date;
}

/**
 * Types of user interactions.
 *
 * @public
 * @since 0.1.0
 */
export type UserInteractionType =
  | 'view' // Viewed preprint details
  | 'click' // Clicked on recommendation
  | 'endorse' // Endorsed the preprint
  | 'dismiss' // Dismissed recommendation
  | 'claim' // Claimed authorship
  | 'save'; // Saved to reading list

/**
 * Discovery service interface.
 *
 * @remarks
 * Orchestrates preprint enrichment and discovery using external APIs
 * (Semantic Scholar, OpenAlex) and internal data (citation graph, search).
 *
 * **Critical Constraint**: All methods return only preprints indexed in Chive.
 * External APIs are used as enrichment signals, not as sources of recommendations.
 *
 * Follows the ClaimingService pattern:
 * - Constructor takes core dependencies (logger, db, search, ranking)
 * - Optional setter for plugin manager (works without plugins)
 * - Graceful degradation when external APIs are unavailable
 *
 * @example
 * ```typescript
 * // Get recommendations for a user
 * const result = await discoveryService.getRecommendationsForUser(
 *   userDid,
 *   { limit: 10, signals: ['fields', 'citations'] }
 * );
 *
 * // Find related preprints
 * const related = await discoveryService.findRelatedPreprints(
 *   preprintUri,
 *   { limit: 5, signals: ['citations', 'concepts'] }
 * );
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface IDiscoveryService {
  /**
   * Enriches a preprint with data from Semantic Scholar and OpenAlex.
   *
   * @param preprint - Preprint to enrich
   * @returns Enrichment result with external data
   *
   * @remarks
   * Fetches citation data, concepts, and topics from external APIs.
   * Stores Chive-to-Chive citations in Neo4j for graph queries.
   */
  enrichPreprint(preprint: EnrichmentInput): Promise<EnrichmentResult>;

  /**
   * Looks up paper metadata from external sources.
   *
   * @param identifier - Paper identifier (DOI, arXiv, etc.)
   * @returns Unified metadata or null if not found
   *
   * @remarks
   * Queries Semantic Scholar and OpenAlex in parallel, merges results.
   */
  lookupPaper(identifier: PaperIdentifier): Promise<UnifiedPaperMetadata | null>;

  /**
   * Finds related Chive preprints using multiple signals.
   *
   * @param preprintUri - AT-URI of the source preprint
   * @param options - Query options
   * @returns Related preprints with relationship metadata
   *
   * @remarks
   * Combines citation graph, concept overlap, and semantic similarity
   * to find related preprints. All results are from Chive's index.
   */
  findRelatedPreprints(
    preprintUri: AtUri,
    options?: RelatedPreprintOptions
  ): Promise<readonly RelatedPreprint[]>;

  /**
   * Gets personalized recommendations for a user.
   *
   * @param userDid - User's DID
   * @param options - Recommendation options
   * @returns Paginated recommendations with explanations
   *
   * @remarks
   * Uses user's research fields, claimed papers, and citation network
   * to generate personalized recommendations. Uses extended RankingService
   * for scoring with discovery signals.
   */
  getRecommendationsForUser(
    userDid: DID,
    options?: RecommendationOptions
  ): Promise<RecommendationResult>;

  /**
   * Records a user interaction for feedback loop.
   *
   * @param userDid - User's DID
   * @param interaction - Interaction details
   *
   * @remarks
   * Tracks views, clicks, dismissals, and claims to improve
   * future recommendations. Uses dismissals as negative signals
   * for Semantic Scholar multi-example learning.
   */
  recordInteraction(userDid: DID, interaction: UserInteraction): Promise<void>;

  /**
   * Sets the plugin manager for external API access.
   *
   * @param manager - Plugin manager instance
   *
   * @remarks
   * Optional late-binding following ClaimingService pattern.
   * Service works without plugins (uses only local data).
   */
  setPluginManager(manager: IPluginManager): void;
}

// =============================================================================
// CITATION GRAPH INTERFACE
// =============================================================================

/**
 * Citation relationship between two papers.
 *
 * @public
 * @since 0.1.0
 */
export interface CitationRelationship {
  /**
   * AT-URI of the citing preprint.
   */
  readonly citingUri: AtUri;

  /**
   * AT-URI of the cited preprint.
   */
  readonly citedUri: AtUri;

  /**
   * Whether this is an influential citation (from Semantic Scholar).
   */
  readonly isInfluential?: boolean;

  /**
   * Source of the citation data.
   */
  readonly source: 'semantic-scholar' | 'openalex' | 'user-provided';

  /**
   * When the citation was discovered.
   */
  readonly discoveredAt?: Date;
}

/**
 * Options for citation queries.
 *
 * @public
 * @since 0.1.0
 */
export interface CitationQueryOptions {
  /**
   * Maximum number of results.
   *
   * @defaultValue 100
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   */
  readonly offset?: number;

  /**
   * Only include influential citations.
   */
  readonly onlyInfluential?: boolean;
}

/**
 * Result of a citation query.
 *
 * @public
 * @since 0.1.0
 */
export interface CitationQueryResult {
  /**
   * Citations matching the query.
   */
  readonly citations: readonly CitationRelationship[];

  /**
   * Total count of matching citations.
   */
  readonly total: number;

  /**
   * Whether more results are available.
   */
  readonly hasMore: boolean;
}

/**
 * Paper that is frequently co-cited with the query paper.
 *
 * @public
 * @since 0.1.0
 */
export interface CoCitedPaper extends RankableItem {
  /**
   * AT-URI of the co-cited preprint.
   */
  readonly uri: AtUri;

  /**
   * Number of times this paper is cited together with the query paper.
   */
  readonly coCitationCount: number;

  /**
   * Co-citation strength score (normalized).
   */
  readonly strength: number;
}

/**
 * Citation graph interface for Neo4j storage.
 *
 * @remarks
 * Manages citations between Chive preprints in Neo4j. Only stores
 * citations where BOTH papers are indexed in Chive (not all external citations).
 *
 * All data is rebuildable from external sources (ATProto compliant).
 *
 * @example
 * ```typescript
 * // Index citations for a preprint
 * await citationGraph.upsertCitationsBatch([
 *   { citingUri, citedUri, isInfluential: true, source: 'semantic-scholar' },
 * ]);
 *
 * // Find co-cited papers
 * const coCited = await citationGraph.findCoCitedPapers(preprintUri, 3);
 * ```
 *
 * @public
 * @since 0.1.0
 */
export interface ICitationGraph {
  /**
   * Upserts a batch of citations into the graph.
   *
   * @param citations - Citations to upsert
   *
   * @remarks
   * Creates or updates CITES edges between Preprint nodes.
   * Deduplicates based on (citingUri, citedUri) pair.
   */
  upsertCitationsBatch(citations: readonly CitationRelationship[]): Promise<void>;

  /**
   * Gets papers that cite a given preprint.
   *
   * @param paperUri - AT-URI of the cited preprint
   * @param options - Query options
   * @returns Papers that cite the given preprint
   */
  getCitingPapers(paperUri: AtUri, options?: CitationQueryOptions): Promise<CitationQueryResult>;

  /**
   * Gets papers that a given preprint cites (references).
   *
   * @param paperUri - AT-URI of the citing preprint
   * @param options - Query options
   * @returns Papers referenced by the given preprint
   */
  getReferences(paperUri: AtUri, options?: CitationQueryOptions): Promise<CitationQueryResult>;

  /**
   * Finds papers frequently cited together with a given preprint.
   *
   * @param paperUri - AT-URI of the source preprint
   * @param minCoCitations - Minimum co-citation count threshold
   * @returns Papers co-cited with the source, sorted by strength
   *
   * @remarks
   * Uses bibliographic coupling algorithm. Returns papers that share
   * many citing papers with the query paper.
   */
  findCoCitedPapers(paperUri: AtUri, minCoCitations?: number): Promise<readonly CoCitedPaper[]>;

  /**
   * Gets citation counts for a preprint.
   *
   * @param paperUri - AT-URI of the preprint
   * @returns Citation statistics
   */
  getCitationCounts(paperUri: AtUri): Promise<{
    readonly citedByCount: number;
    readonly referencesCount: number;
    readonly influentialCitedByCount: number;
  }>;

  /**
   * Deletes all citations for a preprint.
   *
   * @param paperUri - AT-URI of the preprint
   *
   * @remarks
   * Used when a preprint is removed from Chive's index.
   */
  deleteCitationsForPaper(paperUri: AtUri): Promise<void>;
}

// =============================================================================
// DISCOVERY SIGNAL SOURCES
// =============================================================================

/**
 * Pre-computed discovery signals for ranking.
 *
 * @remarks
 * Maps preprint URIs to pre-computed similarity/relevance scores
 * from various sources. Passed to RankingService for scoring.
 *
 * @public
 * @since 0.1.0
 */
export interface DiscoverySignalSources {
  /**
   * Semantic Scholar SPECTER2 similarity scores.
   */
  readonly s2Scores?: ReadonlyMap<string, number>;

  /**
   * Citation graph co-citation/coupling scores.
   */
  readonly citationScores?: ReadonlyMap<string, number>;

  /**
   * OpenAlex concept overlap scores.
   */
  readonly conceptScores?: ReadonlyMap<string, number>;

  /**
   * Author network proximity scores.
   */
  readonly authorScores?: ReadonlyMap<string, number>;

  /**
   * Collaborative filtering scores.
   */
  readonly collaborativeScores?: ReadonlyMap<string, number>;
}
