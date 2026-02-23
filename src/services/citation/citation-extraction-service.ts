/**
 * Citation extraction service for eprints.
 *
 * @remarks
 * Orchestrates citation extraction from multiple sources:
 * 1. GROBID (primary): Extracts references from PDF documents
 * 2. Semantic Scholar (enrichment): Fetches reference lists by DOI/S2 ID
 * 3. Crossref (enrichment): Resolves DOIs for metadata completion
 *
 * Extracted citations are stored in PostgreSQL and matched against
 * Chive-indexed eprints. Matched citations create CITES edges in the
 * Neo4j citation graph.
 *
 * ATProto Compliance:
 * - PDF blobs are fetched from user PDSes via IRepository, never stored
 * - All extracted data is derived and rebuildable
 * - Citation graph is an index, not source of truth
 * - Never writes to user PDSes
 *
 * @packageDocumentation
 * @public
 */

import type { CrossrefClient } from '@jamesgopsill/crossref-client';

import { citationMetrics } from '../../observability/prometheus-registry.js';
import { withSpan, addSpanAttributes } from '../../observability/tracer.js';
import type { SemanticScholarPlugin } from '../../plugins/builtin/semantic-scholar.js';
import type { AtUri, CID, DID } from '../../types/atproto.js';
import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type {
  CitationRelationship,
  ICitationGraph,
} from '../../types/interfaces/discovery.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IPluginManager } from '../../types/interfaces/plugin.interface.js';
import type { IRepository } from '../../types/interfaces/repository.interface.js';

import type { DocumentTextExtractor } from './document-text-extractor.js';
import type { GrobidClient, GrobidReference } from './grobid-client.js';

/**
 * Options for citation extraction.
 *
 * @public
 */
export interface ExtractionOptions {
  /**
   * Whether to use GROBID for PDF-based extraction.
   *
   * @defaultValue true
   */
  readonly useGrobid?: boolean;

  /**
   * Whether to use Semantic Scholar for API-based enrichment.
   *
   * @defaultValue true
   */
  readonly useSemanticScholar?: boolean;

  /**
   * Whether to use Crossref for DOI resolution.
   *
   * @defaultValue true
   */
  readonly useCrossref?: boolean;

  /**
   * Document format (e.g., 'pdf', 'latex', 'docx'). GROBID only supports PDF.
   */
  readonly documentFormat?: string;

  /**
   * DID of the eprint author (for PDS blob fetching).
   */
  readonly authorDid?: DID;

  /**
   * CID of the PDF blob in the author's PDS.
   */
  readonly documentCid?: CID;

  /**
   * DOI of the eprint (for API-based lookups).
   */
  readonly doi?: string;

  /**
   * Semantic Scholar paper ID (for API-based lookups).
   */
  readonly semanticScholarId?: string;
}

/**
 * Result of a citation extraction run.
 *
 * @public
 */
export interface ExtractionResult {
  /**
   * AT-URI of the eprint.
   */
  readonly eprintUri: AtUri;

  /**
   * Total citations extracted across all sources.
   */
  readonly totalExtracted: number;

  /**
   * Citations extracted by GROBID.
   */
  readonly grobidCount: number;

  /**
   * Citations enriched by Semantic Scholar.
   */
  readonly semanticScholarCount: number;

  /**
   * Citations enriched by Crossref.
   */
  readonly crossrefCount: number;

  /**
   * Citations matched to Chive-indexed eprints.
   */
  readonly matchedToChive: number;

  /**
   * Whether extraction succeeded (at least partially).
   */
  readonly success: boolean;

  /**
   * Error message if extraction failed entirely.
   */
  readonly error?: string;

  /**
   * Duration of extraction in milliseconds.
   */
  readonly durationMs: number;
}

/**
 * Citation extracted from any source, stored in PostgreSQL.
 *
 * @public
 */
export interface ExtractedCitation {
  /**
   * AT-URI of the citing eprint.
   */
  readonly eprintUri: AtUri;

  /**
   * Raw citation text (from GROBID or API).
   */
  readonly rawText: string;

  /**
   * Parsed title.
   */
  readonly title?: string;

  /**
   * Parsed authors.
   */
  readonly authors?: readonly { readonly firstName?: string; readonly lastName: string }[];

  /**
   * DOI of the cited work.
   */
  readonly doi?: string;

