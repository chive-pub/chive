/**
 * Discovery service for personalized eprint recommendations.
 *
 * @remarks
 * This module implements the {@link IDiscoveryService} interface for enhanced
 * eprint discovery using Semantic Scholar and OpenAlex integration.
 *
 * **Critical Constraint**: All discovery features recommend only eprints
 * indexed in Chive, not external papers. External APIs (S2, OpenAlex) are
 * used strictly as enrichment signals.
 *
 * **ATProto Compliance**:
 * - Never writes to user PDSes
 * - All discovery data is derived and rebuildable
 * - Citation graph is an index, not source of truth
 * - User interaction data is stored in AppView database
 *
 * **ClaimingService Pattern**: Follows the same architectural pattern with:
 * - Optional plugin manager setter for late binding
 * - Graceful degradation when external APIs unavailable
 * - Core functionality works without plugins
 *
 * @example
 * ```typescript
 * const discoveryService = container.resolve(DiscoveryService);
 *
 * // Optional: Enable external API access
 * discoveryService.setPluginManager(pluginManager);
 *
 * // Get personalized recommendations
 * const recommendations = await discoveryService.getRecommendationsForUser(
 *   userDid,
 *   { limit: 10 }
 * );
 *
 * // Find related eprints
 * const related = await discoveryService.findRelatedEprints(
 *   eprintUri,
 *   { signals: ['citations', 'concepts'] }
 * );
 * ```
 *
 * @see {@link https://api.semanticscholar.org/api-docs/recommendations | Semantic Scholar Recommendations API}
 * @see {@link https://docs.openalex.org/api-entities/aboutness-endpoint-text | OpenAlex /text Endpoint}
 *
 * @packageDocumentation
 * @public
 * @since 0.1.0
 */

import type { OpenAlexPlugin } from '../../plugins/builtin/openalex.js';
import type { SemanticScholarPlugin } from '../../plugins/builtin/semantic-scholar.js';
import type { RecommendationService, SimilarPaper } from '../../storage/neo4j/recommendations.js';
import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type {
  CitationQueryOptions,
  CitationRelationship,
  EnrichmentInput,
  EnrichmentResult,
  ICitationGraph,
  IDiscoveryService,
  OpenAlexConceptMatch,
  OpenAlexTopicMatch,
  PaperIdentifier,
  RecommendationOptions,
  RecommendationResult,
  RelatedEprint,
  RelatedEprintOptions,
  ScoredRecommendation,
  UnifiedPaperMetadata,
  UserInteraction,
} from '../../types/interfaces/discovery.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IPluginManager } from '../../types/interfaces/plugin.interface.js';
import type { IRankingService, RankableItem } from '../../types/interfaces/ranking.interface.js';
import type { ISearchEngine } from '../../types/interfaces/search.interface.js';
import type { DiscoverySignalWeights } from '../search/ranking-service.js';

/**
 * Database row for user interactions.
 */
interface InteractionRow {
  readonly id: number;
  readonly user_did: string;
  readonly eprint_uri: string;
  readonly interaction_type: string;
  readonly recommendation_id: string | null;
  readonly created_at: Date;
}

/**
 * Database row for eprint enrichment.
 */
interface EnrichmentRow {
  readonly uri: string;
  readonly semantic_scholar_id: string | null;
  readonly openalex_id: string | null;
  readonly citation_count: number | null;
  readonly influential_citation_count: number | null;
  readonly references_count: number | null;
  readonly concepts: readonly OpenAlexConceptMatch[] | null;
  readonly topics: readonly OpenAlexTopicMatch[] | null;
  readonly enriched_at: Date | null;
}

/**
 * Enrichment data returned by getEnrichment().
 */
export interface EnrichmentData {
  readonly semanticScholarId?: string;
  readonly openAlexId?: string;
  readonly citationCount?: number;
  readonly influentialCitationCount?: number;
  readonly referencesCount?: number;
  readonly concepts?: readonly OpenAlexConceptMatch[];
  readonly topics?: readonly OpenAlexTopicMatch[];
  readonly lastEnrichedAt?: Date;
}

/**
 * Author entry in the eprints_index authors JSONB array.
 */
interface AuthorEntry {
  readonly did?: string;
  readonly name?: string;
}

/**
 * Database row for eprints.
 */
interface EprintRow {
  readonly uri: string;
  readonly title: string;
  readonly abstract: string | null;
  readonly categories: string[] | null;
  readonly doi: string | null;
  readonly arxiv_id: string | null;
  readonly publication_date: Date | null;
  readonly semantic_scholar_id: string | null;
  readonly openalex_id: string | null;
  readonly authors: readonly AuthorEntry[] | null;
}

/**
 * Default discovery signal weights matching RankingService.
 *
 * @remarks
 * SPECTER2: 0.30, co-citation: 0.25, concept overlap: 0.20,
 * author network: 0.15, collaborative: 0.10.
 */
const DEFAULT_DISCOVERY_WEIGHTS: Required<DiscoverySignalWeights> = {
  specter2: 0.3,
  coCitation: 0.25,
  conceptOverlap: 0.2,
  authorNetwork: 0.15,
  collaborative: 0.1,
};

/**
 * Entry in the signal accumulator map, tracking per-signal scores for each candidate.
 */
interface SignalAccumulatorEntry {
  title: string;
  abstract?: string;
  categories?: readonly string[];
  publicationDate?: Date;
  relationshipType: RelatedEprint['relationshipType'];
  explanation: string;
  scores: {
    citations?: number;
    concepts?: number;
    semantic?: number;
    authors?: number;
  };
}

/**
 * Discovery service implementation.
 *
 * @remarks
 * Orchestrates eprint enrichment and discovery using external APIs
 * (Semantic Scholar, OpenAlex) and internal data (citation graph, search).
 *
 * **Key Features**:
 * - Eprint enrichment with citations and concepts
 * - Personalized recommendations based on user's claimed papers
 * - Related paper discovery using multiple signals
 * - User interaction tracking for feedback loop
 *
 * **Follows ClaimingService Pattern**:
 * - Constructor takes core dependencies
 * - Optional `setPluginManager()` for external API access
 * - Works without plugins using local data only
 *
 * @public
 * @since 0.1.0
 */
export class DiscoveryService implements IDiscoveryService {
  /**
   * Optional plugin manager for external API access.
   *
   * @remarks
   * If provided, enables external API calls to Semantic Scholar and OpenAlex.
   * Service works without plugins using only local data.
   */
  private pluginManager?: IPluginManager;

  /**
   * Creates a new DiscoveryService instance.
   *
   * @param logger - Logger instance
   * @param db - Database pool
   * @param searchEngine - Elasticsearch search engine
   * @param ranking - Ranking service for personalization
   * @param citationGraph - Neo4j citation graph
   * @param recommendationEngine - Neo4j recommendation engine for combined co-citation and bibliographic coupling
   */
  constructor(
    private readonly logger: ILogger,
    private readonly db: IDatabasePool,
    private readonly searchEngine: ISearchEngine,
    private readonly ranking: IRankingService,
    private readonly citationGraph: ICitationGraph,
    private readonly recommendationEngine?: RecommendationService
  ) {}

