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
   * arXiv identifier of the cited work.
   *
   * @remarks
   * A reference to a preprint often carries this and no DOI, so for a preprint
   * server it is the identifier most likely to be present on exactly the works
   * worth matching.
   */
  readonly arxivId?: string;

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
/**
 * How a citation was resolved to a Chive eprint.
 *
 * @remarks
 * Ordered by how much the identifier alone establishes: `doi` and `arxiv` name
 * a work outright, `title` is an exact match after normalisation, and `fuzzy`
 * is a near-title match that had to be corroborated by an author or a year
 * before it was accepted.
 *
 * @public
 */
export type MatchMethod = 'doi' | 'arxiv' | 'title' | 'fuzzy';

/**
 * Shortest normalized title worth matching on.
 *
 * @remarks
 * Below this a title carries too little to distinguish papers, and GROBID
 * fragments ("Act", "Argument Realization") would collide with real entries.
 */
const MIN_TITLE_LENGTH = 10;

/**
 * Trigram similarity a near-title match must clear before corroboration.
 *
 * @remarks
 * Chosen against the corpus rather than picked: every correct pair observed
 * below an exact match scored 0.89 or better, and the band beneath it held only
 * truncated titles that corroboration would have had to rescue anyway.
 */
const FUZZY_TITLE_THRESHOLD = 0.9;

/**
 * Title normalisation, in SQL.
 *
 * @remarks
 * This must agree with {@link CitationExtractionService.normalizeTitle}
 * exactly. It did not: the SQL collapsed no whitespace and trimmed nothing,
 * while the TypeScript did both, so any stored title with a double space or a
 * newline could never be matched by a comparison that looked exact. Written
 * once here so the two cannot drift again.
 */
const NORMALIZED_TITLE_SQL = `BTRIM(REGEXP_REPLACE(LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9[:space:]]', '', 'g')), '\\s+', ' ', 'g'))`;

/**
 * Strips an arXiv identifier down to its bare form.
 *
 * @param value - Identifier as extracted
 * @returns The bare identifier, or null when it does not look like one
 */
/**
 * Reads the author list stored alongside a citation.
 *
 * @param value - The `authors` column, as jsonb
 * @returns Authors with a surname, or undefined
 *
 * @remarks
 * Stored by extraction and, until now, read by nothing. Only entries carrying a
 * surname are returned, since the surname is what corroborates a near-title
 * match.
 */
function parseStoredAuthors(
  value: unknown
): readonly { readonly firstName?: string; readonly lastName: string }[] | undefined {
  const raw = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(raw)) return undefined;

  const authors = raw
    .filter((a): a is { firstName?: string; lastName: string } => {
      if (a === null || typeof a !== 'object') return false;
      const last = (a as { lastName?: unknown }).lastName;
      return typeof last === 'string' && last.length > 0;
    })
    .map((a) => ({ firstName: a.firstName, lastName: a.lastName }));

  return authors.length > 0 ? authors : undefined;
}

function normalizeArxivId(value: string): string | null {
  const stripped = value
    .trim()
    .toLowerCase()
    .replace(/^arxiv[:\s]*/, '')
    .replace(/v\d+$/, '');
  return /^\d{4}\.\d{4,5}$/.test(stripped) || /^[a-z-]+\/\d{7}$/.test(stripped) ? stripped : null;
}

/**
 * Strips a DOI down to its bare form.
 *
 * @param value - DOI as extracted, possibly a URL or prefixed
 * @returns The bare DOI, or null when nothing DOI-shaped remains
 *
 * @remarks
 * A reference yields a DOI written any number of ways -- `https://doi.org/10.x`,
 * `doi:10.x`, with a sentence's full stop still attached, or, as GROBID
 * sometimes leaves it, the tail `.org/10.x` of a URL whose front was lost.
 */
function normalizeDoi(value: string): string | null {
  const stripped = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^(dx\.)?doi\.org\//, '')
    .replace(/^\.org\//, '')
    .replace(/^doi:\s*/, '')
    .replace(/[.,;)\]]+$/, '');
  return stripped.startsWith('10.') ? stripped : null;
}