  /**
   * Publication year.
   */
  readonly year?: number;

  /**
   * Publication venue or journal name.
   */
  readonly venue?: string;

  /**
   * Volume number.
   */
  readonly volume?: string;

  /**
   * Page range.
   */
  readonly pages?: string;

  /**
   * Source of this citation data.
   */
  readonly source: 'grobid' | 'semantic-scholar' | 'crossref';

  /**
   * Chive eprint URI if matched.
   */
  readonly chiveMatchUri?: AtUri;
}

/**
 * Citation with match information.
 *
 * @public
 */
export interface MatchedCitation extends ExtractedCitation {
  /**
   * Confidence of the match (0-1).
   */
  readonly matchConfidence: number;

  /**
   * Method used for matching.
   */
  readonly matchMethod: 'doi' | 'title';
}

/**
 * Options for querying extracted citations.
 *
 * @public
 */
export interface CitationQueryOptions {
  /**
   * Maximum results to return.
   *
   * @defaultValue 100
   */
  readonly limit?: number;

  /**
   * Offset for pagination.
   */
  readonly offset?: number;

  /**
   * Filter to only matched citations.
   */
  readonly matchedOnly?: boolean;
}

/**
 * Interface for the citation extraction service.
 *
 * @public
 */
export interface ICitationExtractionService {
  /**
   * Extracts citations from an eprint using all available sources.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param options - Extraction options
   * @returns Extraction result summary
   */
  extractCitations(eprintUri: AtUri, options: ExtractionOptions): Promise<ExtractionResult>;

  /**
   * Gets previously extracted citations for an eprint.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param options - Query options
   * @returns Stored citations
   */
  getExtractedCitations(
    eprintUri: AtUri,
    options?: CitationQueryOptions
  ): Promise<ExtractedCitation[]>;

  /**
   * Matches extracted citations against Chive-indexed eprints.
   *
   * @param citations - Citations to match
   * @returns Citations with match information
   */
  matchCitationsToChive(
    citations: readonly ExtractedCitation[]
  ): Promise<readonly MatchedCitation[]>;
}

/**
 * Database row for extracted citations.
 */
interface ExtractedCitationRow {
  readonly id: number;
  readonly eprint_uri: string;
  readonly raw_text: string;
  readonly title: string | null;
  readonly authors: string | null;
  readonly doi: string | null;
  readonly year: number | null;
  readonly venue: string | null;
  readonly volume: string | null;
  readonly pages: string | null;
  readonly source: string;
  readonly chive_match_uri: string | null;
  readonly match_confidence: number | null;
  readonly match_method: string | null;
  readonly created_at: Date;
}

/**
 * Database row for eprint lookups.
 */
interface EprintLookupRow {
  readonly uri: string;
  readonly title: string;
  readonly doi: string | null;
}

/**
 * Citation extraction service configuration.
 *
 * @public
 */
export interface CitationExtractionServiceConfig {
  /**
   * GROBID client for PDF reference extraction.
   */
  readonly grobidClient: GrobidClient;

  /**
   * Repository for fetching blobs from user PDSes.
   */
  readonly repository: IRepository;

  /**
   * Database pool for storing extracted citations.
   */
  readonly db: IDatabasePool;

  /**
   * Citation graph for creating CITES edges.
   */
  readonly citationGraph: ICitationGraph;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Optional Crossref client for DOI resolution.
   */
  readonly crossrefClient?: CrossrefClient;

  /**
   * Optional extractor for non-PDF document formats.
   *
   * @remarks
   * When provided, enables citation extraction from LaTeX, DOCX, HTML,
   * and other non-PDF formats by extracting raw citation strings and
   * feeding them to GROBID's processCitation endpoint.
   */
  readonly documentTextExtractor?: DocumentTextExtractor;
}

/**
 * Citation extraction service.
 *
 * @remarks
 * Combines GROBID PDF extraction, Semantic Scholar API enrichment,
 * and Crossref DOI resolution to build a citation index for eprints.
 *
 * Follows the ClaimingService/DiscoveryService pattern:
 * - Core functionality works with just GROBID and the database
 * - External API access is optional via plugin manager
 * - Graceful degradation when any source is unavailable
 *
 * @example
 * ```typescript
 * const service = new CitationExtractionService({
 *   grobidClient,
 *   repository,
 *   db: pgPool,
 *   citationGraph,
 *   logger,
 * });
 *
 * const result = await service.extractCitations(eprintUri, {
 *   authorDid: 'did:plc:abc',
 *   documentCid: 'bafyreib...',
 *   doi: '10.1234/example',
 * });
 *
 * console.log(`Extracted ${result.totalExtracted} citations, ${result.matchedToChive} matched`);
 * ```
 *
 * @public
 */
