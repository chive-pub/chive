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
   */
  constructor(
    private readonly logger: ILogger,
    private readonly db: IDatabasePool,
    private readonly searchEngine: ISearchEngine,
    private readonly ranking: IRankingService,
    private readonly citationGraph: ICitationGraph
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
   * Combines citation graph, concept overlap, and semantic similarity
   * to find related eprints. All results are from Chive's index.
   */
  async findRelatedEprints(
    eprintUri: AtUri,
    options?: RelatedEprintOptions
  ): Promise<readonly RelatedEprint[]> {
    const limit = options?.limit ?? 10;
    const minScore = options?.minScore ?? 0.3;
    const signals = options?.signals ?? ['citations', 'concepts', 'semantic'];

    const relatedMap = new Map<string, RelatedEprint>();

    // Get eprint data
    const eprint = await this.getEprintByUri(eprintUri);
    if (!eprint) {
      return [];
    }

    // Signal 1: Citation-based (co-citation)
    if (signals.includes('citations')) {
      const coCited = await this.citationGraph.findCoCitedPapers(eprintUri, 2);

      for (const paper of coCited) {
        if (paper.strength >= minScore) {
          relatedMap.set(paper.uri, {
            uri: paper.uri,
            title: paper.title,
            abstract: paper.abstract,
            categories: paper.categories,
            publicationDate: paper.publicationDate,
            score: paper.strength,
            relationshipType: 'co-cited',
            explanation: `Frequently cited together (${paper.coCitationCount} co-citations)`,
            signalScores: { citations: paper.strength },
          });
        }
      }
    }

    // Signal 2: Direct citations
    if (signals.includes('citations')) {
      const [citingResult, referencesResult] = await Promise.all([
        this.citationGraph.getCitingPapers(eprintUri, { limit: 5 }),
        this.citationGraph.getReferences(eprintUri, { limit: 5 }),
      ]);

      for (const citation of citingResult.citations) {
        const citingEprint = await this.getEprintByUri(citation.citingUri);
        if (citingEprint && !relatedMap.has(citation.citingUri)) {
          relatedMap.set(citation.citingUri, {
            uri: citation.citingUri,
            title: citingEprint.title,
            abstract: citingEprint.abstract ?? undefined,
            categories: citingEprint.categories ?? undefined,
            publicationDate: citingEprint.publication_date ?? undefined,
            score: citation.isInfluential ? 0.9 : 0.7,
            relationshipType: 'cited-by',
            explanation: 'Cites this paper',
            signalScores: { citations: citation.isInfluential ? 0.9 : 0.7 },
          });
        }
      }

      for (const reference of referencesResult.citations) {
        const refEprint = await this.getEprintByUri(reference.citedUri);
        if (refEprint && !relatedMap.has(reference.citedUri)) {
          relatedMap.set(reference.citedUri, {
            uri: reference.citedUri,
            title: refEprint.title,
            abstract: refEprint.abstract ?? undefined,
            categories: refEprint.categories ?? undefined,
            publicationDate: refEprint.publication_date ?? undefined,
            score: reference.isInfluential ? 0.9 : 0.7,
            relationshipType: 'cites',
            explanation: 'Referenced by this paper',
            signalScores: { citations: reference.isInfluential ? 0.9 : 0.7 },
          });
        }
      }
    }

    // Signal 3: Semantic similarity (via S2 recommendations if available)
    if (signals.includes('semantic') && eprint.semantic_scholar_id) {
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
            if (chiveEprint && !relatedMap.has(chiveEprint.uri)) {
              relatedMap.set(chiveEprint.uri, {
                uri: chiveEprint.uri as AtUri,
                title: chiveEprint.title,
                abstract: chiveEprint.abstract ?? undefined,
                categories: chiveEprint.categories ?? undefined,
                publicationDate: chiveEprint.publication_date ?? undefined,
                score: 0.7, // SPECTER2 similarity
                relationshipType: 'semantically-similar',
                explanation: 'Semantically similar based on content',
                signalScores: { semantic: 0.7 },
              });
            }
          }
        } catch (error) {
          this.logger.debug('S2 recommendations unavailable', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Sort by score and limit
    const related = Array.from(relatedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return related;
  }

  /**
   * Gets personalized recommendations for a user.
   *
   * @param userDid - User's DID
   * @param options - Recommendation options
   * @returns Paginated recommendations with explanations
   *
   * @remarks
   * Uses user's research fields, claimed papers, and citation network
   * to generate personalized recommendations.
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
          if (!dismissedUris.has(citation.citingUri) && !claimedPapers.has(citation.citingUri)) {
            const eprint = await this.getEprintByUri(citation.citingUri);
            if (eprint && !candidateMap.has(citation.citingUri)) {
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
              if (
                chiveEprint &&
                !dismissedUris.has(chiveEprint.uri) &&
                !claimedPapers.has(chiveEprint.uri) &&
                !candidateMap.has(chiveEprint.uri)
              ) {
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
            type:
              item.signalType === 'fields'
                ? 'field-match'
                : item.signalType === 'citations'
                  ? 'citation-overlap'
                  : 'semantic-similarity',
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
      `SELECT uri, title, abstract, categories, doi, arxiv_id, publication_date,
              semantic_scholar_id, openalex_id
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
        `SELECT uri, title, abstract, categories, doi, arxiv_id, publication_date,
                semantic_scholar_id, openalex_id
         FROM eprints_index WHERE semantic_scholar_id = $1`,
        [s2Id]
      );

      if (result.rows[0]) return result.rows[0];
    }

    if (doi) {
      const result = await this.db.query<EprintRow>(
        `SELECT uri, title, abstract, categories, doi, arxiv_id, publication_date,
                semantic_scholar_id, openalex_id
         FROM eprints_index WHERE doi = $1`,
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