export interface MatchedCitation extends ExtractedCitation {
  /**
   * Confidence of the match (0-1).
   */
  readonly matchConfidence: number;

  /**
   * Method used for matching.
   */
  readonly matchMethod: MatchMethod;
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
          await this.ensureNodesFor(citationRelationships);
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
   * Strategies are tried strongest identifier first; see
   * {@link CitationExtractionService.findMatch}.
   */
  async matchCitationsToChive(
    citations: readonly ExtractedCitation[]
  ): Promise<readonly MatchedCitation[]> {
    return withSpan('citationExtraction.matchToChive', async () => {
      const results: MatchedCitation[] = [];

      for (const citation of citations) {
        const match = await this.findMatch(citation);
        const matchUri = match?.uri;
        const matchConfidence = match?.confidence ?? 0;
        const matchMethod = match?.method ?? 'doi';

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

  /**
   * Re-resolves stored citations against the eprints now indexed.
   *
   * @param options - `eprintUri` limits the pass to one citing eprint; `limit`
   *   caps how many unmatched citations are considered
   * @returns How many were examined, newly matched, and turned into edges
   *
   * @remarks
   * {@link CitationExtractionService.matchCitationsToChive} runs once, while a
   * document is being processed, and resolves each reference against the
   * eprints indexed *at that moment*. A reference to a work Chive indexes later
   * therefore cannot match, and nothing revisits it — so the citation graph
   * only ever contains edges that were discoverable in extraction order, and
   * grows steadily more incomplete as the corpus fills in behind it.
   *
   * This closes that gap by re-running the same DOI-then-title matching over
   * citations that have no match yet, and writing the edges the original pass
   * could not have known about. It reads Postgres and writes graph edges — no
   * PDF is fetched and GROBID is not involved — so it is cheap enough to run
   * whenever the corpus has grown, which is what keeps the graph current.
   *
   * Only rows with `chive_match_uri IS NULL` are considered, so a match already
   * recorded is never overwritten, and running it twice does nothing the second
   * time.
   *
   * @public
   */
  async rematchStoredCitations(
    options: { readonly eprintUri?: AtUri; readonly limit?: number } = {}
  ): Promise<{ examined: number; matched: number; edgesCreated: number }> {
    return withSpan('citationExtraction.rematch', async () => {
      const limit = options.limit ?? 5000;

      const rows = await this.db.query<{
        id: string;
        eprint_uri: string;
        raw_text: string | null;
        title: string | null;
        authors: unknown;
        doi: string | null;
        arxiv_id: string | null;
        year: number | null;
        venue: string | null;
        source: string;
      }>(
        // The whole row, not just the title and DOI: the strategy chain
        // corroborates a near-title match against the authors and the year, and
        // a re-match that loaded neither would silently be a weaker matcher
        // than the one that runs during extraction.
        `SELECT id, eprint_uri, raw_text, title, authors, doi, arxiv_id, year, venue, source
         FROM extracted_citations
         WHERE chive_match_uri IS NULL
           ${options.eprintUri ? 'AND eprint_uri = $2' : ''}
         ORDER BY id
         LIMIT $1`,
        options.eprintUri ? [limit, options.eprintUri] : [limit]
      );

      const relationships: CitationRelationship[] = [];
      let matched = 0;

      for (const row of rows.rows) {
        const match = await this.findMatch({
          eprintUri: row.eprint_uri as AtUri,
          rawText: row.raw_text ?? '',
          title: row.title ?? undefined,
          authors: parseStoredAuthors(row.authors),
          doi: row.doi ?? undefined,
          arxivId: row.arxiv_id ?? undefined,
          year: row.year ?? undefined,
          venue: row.venue ?? undefined,
          source: row.source as ExtractedCitation['source'],
        });

        // A paper citing itself is not a citation edge; it is the same node,
        // and an extracted reference can name the citing work when a preprint
        // lists its own published version.
        if (!match || match.uri === row.eprint_uri) continue;

        const matchUri = match.uri;

        await this.db.query(
          `UPDATE extracted_citations
           SET chive_match_uri = $1, match_confidence = $2, match_method = $3
           WHERE id = $4`,
          [matchUri, match.confidence, match.method, row.id]
        );
        matched += 1;

        relationships.push({
          citingUri: row.eprint_uri as AtUri,
          citedUri: matchUri,
          source: row.source as CitationRelationship['source'],
        });
      }

      if (relationships.length > 0) {
        await this.ensureNodesFor(relationships);
        await this.citationGraph.upsertCitationsBatch(relationships);
      }

      this.logger.info('Citation re-matching complete', {
        examined: rows.rows.length,
        matched,
        edgesCreated: relationships.length,
      });

      return { examined: rows.rows.length, matched, edgesCreated: relationships.length };
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
      arxivId: ref.arxivId,
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
  /**
   * Resolves one citation to a Chive eprint.
   *
   * @param citation - The extracted citation
   * @returns The match, or null when nothing is confident enough
   *
   * @remarks
   * Strongest identifier first, stopping at the first hit:
   *
   * 1. **DOI** — names the work outright.
   * 2. **arXiv id** — likewise, and often the only identifier a reference to a
   *    preprint carries.
   * 3. **Exact title**, after normalisation.
   * 4. **Near title**, but only when an author surname or the year agrees.
   *
   * The last exists because references arrive with the citation's own furniture
   * attached: GROBID hands back titles beginning `2023a.`, `press.` or missing
   * a leading word, and an exact comparison rejects all of them. A near match
   * on its own would be a guess, so it must be corroborated by something the
   * reference states independently -- which is what the author list and year
   * are for, having been extracted and stored all along without ever being
   * consulted.
   */
  /**
   * Creates graph nodes for the eprints a set of edges will connect.
   *
   * @param relationships - The edges about to be written
   *
   * @remarks
   * The graph matches an edge's endpoints rather than creating them, so that no
   * edge can assert a paper Chive does not hold. Every URI here has already
   * been resolved against `eprints_index` -- the citing eprint is one being
   * indexed, and each cited URI came from a match against that table -- but it
   * is re-checked rather than assumed, because this is the one place a wrong
   * URI would put a paper in the graph that does not exist.
   */
  private async ensureNodesFor(relationships: readonly CitationRelationship[]): Promise<void> {
    if (!this.citationGraph || relationships.length === 0) return;

    const uris = [...new Set(relationships.flatMap((r) => [r.citingUri, r.citedUri]))];

    const known = await this.db.query<{ uri: string }>(
      `SELECT uri FROM eprints_index WHERE uri = ANY($1)`,
      [uris]
    );

    await this.citationGraph.ensureEprintNodes(known.rows.map((row) => row.uri));
  }

  private async findMatch(
    citation: ExtractedCitation
  ): Promise<{ uri: AtUri; confidence: number; method: MatchMethod } | null> {
    if (citation.doi) {
      const uri = await this.findEprintByDoi(citation.doi);
      if (uri) return { uri: uri as AtUri, confidence: 1.0, method: 'doi' };
    }

    if (citation.arxivId) {
      const uri = await this.findEprintByArxivId(citation.arxivId);
      if (uri) return { uri: uri as AtUri, confidence: 1.0, method: 'arxiv' };
    }

    if (citation.title) {
      const exact = await this.findEprintByTitle(citation.title);
      if (exact) return { uri: exact as AtUri, confidence: 0.9, method: 'title' };

      const near = await this.findEprintByFuzzyTitle(citation);
      if (near) return { uri: near as AtUri, confidence: 0.75, method: 'fuzzy' };
    }

    return null;
  }

  /**
   * Finds an eprint whose title is close to a citation's, corroborated.
   *
   * @param citation - The citation, whose authors and year are the corroboration
   * @returns The eprint's AT-URI, or null
   *
   * @remarks
   * Similarity alone is not enough to assert a citation: two papers by one
   * group often differ by a few words, and the corpus is full of near
   * neighbours. So a candidate above the threshold is accepted only if the
   * reference independently agrees on an author surname or on the year. A
   * reference carrying neither is left unmatched rather than guessed at -- a
   * wrong edge in a citation graph is worse than a missing one, because nothing
   * downstream can tell it was invented.
   */
  private async findEprintByFuzzyTitle(citation: ExtractedCitation): Promise<string | null> {
    const normalized = this.normalizeTitle(citation.title ?? '');
    if (normalized.length < MIN_TITLE_LENGTH) return null;

    const surnames = (citation.authors ?? [])
      .map((a) => a.lastName.toLowerCase())
      .filter((n) => n.length > 2);

    const result = await this.db.query<{ uri: string; title: string; year: number | null }>(
      `SELECT uri,
              title,
              NULLIF(LEFT(published_version->>'publishedAt', 4), '')::int AS year
       FROM eprints_index
       WHERE similarity(${NORMALIZED_TITLE_SQL}, $1) >= $2
       ORDER BY similarity(${NORMALIZED_TITLE_SQL}, $1) DESC
       LIMIT 5`,
      [normalized, FUZZY_TITLE_THRESHOLD]
    );

    for (const row of result.rows) {
      if (citation.year && row.year && Math.abs(citation.year - row.year) <= 1) {
        return row.uri;
      }
      if (surnames.length > 0) {
        const authorsBlob = await this.eprintAuthorsBlob(row.uri);
        if (surnames.some((surname) => authorsBlob.includes(surname))) {
          return row.uri;
        }
      }
    }

    return null;
  }

  /**
   * The lowercased author names of an eprint, as one string to search.
   */
  private async eprintAuthorsBlob(uri: string): Promise<string> {
    const result = await this.db.query<{ blob: string | null }>(
      `SELECT LOWER(authors::text) AS blob FROM eprints_index WHERE uri = $1`,
      [uri]
    );
    return result.rows[0]?.blob ?? '';
  }

  /**
   * Finds a Chive eprint by arXiv identifier.
   *
   * @param arxivId - Identifier as extracted, possibly with prefix or version
   * @returns The eprint's AT-URI, or null
   *
   * @remarks
   * An eprint records where it was published rather than an arXiv id of its
   * own, so the id is looked for inside that URL. `arXiv:2401.01234v2`,
   * `2401.01234v2` and `2401.01234` all have to reach the same paper, so the
   * prefix and the version suffix come off first.
   */
  private async findEprintByArxivId(arxivId: string): Promise<string | null> {
    const normalized = normalizeArxivId(arxivId);
    if (!normalized) return null;

    const result = await this.db.query<{ uri: string }>(
      `SELECT uri FROM eprints_index
       WHERE published_version->>'url' ILIKE $1
       LIMIT 1`,
      [`%${normalized}%`]
    );

    return result.rows[0]?.uri ?? null;
  }

  private async findEprintByDoi(doi: string): Promise<string | null> {
    const normalizedDoi = normalizeDoi(doi);
    if (!normalizedDoi) return null;

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
    if (normalized.length < MIN_TITLE_LENGTH) return null;

    const result = await this.db.query<EprintLookupRow>(
      `SELECT uri, title FROM eprints_index
       WHERE ${NORMALIZED_TITLE_SQL} = $1
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
    return (
      title
        .toLowerCase()
        // A reference's own furniture, which GROBID hands back attached to the
        // front of the title: the year label a citation is keyed by ("2023a."),
        // and the status standing in for one ("in press.", "to appear."). Left
        // on, they defeat an exact comparison against a title that never had
        // them.
        .replace(/^\s*(?:\d{4}[a-z]?\.\s*)+/, '')
        .replace(/^\s*(?:in\s+)?press\.\s*/, '')
        .replace(/^\s*(?:to\s+appear|forthcoming|submitted)\.\s*/, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
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
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13})`
        );

        values.push(
          eprintUri,
          citation.rawText,
          citation.title ?? null,
          authorsJson,
          citation.doi ?? null,
          citation.arxivId ?? null,
          citation.year ?? null,
          citation.venue ?? null,
          citation.volume ?? null,
          citation.pages ?? null,
          citation.source,
          citation.chiveMatchUri ?? null,
          citation.matchConfidence > 0 ? citation.matchConfidence : null,
          citation.matchConfidence > 0 ? citation.matchMethod : null
        );

        paramIndex += 14;
      }

      const query = `
        INSERT INTO extracted_citations (
          eprint_uri, raw_text, title, authors, doi, arxiv_id, year,
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