  /**
   * Sets the plugin manager for external API access.
   *
   * @param manager - Plugin manager instance
   *
   * @remarks
   * Call this after construction to enable external API enrichment.
   * The service works without plugins using only local data.
   */
  setPluginManager(manager: IPluginManager): void {
    this.pluginManager = manager;
    this.logger.info('Plugin manager configured for discovery service');
  }

  /**
   * Enriches an eprint with data from Semantic Scholar and OpenAlex.
   *
   * @param eprint - Eprint to enrich
   * @returns Enrichment result with external data
   *
   * @remarks
   * Fetches citation data, concepts, and topics from external APIs.
   * Stores Chive-to-Chive citations in Neo4j for graph queries.
   *
   * @example
   * ```typescript
   * const result = await discoveryService.enrichEprint({
   *   uri: eprintUri,
   *   doi: '10.1234/example',
   *   title: 'Example Paper',
   * });
   *
   * if (result.success) {
   *   console.log(`Found ${result.citationCount} citations`);
   * }
   * ```
   */
  async enrichEprint(eprint: EnrichmentInput): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      uri: eprint.uri,
      success: false,
    };

    try {
      const s2Plugin = this.getSemanticScholarPlugin();
      const oaPlugin = this.getOpenAlexPlugin();

      let semanticScholarId: string | undefined;
      let openAlexId: string | undefined;
      let citationCount: number | undefined;
      let influentialCitationCount: number | undefined;
      let concepts: OpenAlexConceptMatch[] | undefined;
      let topics: OpenAlexTopicMatch[] | undefined;
      let chiveCitationsIndexed = 0;

      // Fetch from Semantic Scholar (graceful degradation on errors)
      if (s2Plugin) {
        try {
          const s2Paper = eprint.doi
            ? await s2Plugin.getPaperByDoi(eprint.doi)
            : eprint.arxivId
              ? await s2Plugin.getPaperByArxiv(eprint.arxivId)
              : null;

          if (s2Paper) {
            semanticScholarId = s2Paper.paperId;
            citationCount = s2Paper.citationCount;
            influentialCitationCount = s2Paper.influentialCitationCount;

            // Fetch citations and index Chive-to-Chive relationships
            const citationsResult = await s2Plugin.getCitations(s2Paper.paperId, { limit: 100 });
            const chiveCitations = await this.filterToChiveCitations(
              eprint.uri,
              citationsResult.citations.map((c) => ({
                paperId: c.paper.paperId,
                externalIds: c.paper.externalIds,
              }))
            );

            if (chiveCitations.length > 0) {
              await this.citationGraph.upsertCitationsBatch(chiveCitations);
              chiveCitationsIndexed = chiveCitations.length;
            }
          }
        } catch (s2Error) {
          this.logger.debug('Semantic Scholar enrichment failed (graceful degradation)', {
            uri: eprint.uri,
            error: s2Error instanceof Error ? s2Error.message : String(s2Error),
          });
        }
      }

      // Fetch from OpenAlex (graceful degradation on errors)
      if (oaPlugin) {
        try {
          const oaWork = eprint.doi ? await oaPlugin.getWorkByDoi(eprint.doi) : null;

          if (!oaWork && eprint.title) {
            // Fallback: classify by title/abstract
            const classification = await oaPlugin.classifyText(eprint.title, eprint.abstract);

            if (classification.topics.length > 0 || classification.concepts.length > 0) {
              topics = classification.topics.map((t) => ({
                id: t.id,
                displayName: t.displayName,
                subfield: t.subfield,
                field: t.field,
                domain: t.domain,
                score: t.score,
              }));

              concepts = classification.concepts.map((c) => ({
                id: c.id,
                displayName: c.displayName,
                wikidataId: c.wikidata,
                score: c.score ?? 0,
                level: c.level ?? 0,
              }));
            }
          } else if (oaWork) {
            openAlexId = oaWork.id;

            // OpenAlexWork has concepts, not topics
            if (oaWork.concepts) {
              concepts = oaWork.concepts.map((c) => ({
                id: c.id,
                displayName: c.displayName,
                wikidataId: c.wikidata,
                score: c.score ?? 0,
                level: c.level ?? 0,
              }));
            }
          }
        } catch (oaError) {
          this.logger.debug('OpenAlex enrichment failed (graceful degradation)', {
            uri: eprint.uri,
            error: oaError instanceof Error ? oaError.message : String(oaError),
          });
        }
      }

      // Update the eprint record with enrichment data
      if (semanticScholarId || openAlexId) {
        await this.updateEprintEnrichment(eprint.uri, {
          semanticScholarId,
          openAlexId,
          citationCount,
          influentialCitationCount,
        });
      }

      return {
        uri: eprint.uri,
        semanticScholarId,
        openAlexId,
        citationCount,
        influentialCitationCount,
        concepts,
        topics,
        chiveCitationsIndexed,
        success: true,
      };
    } catch (error) {
      this.logger.warn('Eprint enrichment failed', {
        uri: eprint.uri,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ...result,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Looks up paper metadata from external sources.
   *
   * @param identifier - Paper identifier (DOI, arXiv, etc.)
   * @returns Unified metadata or null if not found
   *
   * @remarks
   * Queries Semantic Scholar and OpenAlex in parallel, merges results.
   */
  async lookupPaper(identifier: PaperIdentifier): Promise<UnifiedPaperMetadata | null> {
    const s2Plugin = this.getSemanticScholarPlugin();
    const oaPlugin = this.getOpenAlexPlugin();

    if (!s2Plugin && !oaPlugin) {
      this.logger.debug('No external plugins available for paper lookup');
      return null;
    }

    try {
      // Query both sources in parallel
      const [s2Paper, oaWork] = await Promise.all([
        s2Plugin && identifier.doi
          ? s2Plugin.getPaperByDoi(identifier.doi)
          : s2Plugin && identifier.arxivId
            ? s2Plugin.getPaperByArxiv(identifier.arxivId)
            : null,
        oaPlugin && identifier.doi ? oaPlugin.getWorkByDoi(identifier.doi) : null,
      ]);

      if (!s2Paper && !oaWork) {
        return null;
      }

      // Merge results, preferring S2 for core metadata
      const title = s2Paper?.title ?? oaWork?.title ?? '';
      const abstract = s2Paper?.abstract ?? oaWork?.abstract;

      const authors =
        s2Paper?.authors?.map((a) => ({
          name: a.name,
          orcid: undefined, // S2 doesn't return ORCID in paper response
        })) ??
        oaWork?.authorships?.map((a) => ({
          name: a.author.displayName,
          orcid: a.author.orcid ?? undefined,
        })) ??
        [];

      const concepts = oaWork?.concepts?.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        wikidataId: c.wikidata,
        score: c.score ?? 0,
        level: c.level ?? 0,
      }));

      return {
        title,
        abstract,
        authors,
        year: s2Paper?.year ?? oaWork?.publicationYear,
        doi: identifier.doi,
        venue: s2Paper?.venue ?? oaWork?.primaryLocation?.source?.displayName,
        citationCount: s2Paper?.citationCount ?? oaWork?.citedByCount,
        externalIds: {
          doi: identifier.doi,
          arxivId: identifier.arxivId,
          semanticScholarId: s2Paper?.paperId,
          openAlexId: oaWork?.id,
        },
        concepts,
      };
    } catch (error) {
      this.logger.warn('Paper lookup failed', {
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Finds related Chive eprints using multiple signals.
   *
   * @param eprintUri - AT-URI of the source eprint
   * @param options - Query options
   * @returns Related eprints with relationship metadata
   *
   * @remarks
   * Combines five signal types: citation graph (co-citation + bibliographic
   * coupling), concept overlap, semantic similarity, and author network.
   * Each paper accumulates per-signal scores that are combined using
   * configurable discovery weights from RankingService.
   *
   * All results are from Chive's index.
   */
  async findRelatedEprints(
    eprintUri: AtUri,
    options?: RelatedEprintOptions
  ): Promise<readonly RelatedEprint[]> {
    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0.2;
    const signals = options?.signals ?? ['citations', 'concepts', 'semantic'];

    // Accumulator: track per-signal scores for weighted combination
    const signalAccumulator = new Map<
      string,
      {
        title: string;
        abstract?: string;
        categories?: readonly string[];
        publicationDate?: Date;
        relationshipType: RelatedEprint['relationshipType'];
        explanation: string;
        scores: {
          citations?: number;
          concepts?: number;
          semantic?: number;
          authors?: number;
        };
      }
    >();

    // Get eprint data
    const eprint = await this.getEprintByUri(eprintUri);
    if (!eprint) {
      return [];
    }

    // Signal 1: Citation-based (co-citation + bibliographic coupling + direct citations)
    if (signals.includes('citations')) {
      await this.collectCitationSignals(eprintUri, signalAccumulator);
    }

    // Signal 2: Concept overlap (OpenAlex topics and concepts)
    if (signals.includes('concepts')) {
      await this.collectConceptSignals(eprintUri, signalAccumulator);
    }

    // Signal 3: Semantic similarity (via S2 recommendations or ES MLT fallback)
    if (signals.includes('semantic')) {
      await this.collectSemanticSignals(eprintUri, eprint, minScore, signalAccumulator);
    }

    // Signal 4: Author network (papers sharing authors)
    if (signals.includes('authors')) {
      await this.collectAuthorSignals(eprintUri, eprint, signalAccumulator);
    }

    // Compute weighted combined scores and build RelatedEprint results
    const weights = DEFAULT_DISCOVERY_WEIGHTS;
    const related: RelatedEprint[] = [];

    for (const [uri, entry] of signalAccumulator) {
      // Filter out the source eprint itself
      if (uri === eprintUri) continue;

      const combinedScore =
        (entry.scores.semantic ?? 0) * weights.specter2 +
        (entry.scores.citations ?? 0) * weights.coCitation +
        (entry.scores.concepts ?? 0) * weights.conceptOverlap +
        (entry.scores.authors ?? 0) * weights.authorNetwork;

      if (combinedScore < minScore) continue;

      related.push({
        uri: uri as AtUri,
        title: entry.title,
        abstract: entry.abstract,
        categories: entry.categories,
        publicationDate: entry.publicationDate,
        score: combinedScore,
        relationshipType: entry.relationshipType,
        explanation: entry.explanation,
        signalScores: {
          citations: entry.scores.citations,
          concepts: entry.scores.concepts,
          semantic: entry.scores.semantic,
          authors: entry.scores.authors,
        },
      });
    }

    // Sort by combined score and limit
    related.sort((a, b) => b.score - a.score);
    return related.slice(0, limit);
  }

  /**
   * Collects citation-based signals: co-citation, bibliographic coupling, and direct citations.
   *
   * @param eprintUri - Source eprint URI
   * @param accumulator - Signal accumulator map
   */
  private async collectCitationSignals(
    eprintUri: AtUri,
    accumulator: Map<string, SignalAccumulatorEntry>
  ): Promise<void> {
    try {
      // Use RecommendationService.getSimilar() if available; it combines
      // co-citation AND bibliographic coupling in a single Cypher query.
      if (this.recommendationEngine) {
        const similarPapers = await this.recommendationEngine.getSimilar(eprintUri, 20);

        for (const paper of similarPapers) {
          this.mergeSignal(accumulator, paper.uri, {
            title: paper.title,
            relationshipType: this.mapSimilarityReason(paper.reason),
            explanation: this.buildCitationExplanation(paper),
            scores: { citations: this.normalizeSimilarityScore(paper.similarity) },
          });
        }
      } else {
        // Fallback: use findCoCitedPapers (co-citation only)
        const coCited = await this.citationGraph.findCoCitedPapers(eprintUri, 2);

        for (const paper of coCited) {
          this.mergeSignal(accumulator, paper.uri, {
            title: paper.title,
            abstract: paper.abstract,
            categories: paper.categories,
            publicationDate: paper.publicationDate,
            relationshipType: 'co-cited',
            explanation: `Frequently cited together (${paper.coCitationCount} co-citations)`,
            scores: { citations: paper.strength },
          });
        }
      }

      // Direct citations (citing papers and references)
      const [citingResult, referencesResult] = await Promise.all([
        this.citationGraph.getCitingPapers(eprintUri, { limit: 5 }),
        this.citationGraph.getReferences(eprintUri, { limit: 5 }),
      ]);

      for (const citation of citingResult.citations) {
        if (accumulator.has(citation.citingUri)) continue;
        const citingEprint = await this.getEprintByUri(citation.citingUri);
        if (citingEprint) {
          const score = citation.isInfluential ? 0.9 : 0.7;
          this.mergeSignal(accumulator, citation.citingUri, {
            title: citingEprint.title,
            abstract: citingEprint.abstract ?? undefined,
            categories: citingEprint.categories ?? undefined,
            publicationDate: citingEprint.publication_date ?? undefined,
            relationshipType: 'cited-by',
            explanation: 'Cites this paper',
            scores: { citations: score },
          });
        }
      }

      for (const reference of referencesResult.citations) {
        if (accumulator.has(reference.citedUri)) continue;
        const refEprint = await this.getEprintByUri(reference.citedUri);
        if (refEprint) {
          const score = reference.isInfluential ? 0.9 : 0.7;
          this.mergeSignal(accumulator, reference.citedUri, {
            title: refEprint.title,
            abstract: refEprint.abstract ?? undefined,
            categories: refEprint.categories ?? undefined,
            publicationDate: refEprint.publication_date ?? undefined,
            relationshipType: 'cites',
            explanation: 'Referenced by this paper',
            scores: { citations: score },
          });
        }
      }
    } catch (error) {
      this.logger.debug('Citation graph signals unavailable', {
        uri: eprintUri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collects concept overlap signals from OpenAlex enrichment data.
   *
   * @param eprintUri - Source eprint URI
   * @param accumulator - Signal accumulator map
   *
   * @remarks
   * Scores overlap depth in the OpenAlex hierarchy:
   * - Same domain: 0.3
   * - Same field: 0.5
   * - Same subfield: 0.7
   * - Same topic: 0.9
   */
  private async collectConceptSignals(
    eprintUri: AtUri,
    accumulator: Map<string, SignalAccumulatorEntry>
  ): Promise<void> {
    try {
      const enrichment = await this.getEnrichment(eprintUri);
      if (!enrichment) return;

      const sourceTopics = enrichment.topics ?? [];
      const sourceConcepts = enrichment.concepts ?? [];

      if (sourceTopics.length === 0 && sourceConcepts.length === 0) return;

      // Build lookup sets for fast matching at each hierarchy level
      const sourceDomains = new Set(sourceTopics.map((t) => t.domain).filter(Boolean));
      const sourceFields = new Set(sourceTopics.map((t) => t.field).filter(Boolean));
      const sourceSubfields = new Set(sourceTopics.map((t) => t.subfield).filter(Boolean));
      const sourceTopicIds = new Set(sourceTopics.map((t) => t.id));
      const sourceConceptIds = new Set(sourceConcepts.map((c) => c.id));

      // Query eprint_enrichment for papers with overlapping topics/concepts.
      // Uses jsonb containment and array overlap to find candidates efficiently.
      const candidateResult = await this.db.query<{
        readonly uri: string;
        readonly topics: readonly OpenAlexTopicMatch[] | null;
        readonly concepts: readonly OpenAlexConceptMatch[] | null;
      }>(
        `SELECT uri, topics, concepts
         FROM eprint_enrichment
         WHERE uri != $1
           AND (topics IS NOT NULL OR concepts IS NOT NULL)
         LIMIT 200`,
        [eprintUri]
      );

      for (const row of candidateResult.rows) {
        const candidateTopics = row.topics ?? [];
        const candidateConcepts = row.concepts ?? [];

        // Score topic hierarchy overlap (highest match wins)
        let topicScore = 0;

        for (const topic of candidateTopics) {
          if (sourceTopicIds.has(topic.id)) {
            topicScore = Math.max(topicScore, 0.9);
            break; // Already at max topic score
          }
          if (topic.subfield && sourceSubfields.has(topic.subfield)) {
            topicScore = Math.max(topicScore, 0.7);
          }
          if (topic.field && sourceFields.has(topic.field)) {
            topicScore = Math.max(topicScore, 0.5);
          }
          if (topic.domain && sourceDomains.has(topic.domain)) {
            topicScore = Math.max(topicScore, 0.3);
          }
        }

        // Score concept overlap (ratio of shared concepts)
        let conceptScore = 0;
        if (candidateConcepts.length > 0 && sourceConceptIds.size > 0) {
          const sharedCount = candidateConcepts.filter((c) => sourceConceptIds.has(c.id)).length;
          conceptScore = sharedCount / Math.max(sourceConceptIds.size, candidateConcepts.length);
        }

        // Combined concept signal: weight topic hierarchy more than flat concept overlap
        const overallScore = Math.max(topicScore, conceptScore * 0.8);

        if (overallScore > 0) {
          // Fetch the eprint metadata to populate the accumulator
          const candidateEprint = await this.getEprintByUri(row.uri as AtUri);
          if (candidateEprint) {
            this.mergeSignal(accumulator, row.uri, {
              title: candidateEprint.title,
              abstract: candidateEprint.abstract ?? undefined,
              categories: candidateEprint.categories ?? undefined,
              publicationDate: candidateEprint.publication_date ?? undefined,
              relationshipType: 'similar-topics',
              explanation: this.buildConceptExplanation(topicScore, conceptScore),
              scores: { concepts: overallScore },
            });
          }
        }
      }
    } catch (error) {
      this.logger.debug('Concept overlap signals unavailable', {
        uri: eprintUri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collects semantic similarity signals via SPECTER2 or ES MLT fallback.
   *
   * @param eprintUri - Source eprint URI
   * @param eprint - Source eprint data
   * @param minScore - Minimum score threshold
   * @param accumulator - Signal accumulator map
   */
  private async collectSemanticSignals(
    eprintUri: AtUri,
    eprint: EprintRow,
    minScore: number,
    accumulator: Map<string, SignalAccumulatorEntry>
  ): Promise<void> {
    let usedSpecter2 = false;

    // Prefer SPECTER2 embeddings via Semantic Scholar when available
    if (eprint.semantic_scholar_id) {
      const s2Plugin = this.getSemanticScholarPlugin();
      if (s2Plugin) {
        try {
          const recommendations = await s2Plugin.getRecommendations(eprint.semantic_scholar_id, {
            limit: 10,
          });

          for (const rec of recommendations) {
            // Only include if paper is in Chive
            const chiveEprint = await this.findEprintByExternalId(
              rec.paperId,
              rec.externalIds?.DOI ?? undefined
            );
            if (chiveEprint) {
              this.mergeSignal(accumulator, chiveEprint.uri, {
                title: chiveEprint.title,
                abstract: chiveEprint.abstract ?? undefined,
                categories: chiveEprint.categories ?? undefined,
                publicationDate: chiveEprint.publication_date ?? undefined,
                relationshipType: 'semantically-similar',
                explanation: 'Semantically similar based on content',
                scores: { semantic: 0.7 },
              });
            }
          }
          usedSpecter2 = true;
        } catch (error) {
          this.logger.debug('S2 recommendations unavailable, falling back to ES MLT', {
            uri: eprintUri,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Fallback: Elasticsearch More Like This when SPECTER2 is unavailable
    if (!usedSpecter2) {
      try {
        const mltResults = await this.searchEngine.findSimilarByText(eprintUri, {
          limit: 10,
          minTermFreq: 1,
          minDocFreq: 1,
          maxQueryTerms: 25,
          minimumShouldMatch: '30%',
        });

        for (const mltResult of mltResults) {
          // Scores are already 0-1 via ES saturation normalization.
          // Discount by 0.6 relative to SPECTER2 embeddings.
          const score = mltResult.score * 0.6;

          if (score < minScore) continue;

          this.mergeSignal(accumulator, mltResult.uri, {
            title: mltResult.title ?? '',
            relationshipType: 'semantically-similar',
            explanation: 'Similar content based on title, abstract, and keywords',
            scores: { semantic: score },
          });
        }

        this.logger.debug('ES MLT fallback produced results', {
          uri: eprintUri,
          resultCount: mltResults.length,
        });
      } catch (error) {
        this.logger.debug('ES MLT fallback unavailable', {
          uri: eprintUri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Collects author network signals by finding papers sharing authors.
   *
   * @param eprintUri - Source eprint URI
   * @param eprint - Source eprint data
   * @param accumulator - Signal accumulator map
   *
   * @remarks
   * Queries eprints_index for papers with overlapping authors using
   * JSONB array element matching. Scores based on author overlap count.
   */
  private async collectAuthorSignals(
    eprintUri: AtUri,
    eprint: EprintRow,
    accumulator: Map<string, SignalAccumulatorEntry>
  ): Promise<void> {
    try {
      const authors = eprint.authors;
      if (!authors || authors.length === 0) return;

      // Extract author DIDs for matching
      const authorDids = authors.map((a) => a.did).filter(Boolean) as string[];
      if (authorDids.length === 0) return;

      // Find papers sharing at least one author DID.
      // Uses jsonb_array_elements to unnest the authors array and match by DID.
      const result = await this.db.query<{
        readonly uri: string;
        readonly title: string;
        readonly abstract: string | null;
        readonly categories: string[] | null;
        readonly publication_date: Date | null;
        readonly overlap_count: number;
      }>(
        `SELECT DISTINCT e.uri, e.title, e.abstract, e.keywords AS categories,
                e.created_at AS publication_date,
                (
                  SELECT COUNT(DISTINCT a->>'did')
                  FROM jsonb_array_elements(e.authors) AS a
                  WHERE a->>'did' = ANY($2)
                )::int AS overlap_count
         FROM eprints_index e
         WHERE e.uri != $1
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(e.authors) AS a
             WHERE a->>'did' = ANY($2)
           )
         ORDER BY overlap_count DESC
         LIMIT 30`,
        [eprintUri, authorDids]
      );

      const totalAuthors = authorDids.length;

      for (const row of result.rows) {
        // Score based on proportion of shared authors (more overlap = higher score)
        const overlapRatio = row.overlap_count / totalAuthors;
        // Scale to 0-1: single author overlap gets at least 0.4, full overlap gets 1.0
        const score = Math.min(1.0, 0.4 + overlapRatio * 0.6);

        this.mergeSignal(accumulator, row.uri, {
          title: row.title,
          abstract: row.abstract ?? undefined,
          categories: row.categories ?? undefined,
          publicationDate: row.publication_date ?? undefined,
          relationshipType: 'same-author',
          explanation:
            row.overlap_count === 1
              ? 'Shares an author with this paper'
              : `Shares ${row.overlap_count} authors with this paper`,
          scores: { authors: score },
        });
      }
    } catch (error) {
      this.logger.debug('Author network signals unavailable', {
        uri: eprintUri,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Gets personalized recommendations for a user.
   *
   * @param userDid - User's DID
   * @param options - Recommendation options
   * @returns Paginated recommendations with explanations
   *
   * @remarks
   * Uses five signal types for personalized recommendations:
   * 1. Field-based: text search matching user's research fields
   * 2. Citation-based: papers citing user's claimed work
   * 3. SPECTER2-based: semantic similarity to claimed papers
   * 4. Topic-based: OpenAlex concept overlap with user's claimed paper topics
   * 5. Co-author: papers by the user's co-authors
   */
  async getRecommendationsForUser(
    userDid: DID,
    options?: RecommendationOptions
  ): Promise<RecommendationResult> {
    const limit = options?.limit ?? 20;
    const signals = options?.signals ?? ['fields', 'citations', 'semantic'];

    // Get user's claimed papers for personalization signals
    const claimedPapers = await this.getUserClaimedPapers(userDid);
    const userFields = await this.ranking.getUserFields(userDid);

    // Get dismissed recommendations to filter out
    const dismissedUris = await this.getDismissedRecommendations(userDid);

    const candidateMap = new Map<
      string,
      RankableItem & { explanation: string; signalType: string }
    >();

    /** Checks whether a URI should be excluded from recommendations. */
    const shouldExclude = (uri: string): boolean =>
      dismissedUris.has(uri) || claimedPapers.has(uri) || candidateMap.has(uri);

    // Signal 1: Field-based recommendations
    if (signals.includes('fields') && userFields.length > 0) {
      const fieldBasedResults = await this.searchEngine.search({
        q: userFields.slice(0, 3).join(' OR '),
        limit: limit * 2, // Get more to filter
      });

      for (const hit of fieldBasedResults.hits) {
        if (!dismissedUris.has(hit.uri) && !claimedPapers.has(hit.uri)) {
          // Fetch full eprint data since search hits only contain uri and score
          const eprint = await this.getEprintByUri(hit.uri);
          if (eprint) {
            candidateMap.set(hit.uri, {
              title: eprint.title,
              abstract: eprint.abstract ?? undefined,
              categories: eprint.categories ?? undefined,
              publicationDate: eprint.publication_date ?? undefined,
              explanation: `Matches your research fields`,
              signalType: 'fields',
            });
          }
        }
      }
    }

    // Signal 2: Citations to user's papers
    if (signals.includes('citations') && claimedPapers.size > 0) {
      for (const claimedUri of Array.from(claimedPapers).slice(0, 5)) {
        const citing = await this.citationGraph.getCitingPapers(claimedUri as AtUri, { limit: 5 });

        for (const citation of citing.citations) {
          if (!shouldExclude(citation.citingUri)) {
            const eprint = await this.getEprintByUri(citation.citingUri);
            if (eprint) {
              candidateMap.set(citation.citingUri, {
                title: eprint.title,
                abstract: eprint.abstract ?? undefined,
                categories: eprint.categories ?? undefined,
                publicationDate: eprint.publication_date ?? undefined,
                explanation: 'Cites your work',
                signalType: 'citations',
              });
            }
          }
        }
      }
    }

    // Signal 3: SPECTER2-based similarity to claimed papers
    if (signals.includes('semantic') && claimedPapers.size > 0) {
      const s2Plugin = this.getSemanticScholarPlugin();
      if (s2Plugin) {
        // Get S2 paper IDs for claimed papers
        const s2Ids = await this.getSemanticScholarIdsForEprints(
          Array.from(claimedPapers) as AtUri[]
        );

        if (s2Ids.length > 0) {
          try {
            const recommendations = await s2Plugin.getRecommendationsFromLists({
              positivePaperIds: s2Ids,
              limit: limit,
            });

            for (const rec of recommendations) {
              const chiveEprint = await this.findEprintByExternalId(
                rec.paperId,
                rec.externalIds?.DOI ?? undefined
              );
              if (chiveEprint && !shouldExclude(chiveEprint.uri)) {
                candidateMap.set(chiveEprint.uri, {
                  title: chiveEprint.title,
                  abstract: chiveEprint.abstract ?? undefined,
                  categories: chiveEprint.categories ?? undefined,
                  publicationDate: chiveEprint.publication_date ?? undefined,
                  explanation: 'Similar to your claimed papers',
                  signalType: 'semantic',
                });
              }
            }
          } catch (error) {
            this.logger.debug('S2 multi-example recommendations unavailable', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    // Signal 4: OpenAlex topic-based discovery from claimed paper enrichments
    if (claimedPapers.size > 0) {
      try {
        await this.collectTopicRecommendations(claimedPapers, dismissedUris, candidateMap, limit);
      } catch (error) {
        this.logger.debug('Topic-based recommendation signal unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Signal 5: Co-author papers (papers by the user's co-authors)
    if (signals.includes('collaborators') && claimedPapers.size > 0) {
      try {
        await this.collectCoauthorRecommendations(
          userDid,
          claimedPapers,
          dismissedUris,
          candidateMap,
          limit
        );
      } catch (error) {
        this.logger.debug('Co-author recommendation signal unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Rank candidates using RankingService
    const candidates = Array.from(candidateMap.entries()).map(([uri, item]) => ({
      uri,
      ...item,
    }));

    const ranked = await this.ranking.rank(candidates, {
      userDid,
      userFields,
    });

    // Convert to ScoredRecommendation format
    const recommendations: ScoredRecommendation[] = ranked
      .slice(0, limit)
      .filter((r) => candidateMap.has((r.item as { uri: string }).uri))
      .map((r) => {
        const item = candidateMap.get((r.item as { uri: string }).uri);
        if (!item) {
          // This should never happen due to filter above, but TypeScript needs assurance
          throw new DatabaseError(
            'QUERY',
            'Candidate not found in map during recommendation ranking'
          );
        }
        return {
          uri: (r.item as { uri: string }).uri as AtUri,
          title: r.item.title,
          abstract: r.item.abstract,
          categories: r.item.categories,
          publicationDate: r.item.publicationDate,
          score: r.score,
          explanation: {
            type: this.mapSignalTypeToReasonType(item.signalType),
            text: item.explanation,
            weight: r.fieldMatchScore > 0 ? r.fieldMatchScore : r.textRelevanceScore,
          },
          signalScores: {
            fields: r.fieldMatchScore,
          },
        };
      });

    return {
      recommendations,
      hasMore: ranked.length > limit,
    };
  }

  /**
   * Records a user interaction for feedback loop.
   *
   * @param userDid - User's DID
   * @param interaction - Interaction details
   *
   * @remarks
   * Tracks views, clicks, dismissals, and claims to improve
   * future recommendations. Uses dismissals as negative signals.
   */
  async recordInteraction(userDid: DID, interaction: UserInteraction): Promise<void> {
    if (!interaction.eprintUri) {
      throw new ValidationError('Eprint URI is required', 'eprintUri', 'required');
    }

    await this.db.query(
      `INSERT INTO user_interactions (
        user_did, eprint_uri, interaction_type, recommendation_id, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [userDid, interaction.eprintUri, interaction.type, interaction.recommendationId ?? null]
    );

    this.logger.debug('Recorded user interaction', {
      userDid,
      type: interaction.type,
      eprintUri: interaction.eprintUri,
    });
  }

  // =============================================================================
  // CITATION GRAPH DELEGATION METHODS
  // =============================================================================

  /**
   * Gets citation counts for an eprint.
   *
   * @param uri - AT-URI of the eprint
   * @returns Citation statistics
   *
   * @remarks
   * Delegates to the underlying citation graph service.
   */
  async getCitationCounts(uri: AtUri): Promise<{
    readonly citedByCount: number;
    readonly referencesCount: number;
    readonly influentialCitedByCount: number;
  }> {
    return this.citationGraph.getCitationCounts(uri);
  }

  /**
   * Gets papers that cite a given eprint.
   *
   * @param uri - AT-URI of the cited eprint
   * @param options - Query options
   * @returns Papers that cite the given eprint
   *
   * @remarks
   * Delegates to the underlying citation graph service.
   * Returns a result with cursor for pagination.
   */
  async getCitingPapers(
    uri: AtUri,
    options?: CitationQueryOptions & { cursor?: string }
  ): Promise<{
    citations: CitationRelationship[];
    hasMore: boolean;
    cursor?: string;
  }> {
    const result = await this.citationGraph.getCitingPapers(uri, options);
    return {
      citations: [...result.citations],
      hasMore: result.hasMore,
      cursor:
        result.hasMore && result.citations.length > 0
          ? String((options?.offset ?? 0) + result.citations.length)
          : undefined,
    };
  }

  /**
   * Gets papers that a given eprint cites (references).
   *
   * @param uri - AT-URI of the citing eprint
   * @param options - Query options
   * @returns Papers referenced by the given eprint
   *
   * @remarks
   * Delegates to the underlying citation graph service.
   * Returns a result with cursor for pagination.
   */
  async getReferences(
    uri: AtUri,
    options?: CitationQueryOptions & { cursor?: string }
  ): Promise<{
    citations: CitationRelationship[];
    hasMore: boolean;
    cursor?: string;
  }> {
    const result = await this.citationGraph.getReferences(uri, options);
    return {
      citations: [...result.citations],
      hasMore: result.hasMore,
      cursor:
        result.hasMore && result.citations.length > 0
          ? String((options?.offset ?? 0) + result.citations.length)
          : undefined,
    };
  }

  /**
   * Gets enrichment data for an eprint.
   *
   * @param uri - AT-URI of the eprint
   * @returns Enrichment data or null if not available
   *
   * @remarks
   * Retrieves stored enrichment data from the database, including
   * external IDs, citation counts, concepts, and topics.
   */
  async getEnrichment(uri: AtUri): Promise<EnrichmentData | null> {
    const result = await this.db.query<EnrichmentRow>(
      `SELECT uri, semantic_scholar_id, openalex_id, citation_count,
              influential_citation_count, references_count, concepts, topics,
              enriched_at
       FROM eprint_enrichment WHERE uri = $1`,
      [uri]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      semanticScholarId: row.semantic_scholar_id ?? undefined,
      openAlexId: row.openalex_id ?? undefined,
      citationCount: row.citation_count ?? undefined,
      influentialCitationCount: row.influential_citation_count ?? undefined,
      referencesCount: row.references_count ?? undefined,
      concepts: row.concepts ?? undefined,
      topics: row.topics ?? undefined,
      lastEnrichedAt: row.enriched_at ?? undefined,
    };
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Collects topic-based recommendations from claimed paper enrichments.
   *
   * @param claimedPapers - User's claimed paper URIs
   * @param dismissedUris - URIs the user has dismissed
   * @param candidateMap - Candidate accumulator map
   * @param limit - Maximum candidates to add
   *
   * @remarks
   * Aggregates OpenAlex topics from the user's claimed papers, then
   * finds other papers with overlapping topics from eprint_enrichment.
   * This provides richer semantic matching than the field-text-search
   * approach because it uses structured topic hierarchy data.
   */
  private async collectTopicRecommendations(
    claimedPapers: Set<string>,
    dismissedUris: Set<string>,
    candidateMap: Map<string, RankableItem & { explanation: string; signalType: string }>,
    limit: number
  ): Promise<void> {
    // Gather topics from all claimed papers' enrichments
    const allTopicIds = new Set<string>();
    const allDomains = new Set<string>();
    const allFields = new Set<string>();

    for (const claimedUri of Array.from(claimedPapers).slice(0, 10)) {
      const enrichment = await this.getEnrichment(claimedUri as AtUri);
      if (enrichment?.topics) {
        for (const topic of enrichment.topics) {
          allTopicIds.add(topic.id);
          if (topic.domain) allDomains.add(topic.domain);
          if (topic.field) allFields.add(topic.field);
        }
      }
    }

    if (allTopicIds.size === 0) return;

    // Find papers with overlapping topics
    const candidateResult = await this.db.query<{
      readonly uri: string;
      readonly topics: readonly OpenAlexTopicMatch[] | null;
    }>(
      `SELECT uri, topics
       FROM eprint_enrichment
       WHERE uri != ALL($1)
         AND topics IS NOT NULL
       LIMIT 200`,
      [Array.from(claimedPapers)]
    );

    for (const row of candidateResult.rows) {
      if (dismissedUris.has(row.uri) || claimedPapers.has(row.uri) || candidateMap.has(row.uri)) {
        continue;
      }

      const candidateTopics = row.topics ?? [];
      let bestMatch = 0;

      for (const topic of candidateTopics) {
        if (allTopicIds.has(topic.id)) {
          bestMatch = Math.max(bestMatch, 0.9);
          break;
        }
        if (topic.field && allFields.has(topic.field)) {
          bestMatch = Math.max(bestMatch, 0.5);
        }
        if (topic.domain && allDomains.has(topic.domain)) {
          bestMatch = Math.max(bestMatch, 0.3);
        }
      }

      if (bestMatch > 0.2) {
        const eprint = await this.getEprintByUri(row.uri as AtUri);
        if (eprint) {
          candidateMap.set(row.uri, {
            title: eprint.title,
            abstract: eprint.abstract ?? undefined,
            categories: eprint.categories ?? undefined,
            publicationDate: eprint.publication_date ?? undefined,
            explanation: 'Shares research topics with your papers',
            signalType: 'concepts',
          });
        }
      }

      // Stop once we have enough candidates
      if (candidateMap.size >= limit * 3) break;
    }
  }

  /**
   * Collects co-author paper recommendations.
   *
   * @param userDid - User's DID
   * @param claimedPapers - User's claimed paper URIs
   * @param dismissedUris - URIs the user has dismissed
   * @param candidateMap - Candidate accumulator map
   * @param limit - Maximum candidates to add
   *
   * @remarks
   * Finds co-authors from the user's claimed papers, then retrieves
   * papers by those co-authors that the user has not claimed.
   */
  private async collectCoauthorRecommendations(
    userDid: DID,
    claimedPapers: Set<string>,
    dismissedUris: Set<string>,
    candidateMap: Map<string, RankableItem & { explanation: string; signalType: string }>,
    limit: number
  ): Promise<void> {
    // Get co-author DIDs from user's claimed papers
    const coauthorResult = await this.db.query<{ did: string; name: string | null }>(
      `SELECT DISTINCT a->>'did' AS did, a->>'name' AS name
       FROM eprints_index e,
            jsonb_array_elements(e.authors) AS a
       WHERE e.uri = ANY($1)
         AND a->>'did' IS NOT NULL
         AND a->>'did' != $2`,
      [Array.from(claimedPapers), userDid]
    );

    const coauthorDids = coauthorResult.rows.map((r) => r.did).filter(Boolean);
    if (coauthorDids.length === 0) return;

    // Find papers by co-authors that the user has not claimed
    const papersResult = await this.db.query<{
      readonly uri: string;
      readonly title: string;
      readonly abstract: string | null;
      readonly categories: string[] | null;
      readonly publication_date: Date | null;
      readonly coauthor_name: string | null;
    }>(
      `SELECT DISTINCT ON (e.uri)
              e.uri, e.title, e.abstract, e.keywords AS categories,
              e.created_at AS publication_date,
              a->>'name' AS coauthor_name
       FROM eprints_index e,
            jsonb_array_elements(e.authors) AS a
       WHERE a->>'did' = ANY($1)
         AND e.uri != ALL($2)
       ORDER BY e.uri, e.created_at DESC
       LIMIT $3`,
      [coauthorDids, Array.from(claimedPapers), limit]
    );

    for (const row of papersResult.rows) {
      if (dismissedUris.has(row.uri) || candidateMap.has(row.uri)) continue;

      candidateMap.set(row.uri, {
        title: row.title,
        abstract: row.abstract ?? undefined,
        categories: row.categories ?? undefined,
        publicationDate: row.publication_date ?? undefined,
        explanation: row.coauthor_name
          ? `By your co-author ${row.coauthor_name}`
          : 'By one of your co-authors',
        signalType: 'collaborators',
      });
    }
  }

  /**
   * Merges a signal score into the accumulator for a given URI.
   *
   * @remarks
   * If the URI already exists, merges the new signal scores (taking the
   * max of each signal) and keeps the first-seen metadata. If it does not
   * exist, creates a new entry.
   */
  private mergeSignal(
    accumulator: Map<string, SignalAccumulatorEntry>,
    uri: string,
    entry: SignalAccumulatorEntry
  ): void {
    const existing = accumulator.get(uri);
    if (existing) {
      // Merge signal scores: take max of each
      if (entry.scores.citations !== undefined) {
        existing.scores.citations = Math.max(
          existing.scores.citations ?? 0,
          entry.scores.citations
        );
      }
      if (entry.scores.concepts !== undefined) {
        existing.scores.concepts = Math.max(existing.scores.concepts ?? 0, entry.scores.concepts);
      }
      if (entry.scores.semantic !== undefined) {
        existing.scores.semantic = Math.max(existing.scores.semantic ?? 0, entry.scores.semantic);
      }
      if (entry.scores.authors !== undefined) {
        existing.scores.authors = Math.max(existing.scores.authors ?? 0, entry.scores.authors);
      }
    } else {
      accumulator.set(uri, {
        title: entry.title,
        abstract: entry.abstract,
        categories: entry.categories,
        publicationDate: entry.publicationDate,
        relationshipType: entry.relationshipType,
        explanation: entry.explanation,
        scores: { ...entry.scores },
      });
    }
  }

  /**
   * Maps SimilarityReason from RecommendationService to RelatedEprintRelationship.
   */
  private mapSimilarityReason(reason: string): RelatedEprint['relationshipType'] {
    switch (reason) {
      case 'co-citation':
        return 'co-cited';
      case 'bibliographic-coupling':
        return 'bibliographic-coupling';
      default:
        return 'co-cited';
    }
  }

  /**
   * Normalizes the similarity score from RecommendationService to 0-1 range.
   *
   * @remarks
   * The RecommendationService uses `(sharedCiters * 2.0 + sharedRefs * 1.5)` which
   * can produce values well above 1. Apply a saturation function to normalize.
   */
  private normalizeSimilarityScore(similarity: number): number {
    // Saturation: score / (score + k), where k controls curve steepness
    const k = 5;
    return similarity / (similarity + k);
  }

  /**
   * Builds an explanation string for citation-based similarity results.
   */
  private buildCitationExplanation(paper: SimilarPaper): string {
    const parts: string[] = [];
    if (paper.sharedCiters > 0) {
      parts.push(`${paper.sharedCiters} shared citing paper${paper.sharedCiters > 1 ? 's' : ''}`);
    }
    if (paper.sharedReferences > 0) {
      parts.push(
        `${paper.sharedReferences} shared reference${paper.sharedReferences > 1 ? 's' : ''}`
      );
    }
    return parts.length > 0 ? parts.join(', ') : 'Related via citation network';
  }

  /**
   * Builds an explanation string for concept overlap results.
   */
  private buildConceptExplanation(topicScore: number, conceptScore: number): string {
    if (topicScore >= 0.9) return 'Shares the same research topic';
    if (topicScore >= 0.7) return 'Shares the same research subfield';
    if (topicScore >= 0.5) return 'Shares the same research field';
    if (topicScore >= 0.3) return 'Shares the same research domain';
    if (conceptScore > 0) return 'Shares overlapping research concepts';
    return 'Related research area';
  }

  /**
   * Maps a signal type string to a RecommendationReasonType.
   */
  private mapSignalTypeToReasonType(
    signalType: string
  ): 'field-match' | 'citation-overlap' | 'semantic-similarity' | 'concept-match' | 'collaborator' {
    switch (signalType) {
      case 'fields':
        return 'field-match';
      case 'citations':
        return 'citation-overlap';
      case 'concepts':
        return 'concept-match';
      case 'collaborators':
        return 'collaborator';
      default:
        return 'semantic-similarity';
    }
  }

  /**
   * Gets the Semantic Scholar plugin if available.
   */
  private getSemanticScholarPlugin(): SemanticScholarPlugin | undefined {
    if (!this.pluginManager) return undefined;

    const plugin = this.pluginManager.getPlugin('pub.chive.plugin.semantic-scholar');
    return plugin as SemanticScholarPlugin | undefined;
  }

  /**
   * Gets the OpenAlex plugin if available.
   */
  private getOpenAlexPlugin(): OpenAlexPlugin | undefined {
    if (!this.pluginManager) return undefined;

    const plugin = this.pluginManager.getPlugin('pub.chive.plugin.openalex');
    return plugin as OpenAlexPlugin | undefined;
  }

  /**
   * Gets an eprint by URI from the database.
   */
  private async getEprintByUri(uri: AtUri): Promise<EprintRow | null> {
    const result = await this.db.query<EprintRow>(
      `SELECT uri, title, keywords, authors,
              external_ids->>'doi' AS doi,
              external_ids->>'arxivId' AS arxiv_id,
              created_at AS publication_date,
              external_ids->>'semanticScholarId' AS semantic_scholar_id,
              external_ids->>'openAlexId' AS openalex_id
       FROM eprints_index WHERE uri = $1`,
      [uri]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Finds an eprint by external ID (S2 or DOI).
   */
  private async findEprintByExternalId(s2Id?: string, doi?: string): Promise<EprintRow | null> {
    if (s2Id) {
      const result = await this.db.query<EprintRow>(
        `SELECT uri, title, keywords,
                external_ids->>'doi' AS doi,
                external_ids->>'arxivId' AS arxiv_id,
                created_at AS publication_date,
                external_ids->>'semanticScholarId' AS semantic_scholar_id,
                external_ids->>'openAlexId' AS openalex_id
         FROM eprints_index WHERE external_ids->>'semanticScholarId' = $1`,
        [s2Id]
      );

      if (result.rows[0]) return result.rows[0];
    }

    if (doi) {
      const result = await this.db.query<EprintRow>(
        `SELECT uri, title, keywords,
                external_ids->>'doi' AS doi,
                external_ids->>'arxivId' AS arxiv_id,
                created_at AS publication_date,
                external_ids->>'semanticScholarId' AS semantic_scholar_id,
                external_ids->>'openAlexId' AS openalex_id
         FROM eprints_index WHERE external_ids->>'doi' = $1`,
        [doi]
      );

      if (result.rows[0]) return result.rows[0];
    }

    return null;
  }

  /**
   * Updates eprint with enrichment data.
   */
  private async updateEprintEnrichment(
    uri: AtUri,
    data: {
      semanticScholarId?: string;
      openAlexId?: string;
      citationCount?: number;
      influentialCitationCount?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.semanticScholarId) {
      updates.push(`semantic_scholar_id = $${paramIndex++}`);
      values.push(data.semanticScholarId);
    }

    if (data.openAlexId) {
      updates.push(`openalex_id = $${paramIndex++}`);
      values.push(data.openAlexId);
    }

    if (data.citationCount !== undefined) {
      updates.push(`citation_count = $${paramIndex++}`);
      values.push(data.citationCount);
    }

    if (data.influentialCitationCount !== undefined) {
      updates.push(`influential_citation_count = $${paramIndex++}`);
      values.push(data.influentialCitationCount);
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    values.push(uri);

    await this.db.query(
      `UPDATE eprints SET ${updates.join(', ')} WHERE uri = $${paramIndex}`,
      values
    );
  }

  /**
   * Filters S2 citations to only include Chive-to-Chive relationships.
   */
  private async filterToChiveCitations(
    citingUri: AtUri,
    s2Citations: readonly { paperId: string; externalIds?: { DOI?: string } }[]
  ): Promise<CitationRelationship[]> {
    const chiveCitations: CitationRelationship[] = [];

    for (const citation of s2Citations) {
      const chiveEprint = await this.findEprintByExternalId(
        citation.paperId,
        citation.externalIds?.DOI
      );

      if (chiveEprint) {
        chiveCitations.push({
          citingUri,
          citedUri: chiveEprint.uri as AtUri,
          source: 'semantic-scholar',
        });
      }
    }

    return chiveCitations;
  }

  /**
   * Gets user's claimed papers.
   */
  private async getUserClaimedPapers(userDid: DID): Promise<Set<string>> {
    const result = await this.db.query<{ uri: string }>(
      `SELECT i.canonical_uri as uri
       FROM imported_eprints i
       JOIN claim_requests c ON c.import_id = i.id
       WHERE c.claimant_did = $1 AND c.status = 'approved' AND i.canonical_uri IS NOT NULL`,
      [userDid]
    );

    return new Set(result.rows.map((r) => r.uri));
  }

  /**
   * Gets dismissed recommendation URIs for a user.
   * Returns empty set if user_interactions table doesn't exist yet.
   */
  private async getDismissedRecommendations(userDid: DID): Promise<Set<string>> {
    try {
      const result = await this.db.query<InteractionRow>(
        `SELECT eprint_uri FROM user_interactions
         WHERE user_did = $1 AND interaction_type = 'dismiss'`,
        [userDid]
      );

      return new Set(result.rows.map((r) => r.eprint_uri));
    } catch {
      // Table may not exist yet
      return new Set();
    }
  }

  /**
   * Gets Semantic Scholar paper IDs for a list of Chive eprints.
   */
  private async getSemanticScholarIdsForEprints(uris: AtUri[]): Promise<string[]> {
    if (uris.length === 0) return [];

    const result = await this.db.query<{ semantic_scholar_id: string }>(
      `SELECT semantic_scholar_id FROM eprints
       WHERE uri = ANY($1) AND semantic_scholar_id IS NOT NULL`,
      [uris]
    );

    return result.rows.map((r) => r.semantic_scholar_id);
  }
}
