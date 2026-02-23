/**
 * Citation extraction background job.
 *
 * @remarks
 * Triggers citation extraction after eprint indexing. Fetches eprint
 * metadata (DOI, document CID, Semantic Scholar ID) and delegates
 * to the {@link CitationExtractionService} for extraction, matching,
 * and graph indexing.
 *
 * This job runs as a one-shot task per eprint, not on a timer. It is
 * triggered by the indexing pipeline or enrichment worker when a new
 * eprint is indexed or re-indexed.
 *
 * ATProto Compliance:
 * - Reads eprint metadata from local index (PostgreSQL)
 * - PDF blobs are fetched from user PDSes, not stored
 * - All extracted data is derived and rebuildable
 *
 * @packageDocumentation
 * @public
 */

import { withSpan, addSpanAttributes } from '../observability/tracer.js';
import type {
  CitationExtractionService,
  ExtractionResult,
} from '../services/citation/citation-extraction-service.js';
import type { AtUri, CID, DID } from '../types/atproto.js';
import type { IDatabasePool } from '../types/interfaces/database.interface.js';
import type { ILogger } from '../types/interfaces/logger.interface.js';

/**
 * Eprint metadata needed for citation extraction.
 */
interface EprintMetadataRow {
  readonly uri: string;
  readonly doi: string | null;
  readonly semantic_scholar_id: string | null;
  readonly submitted_by: string | null;
  readonly document_blob_cid: string | null;
  readonly document_format: string;
}

/**
 * Citation extraction job configuration.
 *
 * @public
 */
export interface CitationExtractionJobConfig {
  /**
   * Citation extraction service.
   */
  readonly citationExtractionService: CitationExtractionService;

  /**
   * Database pool for fetching eprint metadata.
   */
  readonly db: IDatabasePool;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;
}

/**
 * Citation extraction job result.
 *
 * @public
 */
export interface CitationExtractionJobResult {
  /**
   * Whether the job completed successfully.
   */
  readonly success: boolean;

  /**
   * Extraction result from the service (if successful).
   */
  readonly extraction?: ExtractionResult;

  /**
   * Error message (if failed).
   */
  readonly error?: string;
}

/**
 * Background job for extracting citations from a single eprint.
 *
 * @remarks
 * Designed to be called from the enrichment pipeline or indexing
 * handlers. Not a scheduled/recurring job; runs once per invocation.
 *
 * @example
 * ```typescript
 * const job = new CitationExtractionJob({
 *   citationExtractionService,
 *   db: pgPool,
 *   logger,
 * });
 *
 * const result = await job.run('at://did:plc:abc/pub.chive.eprint.submission/xyz');
 * if (result.success) {
 *   logger.info('Citations extracted', {
 *     total: result.extraction.totalExtracted,
 *     matched: result.extraction.matchedToChive,
 *   });
 * }
 * ```
 *
 * @public
 */
export class CitationExtractionJob {
  private readonly citationExtractionService: CitationExtractionService;
  private readonly db: IDatabasePool;
  private readonly logger: ILogger;

  constructor(config: CitationExtractionJobConfig) {
    this.citationExtractionService = config.citationExtractionService;
    this.db = config.db;
    this.logger = config.logger.child({ service: 'citation-extraction-job' });
  }

  /**
   * Runs citation extraction for a single eprint.
   *
   * @param eprintUri - AT-URI of the eprint to process
   * @returns Job result with extraction details
   *
   * @remarks
   * Fetches eprint metadata from PostgreSQL, then calls the
   * CitationExtractionService with all available identifiers.
   * Returns a partial success if some extraction sources fail.
   */
  async run(eprintUri: AtUri): Promise<CitationExtractionJobResult> {
    return withSpan(
      'citationExtractionJob.run',
      async () => {
        addSpanAttributes({
          'chive.operation': 'citation_extraction_job',
          'chive.eprint.uri': eprintUri,
        });

        this.logger.info('Starting citation extraction job', { eprintUri });

        try {
          // Fetch eprint metadata
          const metadata = await this.fetchEprintMetadata(eprintUri);
          if (!metadata) {
            this.logger.warn('Eprint not found in index, skipping citation extraction', {
              eprintUri,
            });
            return {
              success: false,
              error: 'Eprint not found in index',
            };
          }

          // Run extraction with all available identifiers
          const isPdf = metadata.document_format === 'pdf';
          const extraction = await this.citationExtractionService.extractCitations(eprintUri, {
            authorDid: (metadata.submitted_by as DID) ?? undefined,
            documentCid: (metadata.document_blob_cid as CID) ?? undefined,
            documentFormat: metadata.document_format,
            doi: metadata.doi ?? undefined,
            semanticScholarId: metadata.semantic_scholar_id ?? undefined,
            useGrobid: isPdf && !!metadata.document_blob_cid && !!metadata.submitted_by,
            useSemanticScholar: !!(metadata.doi ?? metadata.semantic_scholar_id),
            useCrossref: true,
          });

          this.logger.info('Citation extraction job completed', {
            eprintUri,
            totalExtracted: extraction.totalExtracted,
            matchedToChive: extraction.matchedToChive,
            durationMs: extraction.durationMs,
          });

          return {
            success: true,
            extraction,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          this.logger.error(
            'Citation extraction job failed',
            error instanceof Error ? error : undefined,
            { eprintUri }
          );

          return {
            success: false,
            error: errorMessage,
          };
        }
      },
      {
        attributes: {
          'chive.eprint.uri': eprintUri,
        },
      }
    );
  }

  /**
   * Fetches eprint metadata needed for citation extraction.
   *
   * @param eprintUri - AT-URI of the eprint
   * @returns Eprint metadata, or null if not found
   */
  private async fetchEprintMetadata(eprintUri: AtUri): Promise<EprintMetadataRow | null> {
    const result = await this.db.query<EprintMetadataRow>(
      `SELECT uri, published_version->>'doi' AS doi,
              external_ids->>'semanticScholarId' AS semantic_scholar_id,
              submitted_by, document_blob_cid, document_format
       FROM eprints_index
       WHERE uri = $1 AND deleted_at IS NULL`,
      [eprintUri]
    );

    return result.rows[0] ?? null;
  }
}