export class CitationExtractionService implements ICitationExtractionService {
  private readonly grobidClient: GrobidClient;
  private readonly repository: IRepository;
  private readonly db: IDatabasePool;
  private readonly citationGraph: ICitationGraph;
  private readonly logger: ILogger;
  private readonly crossrefClient?: CrossrefClient;
  private readonly documentTextExtractor?: DocumentTextExtractor;
  private pluginManager?: IPluginManager;

  constructor(config: CitationExtractionServiceConfig) {
    this.grobidClient = config.grobidClient;
    this.repository = config.repository;
    this.db = config.db;
    this.citationGraph = config.citationGraph;
    this.logger = config.logger.child({ service: 'citation-extraction' });
    this.crossrefClient = config.crossrefClient;
    this.documentTextExtractor = config.documentTextExtractor;
  }

  /**
   * Sets the plugin manager for external API access.
   *
   * @param manager - Plugin manager instance
   *
   * @remarks
   * Enables Semantic Scholar enrichment when a plugin manager
   * is available. The service works without plugins using only
   * GROBID and Crossref.
   */
  setPluginManager(manager: IPluginManager): void {
    this.pluginManager = manager;
    this.logger.info('Plugin manager configured for citation extraction');
  }

  /**
   * Extracts citations from an eprint using all available sources.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param options - Extraction configuration
   * @returns Summary of extraction results
   *
   * @remarks
   * Extraction proceeds in order:
   * 1. GROBID (if PDF blob CID provided and GROBID available)
   * 2. Semantic Scholar (if DOI or S2 ID provided and plugin available)
   * 3. Crossref DOI resolution for references with DOIs
   * 4. Match all extracted citations against Chive index
   * 5. Store results in PostgreSQL
   * 6. Create CITES edges in Neo4j for Chive-to-Chive matches
   *
   * If a source fails, extraction continues with remaining sources.
   */
  async extractCitations(eprintUri: AtUri, options: ExtractionOptions): Promise<ExtractionResult> {
    return withSpan(
      'citationExtraction.extract',
      async () => {
        const startTime = Date.now();

        addSpanAttributes({
          'citation.eprint_uri': eprintUri,
          'citation.use_grobid': options.useGrobid !== false,
          'citation.use_s2': options.useSemanticScholar !== false,
          'citation.use_crossref': options.useCrossref !== false,
        });

        const allCitations: ExtractedCitation[] = [];
        let grobidCount = 0;
        let s2Count = 0;
        let crossrefCount = 0;

        // 1. Citation extraction from document
        if (options.useGrobid !== false && options.authorDid && options.documentCid) {
          const format = options.documentFormat ?? 'pdf';
          const grobidTimer = citationMetrics.extractionDuration.startTimer({ source: 'grobid' });

          try {
            if (format === 'pdf') {
              // PDF path: send full PDF to GROBID processReferences
              const grobidRefs = await this.extractWithGrobid(
                eprintUri,
                options.authorDid,
                options.documentCid
              );
              grobidCount = grobidRefs.length;
              allCitations.push(...grobidRefs);
            } else if (this.documentTextExtractor) {
              // Non-PDF path: extract text, then parse citation strings via GROBID
              const blobStream = await this.repository.getBlob(
                options.authorDid,
                options.documentCid
              );
              const reader = blobStream.getReader();
              const chunks: Uint8Array[] = [];
              let done = false;
              while (!done) {
                const result = await reader.read();
                done = result.done;
                if (result.value) {
                  chunks.push(result.value);
                }
              }
              const documentBuffer = Buffer.concat(chunks);

              const citationStrings = await this.documentTextExtractor.extractReferencesText(
                documentBuffer,
                format
              );

              if (citationStrings.length > 0) {
                const grobidRefs = await this.grobidClient.parseCitationStrings(citationStrings);
                const converted = grobidRefs.map((ref) =>
                  this.grobidRefToExtractedCitation(eprintUri, ref)
                );
                grobidCount = converted.length;
                allCitations.push(...converted);
              }

              this.logger.info('Non-PDF citation extraction completed', {
                eprintUri,
                format,
                citationStringsFound: citationStrings.length,
                referencesParsed: grobidCount,
              });
            }

            grobidTimer({ status: 'success' });
            citationMetrics.extractionsTotal.inc({ source: 'grobid', status: 'success' });
            citationMetrics.citationsExtracted.inc({ source: 'grobid' }, grobidCount);
          } catch (error) {
            grobidTimer({ status: 'error' });
            citationMetrics.extractionsTotal.inc({ source: 'grobid', status: 'error' });

            this.logger.warn('Citation extraction failed (graceful degradation)', {
              eprintUri,
              format: options.documentFormat,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // 2. Semantic Scholar enrichment
        if (options.useSemanticScholar !== false && (options.doi || options.semanticScholarId)) {
          const s2Timer = citationMetrics.extractionDuration.startTimer({
            source: 'semantic-scholar',
          });
          try {
            const s2Refs = await this.enrichWithSemanticScholar(
              eprintUri,
              options.doi,
              options.semanticScholarId
            );
            s2Count = s2Refs.length;

            // Merge S2 refs, deduplicating by DOI
            const existingDois = new Set(
              allCitations
                .filter((c): c is ExtractedCitation & { doi: string } => !!c.doi)
                .map((c) => c.doi.toLowerCase())
            );

            for (const ref of s2Refs) {
              if (ref.doi && existingDois.has(ref.doi.toLowerCase())) {
                // Enrich existing citation with S2 data (prefer S2 metadata for title)
                continue;
              }
              allCitations.push(ref);
            }

            s2Timer({ status: 'success' });
            citationMetrics.extractionsTotal.inc({
              source: 'semantic-scholar',
              status: 'success',
            });
            citationMetrics.citationsExtracted.inc({ source: 'semantic-scholar' }, s2Count);

            this.logger.info('Semantic Scholar enrichment completed', {
              eprintUri,
              referenceCount: s2Count,
            });
          } catch (error) {
            s2Timer({ status: 'error' });
            citationMetrics.extractionsTotal.inc({ source: 'semantic-scholar', status: 'error' });

            this.logger.warn('Semantic Scholar enrichment failed (graceful degradation)', {
              eprintUri,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // 3. Crossref DOI resolution for citations with DOIs
        if (options.useCrossref !== false && this.crossrefClient) {
          const crossrefTimer = citationMetrics.extractionDuration.startTimer({
            source: 'crossref',
          });
          try {
            const enriched = await this.enrichWithCrossref(allCitations);
            crossrefCount = enriched;

            crossrefTimer({ status: 'success' });
            citationMetrics.extractionsTotal.inc({ source: 'crossref', status: 'success' });
            citationMetrics.citationsExtracted.inc({ source: 'crossref' }, crossrefCount);

            this.logger.debug('Crossref enrichment completed', {
              eprintUri,
              enrichedCount: crossrefCount,
            });
          } catch (error) {
            crossrefTimer({ status: 'error' });
            citationMetrics.extractionsTotal.inc({ source: 'crossref', status: 'error' });

            this.logger.warn('Crossref enrichment failed (graceful degradation)', {
              eprintUri,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // 4. Match citations to Chive-indexed eprints
        const matched = await this.matchCitationsToChive(allCitations);
        const matchedToChive = matched.filter((m) => m.chiveMatchUri).length;

        // Record matching metrics
        for (const m of matched) {
          if (m.chiveMatchUri && m.matchConfidence > 0) {
            citationMetrics.citationsMatched.inc({ match_method: m.matchMethod });
          }
        }

        // 5. Store all citations in PostgreSQL
        await this.storeCitations(eprintUri, matched);

        // 6. Create CITES edges in Neo4j for matched citations
        const citationRelationships: CitationRelationship[] = matched
          .filter((m): m is MatchedCitation & { chiveMatchUri: AtUri } => !!m.chiveMatchUri)
          .map((m) => ({
            citingUri: eprintUri,
            citedUri: m.chiveMatchUri,
            source: m.source as CitationRelationship['source'],
          }));

        if (citationRelationships.length > 0) {
          await this.citationGraph.upsertCitationsBatch(citationRelationships);

          this.logger.info('Citation graph edges created', {
            eprintUri,
            edgeCount: citationRelationships.length,
          });
        }

        const durationMs = Date.now() - startTime;

        addSpanAttributes({
          'citation.total_extracted': allCitations.length,
          'citation.grobid_count': grobidCount,
          'citation.s2_count': s2Count,
          'citation.crossref_count': crossrefCount,
          'citation.matched_to_chive': matchedToChive,
          'citation.duration_ms': durationMs,
        });

        this.logger.info('Citation extraction completed', {
          eprintUri,
          totalExtracted: allCitations.length,
          grobidCount,
          s2Count,
          crossrefCount,
          matchedToChive,
          durationMs,
        });

        return {
          eprintUri,
          totalExtracted: allCitations.length,
          grobidCount,
          semanticScholarCount: s2Count,
          crossrefCount,
          matchedToChive,
          success: true,
          durationMs,
        };
      },
      {
        attributes: {
          'chive.operation': 'citation_extraction',
          'chive.eprint.uri': eprintUri,
        },
      }
    );
  }

  /**
   * Gets previously extracted citations for an eprint.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param options - Query options
   * @returns Stored citations
   */
  async getExtractedCitations(
    eprintUri: AtUri,
    options?: CitationQueryOptions
  ): Promise<ExtractedCitation[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    let query = `
      SELECT id, eprint_uri, raw_text, title, authors, doi, year,
             venue, volume, pages, source, chive_match_uri,
             match_confidence, match_method, created_at
      FROM extracted_citations
      WHERE eprint_uri = $1
    `;

    const params: unknown[] = [eprintUri];

    if (options?.matchedOnly) {
      query += ` AND chive_match_uri IS NOT NULL`;
    }

    query += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query<ExtractedCitationRow>(query, params);
    return result.rows.map((row) => this.rowToExtractedCitation(row));
  }

  /**
   * Matches extracted citations against Chive-indexed eprints.
   *
   * @param citations - Citations to match
   * @returns Citations with match information
   *
   * @remarks
   * Matching strategy:
   * 1. DOI exact match (confidence: 1.0)
   * 2. Title similarity match (confidence: 0.8 for normalized exact match)
   */
  async matchCitationsToChive(
    citations: readonly ExtractedCitation[]
  ): Promise<readonly MatchedCitation[]> {
    return withSpan('citationExtraction.matchToChive', async () => {
      const results: MatchedCitation[] = [];

      for (const citation of citations) {
        let matchUri: AtUri | undefined;
        let matchConfidence = 0;
        let matchMethod: 'doi' | 'title' = 'doi';

        // 1. Try DOI exact match
        if (citation.doi) {
          const doiMatch = await this.findEprintByDoi(citation.doi);
          if (doiMatch) {
            matchUri = doiMatch as AtUri;
            matchConfidence = 1.0;
            matchMethod = 'doi';
          }
        }

        // 2. Try title similarity match
        if (!matchUri && citation.title) {
          const titleMatch = await this.findEprintByTitle(citation.title);
          if (titleMatch) {
            matchUri = titleMatch as AtUri;
            matchConfidence = 0.8;
            matchMethod = 'title';
          }
        }

        results.push({
          ...citation,
          chiveMatchUri: matchUri,
          matchConfidence,
          matchMethod,
        });
      }

      return results;
    });
  }

  // =============================================================================
  // PRIVATE: GROBID EXTRACTION
  // =============================================================================

  /**
   * Extracts references from a PDF using GROBID.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param authorDid - DID of the eprint author (for PDS access)
   * @param documentCid - CID of the PDF blob
   * @returns Extracted citations from GROBID
   */
  private async extractWithGrobid(
    eprintUri: AtUri,
    authorDid: DID,
    documentCid: CID
  ): Promise<ExtractedCitation[]> {
    return withSpan('citationExtraction.grobid', async () => {
      // Check GROBID availability
      const available = await this.grobidClient.isAvailable();
      if (!available) {
        this.logger.debug('GROBID unavailable, skipping PDF extraction', { eprintUri });
        return [];
      }

      // Fetch PDF from user's PDS
      const pdfStream = await this.repository.getBlob(authorDid, documentCid);

      // Convert ReadableStream to Buffer
      const reader = pdfStream.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          chunks.push(result.value);
        }
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Extract references via GROBID
      const grobidRefs = await this.grobidClient.extractReferences(pdfBuffer);

      // Convert to ExtractedCitation format
      return grobidRefs.map((ref) => this.grobidRefToExtractedCitation(eprintUri, ref));
    });
  }

  /**
   * Converts a GROBID reference to the common ExtractedCitation format.
   *
   * @param eprintUri - AT-URI of the citing eprint
   * @param ref - GROBID reference to convert
   * @returns Extracted citation with source set to 'grobid'
   */
  private grobidRefToExtractedCitation(eprintUri: AtUri, ref: GrobidReference): ExtractedCitation {
    return {
      eprintUri,
      rawText: ref.rawText,
      title: ref.title,
      authors: ref.authors,
      doi: ref.doi,
      year: ref.year,
      venue: ref.journal,
      volume: ref.volume,
      pages: ref.pages,
      source: 'grobid',
    };
  }

  // =============================================================================
  // PRIVATE: SEMANTIC SCHOLAR ENRICHMENT
  // =============================================================================

  /**
   * Fetches reference list from Semantic Scholar.
   *
   * @param eprintUri - AT-URI of the eprint
   * @param doi - DOI for lookup
   * @param s2Id - Semantic Scholar paper ID for lookup
   * @returns Citations from S2 reference list
   */
  private async enrichWithSemanticScholar(
    eprintUri: AtUri,
    doi?: string,
    s2Id?: string
  ): Promise<ExtractedCitation[]> {
    return withSpan('citationExtraction.semanticScholar', async () => {
      const s2Plugin = this.getSemanticScholarPlugin();
      if (!s2Plugin) {
        return [];
      }

      // Find the paper in S2
      let paperId = s2Id;
      if (!paperId && doi) {
        const paper = await s2Plugin.getPaperByDoi(doi);
        paperId = paper?.paperId;
      }

      if (!paperId) {
        return [];
      }

      // Fetch references
      const { references } = await s2Plugin.getReferences(paperId, { limit: 500 });

      return references.map(
        (ref): ExtractedCitation => ({
          eprintUri,
          rawText: ref.paper.title,
          title: ref.paper.title,
          doi: ref.paper.externalIds?.DOI,
          year: ref.paper.year,
          venue: ref.paper.venue,
          source: 'semantic-scholar',
        })
      );
    });
  }

  // =============================================================================
  // PRIVATE: CROSSREF ENRICHMENT
  // =============================================================================

  /**
   * Enriches citations that have DOIs with Crossref metadata.
   *
   * @param citations - Mutable array of citations to enrich in place
   * @returns Number of citations enriched
   *
   * @remarks
   * Only processes citations that have a DOI but are missing metadata
   * (title, year, or venue). Rate-limited to avoid Crossref overload.
   */
  private async enrichWithCrossref(citations: ExtractedCitation[]): Promise<number> {
    if (!this.crossrefClient) return 0;

    let enrichedCount = 0;

    for (const citation of citations) {
      if (!citation.doi) continue;
      if (citation.title && citation.year && citation.venue) continue;

      try {
        const response = await this.crossrefClient.work(citation.doi);
        if (response.ok && response.content) {
          const work = response.content.message;
          // Update citation with Crossref data (cast to mutable for in-place update)
          const mutable = citation as {
            title?: string;
            year?: number;
            venue?: string;
            source: string;
          };
          if (!mutable.title && work.title?.[0]) {
            mutable.title = work.title[0];
          }
          if (!mutable.year && work.published?.dateParts?.[0]?.[0]) {
            mutable.year = work.published.dateParts[0][0];
          }
          if (!mutable.venue && work.containerTitle?.[0]) {
            mutable.venue = work.containerTitle[0];
          }
          enrichedCount++;
        }
      } catch (error) {
        this.logger.debug('Crossref enrichment failed for DOI', {
          doi: citation.doi,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return enrichedCount;
  }

  // =============================================================================
  // PRIVATE: MATCHING AND STORAGE
  // =============================================================================

  /**
   * Finds a Chive eprint by DOI.
   *
   * @param doi - DOI to search for
   * @returns AT-URI of the matching eprint, or null
   */
  private async findEprintByDoi(doi: string): Promise<string | null> {
    const normalizedDoi = doi.trim().toLowerCase();

    const result = await this.db.query<EprintLookupRow>(
      `SELECT uri FROM eprints_index WHERE LOWER(published_version->>'doi') = $1 LIMIT 1`,
      [normalizedDoi]
    );

    return result.rows[0]?.uri ?? null;
  }

  /**
   * Finds a Chive eprint by normalized title comparison.
   *
   * @param title - Title to search for
   * @returns AT-URI of the matching eprint, or null
   *
   * @remarks
   * Normalizes both input and stored titles by lowercasing, removing
   * punctuation, and collapsing whitespace. Only returns a match for
   * exact normalized equality.
   */
  private async findEprintByTitle(title: string): Promise<string | null> {
    const normalized = this.normalizeTitle(title);
    if (normalized.length < 10) return null;

    const result = await this.db.query<EprintLookupRow>(
      `SELECT uri, title FROM eprints_index
       WHERE LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9\\s]', '', 'g')) = $1
       LIMIT 1`,
      [normalized]
    );

    return result.rows[0]?.uri ?? null;
  }

  /**
   * Normalizes a title for comparison.
   *
   * @param title - Title string
   * @returns Normalized lowercase title with punctuation removed
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Stores extracted citations in PostgreSQL.
   *
   * @param eprintUri - AT-URI of the citing eprint
   * @param citations - Citations to store
   */
  private async storeCitations(
    eprintUri: AtUri,
    citations: readonly MatchedCitation[]
  ): Promise<void> {
    if (citations.length === 0) return;

    return withSpan('citationExtraction.store', async () => {
      // Delete existing citations for this eprint before inserting new ones
      await this.db.query(`DELETE FROM extracted_citations WHERE eprint_uri = $1`, [eprintUri]);

      // Batch insert
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const citation of citations) {
        const authorsJson = citation.authors ? JSON.stringify(citation.authors) : null;

        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`
        );

        values.push(
          eprintUri,
          citation.rawText,
          citation.title ?? null,
          authorsJson,
          citation.doi ?? null,
          citation.year ?? null,
          citation.venue ?? null,
          citation.volume ?? null,
          citation.pages ?? null,
          citation.source,
          citation.chiveMatchUri ?? null,
          citation.matchConfidence > 0 ? citation.matchConfidence : null,
          citation.matchConfidence > 0 ? citation.matchMethod : null
        );

        paramIndex += 13;
      }

      const query = `
        INSERT INTO extracted_citations (
          eprint_uri, raw_text, title, authors, doi, year,
          venue, volume, pages, source, chive_match_uri,
          match_confidence, match_method
        ) VALUES ${placeholders.join(', ')}
      `;

      await this.db.query(query, values);

      this.logger.debug('Stored extracted citations', {
        eprintUri,
        count: citations.length,
      });
    });
  }

  /**
   * Converts a database row to an ExtractedCitation.
   *
   * @param row - Database row
   * @returns ExtractedCitation object
   */
  private rowToExtractedCitation(row: ExtractedCitationRow): ExtractedCitation {
    let authors: readonly { readonly firstName?: string; readonly lastName: string }[] | undefined;

    if (row.authors) {
      try {
        authors = JSON.parse(row.authors) as {
          readonly firstName?: string;
          readonly lastName: string;
        }[];
      } catch {
        authors = undefined;
      }
    }

    return {
      eprintUri: row.eprint_uri as AtUri,
      rawText: row.raw_text,
      title: row.title ?? undefined,
      authors,
      doi: row.doi ?? undefined,
      year: row.year ?? undefined,
      venue: row.venue ?? undefined,
      volume: row.volume ?? undefined,
      pages: row.pages ?? undefined,
      source: row.source as ExtractedCitation['source'],
      chiveMatchUri: (row.chive_match_uri as AtUri) ?? undefined,
    };
  }

  // =============================================================================
  // PRIVATE: PLUGIN ACCESS
  // =============================================================================

  /**
   * Gets the Semantic Scholar plugin if available.
   */
  private getSemanticScholarPlugin(): SemanticScholarPlugin | undefined {
    if (!this.pluginManager) return undefined;

    const plugin = this.pluginManager.getPlugin('pub.chive.plugin.semantic-scholar');
    return plugin as SemanticScholarPlugin | undefined;
  }
}
