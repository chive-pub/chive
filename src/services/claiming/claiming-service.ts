/**
 * Claiming service for multi-authority eprint verification.
 *
 * @remarks
 * This module implements the claiming service that enables authors to claim
 * ownership of eprints imported from external sources (arXiv, LingBuzz, etc.)
 * using multi-authority verification.
 *
 * ATProto Compliance:
 * - Chive NEVER writes to user PDSes
 * - User creates canonical record in THEIR PDS after claim approval
 * - Claim evidence is collected from external authorities
 * - All claim data is AppView-specific (rebuildable)
 *
 * Multi-Authority Verification:
 * - ORCID (OAuth 2.0 verified iD)
 * - Semantic Scholar (claimed author page)
 * - OpenReview (authenticated profile)
 * - OpenAlex (ORCID-linked author ID)
 * - arXiv (author ownership)
 * - Institutional Email (domain verification)
 * - ROR Affiliation (organization match)
 * - Name matching (fuzzy)
 * - Co-author network overlap
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import type { IDatabasePool } from '../../types/interfaces/database.interface.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type {
  ClaimRequest,
  ClaimStatus,
  CoauthorClaimRequest,
  ExternalAuthor,
  ExternalEprint,
  ExternalSearchQuery,
  IClaimingService,
  IImportService,
  IPluginManager,
  ImportedEprint,
  ImportSource,
} from '../../types/interfaces/plugin.interface.js';
import {
  isSearchablePlugin,
  type SearchablePlugin,
} from '../../types/interfaces/plugin.interface.js';

/**
 * External eprint with source metadata.
 *
 * @remarks
 * Extends ExternalEprint with the source identifier for federated search results.
 *
 * @public
 * @since 0.1.0
 */
export interface ExternalEprintWithSource extends ExternalEprint {
  /**
   * Source system the eprint came from.
   */
  readonly source: ImportSource;

  /**
   * AT-URI of the paper if it exists in Chive's index.
   *
   * @remarks
   * Present only when `source` is `'chive'`, linking directly to the
   * indexed eprint record.
   */
  readonly chiveUri?: string;
}

/**
 * Per-source error from a federated search.
 *
 * @remarks
 * Tracks which external sources failed during a search so that the
 * frontend can display partial-failure warnings.
 *
 * @public
 */
export interface SourceError {
  /** Source identifier that failed (e.g., 'arxiv', 'openreview'). */
  readonly source: string;
  /** Human-readable error message. */
  readonly message: string;
}

/**
 * Result from a federated search across all sources.
 *
 * @remarks
 * Contains both the results that succeeded and per-source error
 * information for sources that failed.
 *
 * @public
 */
export interface SearchAllSourcesResult {
  /** Eprints that were successfully retrieved. */
  readonly results: readonly ExternalEprintWithSource[];
  /** Errors from sources that failed to respond. */
  readonly sourceErrors: readonly SourceError[];
}

/**
 * Database row type for claim requests.
 */
interface ClaimRequestRow {
  id: number;
  import_id: number;
  claimant_did: string;
  evidence: string; // JSON string
  verification_score: number | null;
  status: string;
  canonical_uri: string | null;
  rejection_reason: string | null;
  reviewed_by_did: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
}

/**
 * Database row type for claim requests joined with imported_eprints.
 */
interface ClaimRequestWithPaperRow extends ClaimRequestRow {
  paper_source: string;
  paper_external_id: string;
  paper_external_url: string;
  paper_title: string;
  paper_authors: string; // JSON string
  paper_publication_date: Date | null;
  paper_doi: string | null;
}

/**
 * Database row type for co-author claim requests.
 */
interface CoauthorClaimRequestRow {
  id: number;
  eprint_uri: string;
  eprint_owner_did: string;
  claimant_did: string;
  claimant_name: string;
  author_index: number;
  author_name: string;
  status: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  updated_at: Date;
}

/**
 * Claim request with paper details for display.
 */
export interface ClaimRequestWithPaper extends ClaimRequest {
  /** Paper details from imported_eprints */
  paper: {
    source: ImportSource;
    externalId: string;
    externalUrl: string;
    title: string;
    authors: readonly ExternalAuthor[];
    publicationDate?: string;
    doi?: string;
  };
}

/**
 * Claiming service implementation.
 *
 * @remarks
 * Manages the claim workflow for imported eprints:
 * 1. User initiates claim request
 * 2. Service collects evidence from multiple authorities
 * 3. Confidence score computed with weighted evidence
 * 4. Decision: auto-approve, expedited review, manual review, or insufficient
 * 5. User creates canonical record in THEIR PDS (Chive never writes to PDSes)
 * 6. Claim completed when canonical record is indexed
 *
 * @public
 */
/**
 * User profile data for claim verification and paper suggestions.
 *
 * @remarks
 * Combines data from both app.bsky.actor.profile (Bluesky) and
 * pub.chive.actor.profile (Chive academic profile).
 *
 * Note: affiliations/researchKeywords are stored as structured types
 * in the PDS but extracted to strings here for matching logic.
 */
interface UserProfile {
  readonly did: string;
  readonly handle: string;
  readonly displayName?: string;
  readonly orcid?: string;
  readonly semanticScholarId?: string;
  readonly openAlexId?: string;
  readonly googleScholarId?: string;
  readonly arxivAuthorId?: string;
  readonly openReviewId?: string;
  readonly dblpId?: string;
  readonly scopusAuthorId?: string;
  /** Alternative name forms for paper matching */
  readonly nameVariants?: readonly string[];
  /** Current institutional affiliation names (extracted from structured types) */
  readonly affiliations?: readonly string[];
  /** Previous affiliation names for matching older papers (extracted from structured types) */
  readonly previousAffiliations?: readonly string[];
  /** Research keyword labels for filtering suggestions (extracted from structured types) */
  readonly researchKeywords?: readonly string[];
}

export class ClaimingService implements IClaimingService {
  /**
   * Optional plugin manager for external source search.
   *
   * @remarks
   * If provided, enables searchAllSources() and startClaimFromExternal().
   */
  private pluginManager?: IPluginManager;

  private readonly logger: ILogger;
  private readonly db: IDatabasePool;
  private readonly importService: IImportService;
  private readonly identity: IIdentityResolver;

  constructor(
    logger: ILogger,
    db: IDatabasePool,
    importService: IImportService,
    identity: IIdentityResolver
  ) {
    this.logger = logger;
    this.db = db;
    this.importService = importService;
    this.identity = identity;
  }

  /**
   * Sets the plugin manager for external source search.
   *
   * @param manager - Plugin manager instance
   *
   * @remarks
   * Call this after construction to enable searchAllSources() and
   * startClaimFromExternal(). This setter pattern allows the ClaimingService
   * to work without plugins while enabling search when plugins are available.
   */
  setPluginManager(manager: IPluginManager): void {
    this.pluginManager = manager;
    this.logger.info('Plugin manager configured for claiming service');
  }

  /**
   * Starts a new claim request.
   *
   * @param importId - ID of the imported eprint to claim
   * @param claimantDid - DID of the user making the claim
   * @returns Created claim request
   *
   * @throws NotFoundError if import not found
   * @throws ValidationError if import already claimed or claim already pending
   */
  async startClaim(importId: number, claimantDid: string): Promise<ClaimRequest> {
    // Verify import exists and is claimable
    const imported = await this.importService.getById(importId);
    if (!imported) {
      throw new NotFoundError('ImportedEprint', importId.toString());
    }

    if (imported.claimStatus === 'claimed') {
      throw new ValidationError(
        `Import ${importId} has already been claimed`,
        'importId',
        'already_claimed'
      );
    }

    // Check for existing pending claim by this user
    const existingClaim = await this.getClaimByImportAndClaimant(importId, claimantDid);
    if (existingClaim?.status === 'pending') {
      throw new ValidationError(
        `Claim already pending for import ${importId} by ${claimantDid}`,
        'importId',
        'claim_pending'
      );
    }

    // Create claim request
    const result = await this.db.query<ClaimRequestRow>(
      `INSERT INTO claim_requests (
        import_id, claimant_did, evidence, verification_score, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'pending', NOW(), NOW()
      )
      RETURNING *`,
      [importId, claimantDid, '[]', 0]
    );

    const row = result.rows[0];
    if (!row) {
      throw new DatabaseError(
        'CREATE',
        'Failed to create claim request: no row returned from database'
      );
    }

    const claim = this.rowToClaimRequest(row);

    // Update import status to pending
    await this.importService.update(importId, { claimStatus: 'pending' });

    this.logger.info('Claim started', {
      claimId: claim.id,
      importId,
      claimantDid,
    });

    return claim;
  }

  /**
   * Completes a claim after user creates canonical record.
   *
   * @param claimId - ID of the claim request
   * @param canonicalUri - AT-URI of the user's canonical record
   *
   * @remarks
   * This is called after the user creates their canonical record in their PDS.
   * Chive NEVER writes to user PDSes - the user's client creates the record.
   */
  async completeClaim(claimId: number, canonicalUri: string): Promise<void> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new NotFoundError('ClaimRequest', claimId.toString());
    }

    if (claim.status !== 'pending' && claim.status !== 'approved') {
      throw new ValidationError(
        `Cannot complete claim with status: ${claim.status}`,
        'status',
        'invalid_status'
      );
    }

    // Update claim status
    await this.db.query(
      `UPDATE claim_requests
       SET status = 'approved', canonical_uri = $1, updated_at = NOW()
       WHERE id = $2`,
      [canonicalUri, claimId]
    );

    // Mark import as claimed
    await this.importService.markClaimed(claim.importId, canonicalUri, claim.claimantDid);

    this.logger.info('Claim completed', {
      claimId,
      canonicalUri,
      claimantDid: claim.claimantDid,
    });
  }

  /**
   * Rejects a claim request.
   *
   * @param claimId - ID of the claim request
   * @param reason - Rejection reason
   * @param reviewerDid - DID of the reviewer
   */
  async rejectClaim(claimId: number, reason: string, reviewerDid: string): Promise<void> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new NotFoundError('ClaimRequest', claimId.toString());
    }

    if (claim.status !== 'pending') {
      throw new ValidationError(
        `Cannot reject claim with status: ${claim.status}`,
        'status',
        'invalid_status'
      );
    }

    await this.db.query(
      `UPDATE claim_requests
       SET status = 'rejected', rejection_reason = $1, reviewed_by_did = $2,
           reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [reason, reviewerDid, claimId]
    );

    // Reset import claim status
    await this.importService.update(claim.importId, { claimStatus: 'unclaimed' });

    this.logger.info('Claim rejected', {
      claimId,
      reason,
      reviewerDid,
    });
  }

  /**
   * Gets a claim request by ID.
   */
  async getClaim(claimId: number): Promise<ClaimRequest | null> {
    const result = await this.db.query<ClaimRequestRow>(
      `SELECT * FROM claim_requests WHERE id = $1`,
      [claimId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToClaimRequest(row);
  }

  /**
   * Gets pending claims for a user.
   */
  async getUserClaims(claimantDid: string): Promise<readonly ClaimRequest[]> {
    const result = await this.db.query<ClaimRequestRow>(
      `SELECT * FROM claim_requests
       WHERE claimant_did = $1
       ORDER BY created_at DESC`,
      [claimantDid]
    );

    return result.rows.map((row) => this.rowToClaimRequest(row));
  }

  /**
   * Gets user claims with paper details for display.
   *
   * @param claimantDid - DID of the claimant
   * @returns Claims with paper information
   */
  async getUserClaimsWithPaper(claimantDid: string): Promise<readonly ClaimRequestWithPaper[]> {
    const result = await this.db.query<ClaimRequestWithPaperRow>(
      `SELECT
         cr.*,
         ip.source AS paper_source,
         ip.external_id AS paper_external_id,
         ip.external_url AS paper_external_url,
         ip.title AS paper_title,
         ip.authors AS paper_authors,
         ip.publication_date AS paper_publication_date,
         ip.doi AS paper_doi
       FROM claim_requests cr
       JOIN imported_eprints ip ON cr.import_id = ip.id
       WHERE cr.claimant_did = $1
       ORDER BY cr.created_at DESC`,
      [claimantDid]
    );

    return result.rows.map((row) => this.rowToClaimRequestWithPaper(row));
  }

  /**
   * Converts a database row with paper info to ClaimRequestWithPaper.
   */
  private rowToClaimRequestWithPaper(row: ClaimRequestWithPaperRow): ClaimRequestWithPaper {
    const claim = this.rowToClaimRequest(row);
    const authors: readonly ExternalAuthor[] =
      typeof row.paper_authors === 'string'
        ? (JSON.parse(row.paper_authors) as ExternalAuthor[])
        : ((row.paper_authors as ExternalAuthor[] | undefined) ?? []);

    return {
      ...claim,
      paper: {
        source: row.paper_source,
        externalId: row.paper_external_id,
        externalUrl: row.paper_external_url,
        title: row.paper_title,
        authors,
        publicationDate: row.paper_publication_date?.toISOString().split('T')[0],
        doi: row.paper_doi ?? undefined,
      },
    };
  }

  /**
   * Finds claimable eprints for a user.
   */
  async findClaimable(options: {
    q?: string;
    source?: ImportSource;
    limit?: number;
    cursor?: string;
  }): Promise<{ eprints: ImportedEprint[]; cursor?: string }> {
    // Search for unclaimed imports matching the query
    return this.importService.search({
      claimStatus: 'unclaimed',
      query: options.q,
      source: options.source,
      limit: options.limit,
      cursor: options.cursor,
    });
  }

  /**
   * Approves a claim for manual/expedited review.
   *
   * @param claimId - ID of the claim request
   * @param reviewerDid - DID of the reviewer
   */
  async approveClaim(claimId: number, reviewerDid: string): Promise<void> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new NotFoundError('ClaimRequest', claimId.toString());
    }

    if (claim.status !== 'pending') {
      throw new ValidationError(
        `Cannot approve claim with status: ${claim.status}`,
        'status',
        'invalid_status'
      );
    }

    await this.db.query(
      `UPDATE claim_requests
       SET status = 'approved', reviewed_by_did = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [reviewerDid, claimId]
    );

    this.logger.info('Claim approved', {
      claimId,
      reviewerDid,
    });
  }

  /**
   * Gets claims for an import.
   */
  async getClaimsForImport(importId: number): Promise<ClaimRequest[]> {
    const result = await this.db.query<ClaimRequestRow>(
      `SELECT * FROM claim_requests WHERE import_id = $1 ORDER BY created_at DESC`,
      [importId]
    );

    return result.rows.map((row) => this.rowToClaimRequest(row));
  }

  /**
   * Gets pending claims for review.
   */
  async getPendingClaims(options?: {
    minScore?: number;
    maxScore?: number;
    limit?: number;
    cursor?: string;
  }): Promise<{ claims: ClaimRequest[]; cursor?: string }> {
    const conditions: string[] = ["status = 'pending'"];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options?.minScore !== undefined) {
      conditions.push(`verification_score >= $${paramIndex++}`);
      values.push(options.minScore);
    }

    if (options?.maxScore !== undefined) {
      conditions.push(`verification_score < $${paramIndex++}`);
      values.push(options.maxScore);
    }

    if (options?.cursor) {
      const cursorId = parseInt(options.cursor, 10);
      conditions.push(`id > $${paramIndex++}`);
      values.push(cursorId);
    }

    const limit = Math.min(options?.limit ?? 50, 100);
    values.push(limit + 1);

    const result = await this.db.query<ClaimRequestRow>(
      `SELECT * FROM claim_requests
       WHERE ${conditions.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${paramIndex}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const claims = rows.map((row) => this.rowToClaimRequest(row));

    const lastRow = rows[rows.length - 1];
    return {
      claims,
      cursor: hasMore && lastRow ? lastRow.id.toString() : undefined,
    };
  }

  // ============================================================
  // Co-Author Claim Methods
  // ============================================================

  /**
   * Requests co-authorship on an existing eprint.
   *
   * @param eprintUri - AT-URI of the eprint record
   * @param eprintOwnerDid - DID of the PDS owner
   * @param claimantDid - DID of the person requesting co-authorship
   * @param claimantName - Display name for the request
   * @param message - Optional message to the PDS owner
   * @returns Created co-author claim request
   *
   * @throws ValidationError if already a pending request
   */
  async requestCoauthorship(
    eprintUri: string,
    eprintOwnerDid: string,
    claimantDid: string,
    claimantName: string,
    authorIndex: number,
    authorName: string,
    message?: string
  ): Promise<CoauthorClaimRequest> {
    // Cannot request co-authorship on your own paper
    if (eprintOwnerDid === claimantDid) {
      throw new ValidationError(
        'Cannot request co-authorship on your own paper',
        'claimantDid',
        'self_request'
      );
    }

    const result = await this.db.query<CoauthorClaimRequestRow>(
      `INSERT INTO coauthor_claim_requests (
        eprint_uri, eprint_owner_did, claimant_did, claimant_name, author_index, author_name, message, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (eprint_uri, claimant_did) DO UPDATE
      SET message = EXCLUDED.message, author_index = EXCLUDED.author_index, author_name = EXCLUDED.author_name, updated_at = NOW()
      WHERE coauthor_claim_requests.status = 'rejected'
      RETURNING *`,
      [
        eprintUri,
        eprintOwnerDid,
        claimantDid,
        claimantName,
        authorIndex,
        authorName,
        message ?? null,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new ValidationError(
        'Co-author request already pending for this paper',
        'eprintUri',
        'request_pending'
      );
    }

    this.logger.info('Co-author request created', {
      requestId: row.id,
      eprintUri,
      claimantDid,
      authorIndex,
    });

    return this.rowToCoauthorClaimRequest(row);
  }

  /**
   * Gets pending co-author requests for a PDS owner.
   *
   * @param ownerDid - DID of the PDS owner
   * @returns Pending requests on the owner's papers
   */
  async getCoauthorRequestsForOwner(ownerDid: string): Promise<readonly CoauthorClaimRequest[]> {
    const result = await this.db.query<CoauthorClaimRequestRow>(
      `SELECT * FROM coauthor_claim_requests
       WHERE eprint_owner_did = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [ownerDid]
    );

    return result.rows.map((row) => this.rowToCoauthorClaimRequest(row));
  }

  /**
   * Gets co-author requests made by a claimant.
   *
   * @param claimantDid - DID of the claimant
   * @returns All requests made by the claimant
   */
  async getCoauthorRequestsByClaimant(
    claimantDid: string
  ): Promise<readonly CoauthorClaimRequest[]> {
    const result = await this.db.query<CoauthorClaimRequestRow>(
      `SELECT * FROM coauthor_claim_requests
       WHERE claimant_did = $1
       ORDER BY created_at DESC`,
      [claimantDid]
    );

    return result.rows.map((row) => this.rowToCoauthorClaimRequest(row));
  }

  /**
   * Approves a co-author request.
   *
   * @param requestId - ID of the request
   * @param ownerDid - DID of the owner (must match eprint_owner_did)
   *
   * @remarks
   * After approval, the owner's client should update their PDS record
   * to add the claimant as co-author. Chive never writes to user PDSes.
   */
  async approveCoauthorRequest(requestId: number, ownerDid: string): Promise<void> {
    const result = await this.db.query<CoauthorClaimRequestRow>(
      `UPDATE coauthor_claim_requests
       SET status = 'approved', reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND eprint_owner_did = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, ownerDid]
    );

    if (result.rows.length === 0) {
      throw new ValidationError(
        'Request not found or not authorized',
        'requestId',
        'not_found_or_unauthorized'
      );
    }

    this.logger.info('Co-author request approved', {
      requestId,
      ownerDid,
    });
  }

  /**
   * Rejects a co-author request.
   *
   * @param requestId - ID of the request
   * @param ownerDid - DID of the owner (must match eprint_owner_did)
   * @param reason - Optional rejection reason
   */
  async rejectCoauthorRequest(requestId: number, ownerDid: string, reason?: string): Promise<void> {
    const result = await this.db.query<CoauthorClaimRequestRow>(
      `UPDATE coauthor_claim_requests
       SET status = 'rejected', rejection_reason = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND eprint_owner_did = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, ownerDid, reason ?? null]
    );

    if (result.rows.length === 0) {
      throw new ValidationError(
        'Request not found or not authorized',
        'requestId',
        'not_found_or_unauthorized'
      );
    }

    this.logger.info('Co-author request rejected', {
      requestId,
      ownerDid,
      reason,
    });
  }

  /**
   * Gets a co-author request by ID.
   */
  async getCoauthorRequest(requestId: number): Promise<CoauthorClaimRequest | null> {
    const result = await this.db.query<CoauthorClaimRequestRow>(
      `SELECT * FROM coauthor_claim_requests WHERE id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return row ? this.rowToCoauthorClaimRequest(row) : null;
  }

  /**
   * Converts database row to CoauthorClaimRequest.
   */
  private rowToCoauthorClaimRequest(row: CoauthorClaimRequestRow): CoauthorClaimRequest {
    return {
      id: row.id,
      eprintUri: row.eprint_uri,
      eprintOwnerDid: row.eprint_owner_did,
      claimantDid: row.claimant_did,
      claimantName: row.claimant_name,
      authorIndex: row.author_index,
      authorName: row.author_name,
      status: row.status as 'pending' | 'approved' | 'rejected',
      message: row.message ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at ?? undefined,
    };
  }

  // ============================================================
  // External Source Search Methods
  // ============================================================

  /**
   * Searches all external sources for eprints.
   *
   * @param options - Search options
   * @returns Eprints from all sources with source metadata
   *
   * @remarks
   * Performs federated search across all SearchablePlugin instances.
   * Non-searchable sources (LingBuzz, Semantics Archive) are searched
   * from the local import database only.
   *
   * Results are returned with source information for display.
   * Use RankingService to personalize results.
   *
   * @example
   * ```typescript
   * const results = await claimingService.searchAllSources({
   *   query: 'attention mechanisms',
   *   author: 'Vaswani',
   *   limit: 20,
   * });
   * ```
   */
  async searchAllSources(options: {
    query?: string;
    author?: string;
    sources?: readonly ImportSource[];
    limit?: number;
    timeoutMs?: number;
    authorProfileIds?: Readonly<Record<string, string>>;
  }): Promise<SearchAllSourcesResult> {
    const sourceErrors: SourceError[] = [];

    if (!this.pluginManager) {
      this.logger.warn('Plugin manager not configured, falling back to local search');
      const localResults = await this.importService.search({
        query: options.query,
        authorName: options.author,
        limit: options.limit,
      });
      return {
        results: localResults.eprints.map((p) => ({
          ...this.importedEprintToExternal(p),
          source: p.source,
        })),
        sourceErrors,
      };
    }

    const results: ExternalEprintWithSource[] = [];
    const plugins = this.pluginManager.getAllPlugins();
    const timeoutMs = options.timeoutMs ?? 10000;
    const limit = options.limit ?? 10;

    // Build search query
    const searchQuery: ExternalSearchQuery = {
      title: options.query,
      author: options.author,
      limit,
      authorProfileIds: options.authorProfileIds,
    };

    // Log plugin discovery for diagnostics
    const allPluginIds = plugins.map((p) => p.id);
    const searchablePlugins = plugins.filter((p) => isSearchablePlugin(p));
    const searchablePluginIds = searchablePlugins.map((p) => p.id);

    this.logger.debug('Plugin search discovery', {
      allPluginIds,
      searchablePluginIds,
      totalPlugins: plugins.length,
      searchableCount: searchablePlugins.length,
      query: searchQuery,
    });

    // Search each source in parallel with timeout
    const searchPromises = plugins
      .filter((plugin): plugin is SearchablePlugin => {
        if (!isSearchablePlugin(plugin)) return false;
        // Skip if sources filter is specified and this source is not included
        if (options.sources && options.sources.length > 0) {
          const pluginSource = this.getPluginSource(plugin.id);
          if (pluginSource && !options.sources.includes(pluginSource)) {
            return false;
          }
        }
        // Skip plugins that have nothing to search for: no text query, no
        // author name, and no profile ID for this specific source.
        const pluginSource = this.getPluginSource(plugin.id);
        const hasProfileId = pluginSource && options.authorProfileIds?.[pluginSource];
        if (!searchQuery.title && !searchQuery.author && !hasProfileId) {
          return false;
        }
        return true;
      })
      .map(async (plugin) => {
        const source = this.getPluginSource(plugin.id) ?? ('other' as ImportSource);

        this.logger.debug('Sending search to plugin', {
          pluginId: plugin.id,
          source,
          searchQuery,
          timeoutMs,
        });

        try {
          const pluginResults = await this.withTimeout(
            plugin.search(searchQuery),
            timeoutMs,
            `Search timeout for ${plugin.id}`
          );

          this.logger.debug('Plugin search returned results', {
            pluginId: plugin.id,
            source,
            resultCount: pluginResults.length,
          });

          return pluginResults.map((p) => ({
            ...p,
            source,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn('Plugin search failed', {
            pluginId: plugin.id,
            source,
            error: errorMessage,
          });
          sourceErrors.push({ source, message: errorMessage });
          return [];
        }
      });

    const searchResults = await Promise.all(searchPromises);
    for (const sourceResults of searchResults) {
      results.push(...sourceResults);
    }

    // Also search local imports for non-searchable sources (LingBuzz, Semantics Archive)
    const nonSearchableSources: ImportSource[] = ['lingbuzz', 'semanticsarchive'];
    const shouldSearchLocal =
      !options.sources ||
      options.sources.length === 0 ||
      options.sources.some((s) => nonSearchableSources.includes(s));

    if (shouldSearchLocal && options.query) {
      try {
        const localResults = await this.importService.search({
          query: options.query,
          authorName: options.author,
          limit,
        });

        // Add local results that are from non-searchable sources
        for (const imported of localResults.eprints) {
          if (nonSearchableSources.includes(imported.source)) {
            results.push({
              ...this.importedEprintToExternal(imported),
              source: imported.source,
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn('Local import search failed', { error: errorMessage });
        sourceErrors.push({ source: 'local', message: errorMessage });
      }
    }

    // Deduplicate by normalized title within each source. OpenReview in
    // particular returns multiple versions of the same paper (one per venue
    // submission), each with a different externalId.
    const seenTitles = new Set<string>();
    const deduped: typeof results = [];
    for (const paper of results) {
      const key = `${paper.source}:${paper.title.toLowerCase().trim()}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      deduped.push(paper);
    }

    this.logger.debug('External search completed', {
      query: options.query,
      author: options.author,
      resultCount: deduped.length,
      beforeDedup: results.length,
      sourceErrorCount: sourceErrors.length,
      sourceErrors: sourceErrors.length > 0 ? sourceErrors : undefined,
    });

    return { results: deduped, sourceErrors };
  }

  /**
   * Fast autocomplete search across external sources.
   *
   * @param query - Search query prefix
   * @param options - Autocomplete options
   * @returns Autocomplete suggestions with source metadata
   *
   * @remarks
   * Optimized for fast response times. Uses shorter timeout and
   * limits results to provide quick suggestions while typing.
   *
   * @example
   * ```typescript
   * const suggestions = await claimingService.autocompleteExternal('attention', {
   *   limit: 8,
   *   timeoutMs: 500,
   * });
   * ```
   */
  async autocompleteExternal(
    query: string,
    options?: {
      limit?: number;
      timeoutMs?: number;
    }
  ): Promise<readonly ExternalEprintWithSource[]> {
    // Use shorter timeout for autocomplete
    const timeoutMs = options?.timeoutMs ?? 500;
    const limit = options?.limit ?? 8;

    const { results } = await this.searchAllSources({
      query,
      limit,
      timeoutMs,
    });
    return results;
  }

  /**
   * Gets suggested papers for a user based on their profile.
   *
   * @param claimantDid - DID of the user to get suggestions for
   * @param options - Optional parameters
   * @returns Papers that likely match the user's authorship
   *
   * @remarks
   * Uses the user's Chive profile to find papers they may have authored:
   * 1. Searches using displayName and all nameVariants
   * 2. Uses external IDs (ORCID, Semantic Scholar, etc.) for direct lookups
   * 3. Filters by affiliations and research keywords
   * 4. Scores results by match quality
   *
   * This is the main method for auto-suggesting claimable papers.
   *
   * @example
   * ```typescript
   * const suggestions = await claimingService.getSuggestedPapers(userDid, {
   *   limit: 20,
   * });
   * for (const paper of suggestions.papers) {
   *   console.log(`${paper.title} - Match: ${paper.matchScore}%`);
   * }
   * ```
   *
   * @public
   */
  async getSuggestedPapers(
    claimantDid: string,
    options?: {
      limit?: number;
      timeoutMs?: number;
    }
  ): Promise<{
    papers: readonly (ExternalEprintWithSource & {
      matchScore: number;
      matchReason: string;
    })[];
    profileUsed: {
      displayName?: string;
      nameVariants: readonly string[];
      hasOrcid: boolean;
      hasExternalIds: boolean;
    };
  }> {
    const limit = options?.limit ?? 20;
    const timeoutMs = options?.timeoutMs ?? 5000;

    // Get user's full profile
    const profile = await this.getUserProfile(claimantDid);
    if (!profile) {
      return {
        papers: [],
        profileUsed: {
          displayName: undefined,
          nameVariants: [],
          hasOrcid: false,
          hasExternalIds: false,
        },
      };
    }

    // Collect all name forms to search
    const namesToSearch: string[] = [];
    if (profile.displayName) {
      namesToSearch.push(profile.displayName);
    }
    if (profile.nameVariants) {
      for (const variant of profile.nameVariants) {
        if (!namesToSearch.includes(variant)) {
          namesToSearch.push(variant);
        }
      }
    }

    // Track which external IDs we have
    const hasOrcid = !!profile.orcid;
    const hasExternalIds = !!(
      profile.semanticScholarId ??
      profile.openAlexId ??
      profile.googleScholarId ??
      profile.arxivAuthorId ??
      profile.openReviewId ??
      profile.dblpId ??
      profile.scopusAuthorId
    );

    // If no names or IDs, can't suggest papers
    if (namesToSearch.length === 0 && !hasOrcid && !hasExternalIds) {
      return {
        papers: [],
        profileUsed: {
          displayName: profile.displayName,
          nameVariants: profile.nameVariants ?? [],
          hasOrcid,
          hasExternalIds,
        },
      };
    }

    // Collect source-specific author profile IDs for direct lookups
    const authorProfileIds: Record<string, string> = {};
    if (profile.openReviewId) authorProfileIds.openreview = profile.openReviewId;
    if (profile.arxivAuthorId) authorProfileIds.arxiv = profile.arxivAuthorId;
    if (profile.semanticScholarId) authorProfileIds.semanticscholar = profile.semanticScholarId;

    // Fetch user's claimed paper topics in parallel with the search
    const searchPromises: Promise<readonly ExternalEprintWithSource[]>[] = [];
    const maxNameSearches = 3; // Limit to top 3 name variants

    // If we have profile IDs, do a single profile-based search (avoids
    // repeating the same profile lookup for each name variant).
    if (Object.keys(authorProfileIds).length > 0) {
      searchPromises.push(
        this.searchAllSources({
          limit,
          timeoutMs,
          authorProfileIds,
        })
          .then(({ results }) => results)
          .catch(() => [])
      );
    }

    for (const name of namesToSearch.slice(0, maxNameSearches)) {
      searchPromises.push(
        this.searchAllSources({
          author: name,
          limit: Math.ceil(limit / maxNameSearches),
          timeoutMs,
        })
          .then(({ results }) => results)
          .catch(() => [])
      );
    }

    // Fetch claimed topics, external search, and internal search concurrently
    const [searchResults, claimedTopics, internalResults] = await Promise.all([
      Promise.all(searchPromises),
      this.getUserClaimedTopics(claimantDid),
      this.searchInternalPapers(namesToSearch, claimantDid, limit).catch((err) => {
        this.logger.warn('Internal paper search failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return [] as ExternalEprintWithSource[];
      }),
    ]);

    // Deduplicate results by external ID
    const seenIds = new Set<string>();
    // Track DOIs from Chive papers so we can deduplicate external papers
    const chiveDois = new Set<string>();
    const allPapers: (ExternalEprintWithSource & {
      matchScore: number;
      matchReason: string;
    })[] = [];

    // Process internal Chive results first so they take priority in dedup
    for (const paper of internalResults) {
      const uniqueKey = `${paper.source}:${paper.externalId}`;
      if (seenIds.has(uniqueKey)) continue;
      seenIds.add(uniqueKey);

      if (paper.doi) {
        chiveDois.add(paper.doi.toLowerCase());
      }

      const { score, reasons } = this.scorePaperMatch(paper, profile, claimedTopics);
      if (score < 10) continue;

      allPapers.push({
        ...paper,
        matchScore: score,
        matchReason: reasons.join(', '),
      });
    }

    // Process external results, skipping papers already present from Chive (by DOI)
    for (const results of searchResults) {
      for (const paper of results) {
        const uniqueKey = `${paper.source}:${paper.externalId}`;
        if (seenIds.has(uniqueKey)) continue;

        // Deduplicate by DOI: prefer the Chive version
        if (paper.doi && chiveDois.has(paper.doi.toLowerCase())) continue;

        seenIds.add(uniqueKey);

        // Score the match with multi-signal scoring
        const { score, reasons } = this.scorePaperMatch(paper, profile, claimedTopics);

        // Filter out papers below minimum threshold
        if (score < 10) continue;

        allPapers.push({
          ...paper,
          matchScore: score,
          matchReason: reasons.join(', '),
        });
      }
    }

    // Filter out dismissed suggestions
    const dismissedKeys = await this.getDismissedSuggestions(claimantDid);
    const filteredPapers = allPapers.filter(
      (paper) => !dismissedKeys.has(`${paper.source}:${paper.externalId}`)
    );

    // Sort by match score descending
    filteredPapers.sort((a, b) => b.matchScore - a.matchScore);

    // Return top results
    return {
      papers: filteredPapers.slice(0, limit),
      profileUsed: {
        displayName: profile.displayName,
        nameVariants: profile.nameVariants ?? [],
        hasOrcid,
        hasExternalIds,
      },
    };
  }

  /**
   * Dismisses a paper suggestion so it is not shown again.
   *
   * @param userDid - DID of the user dismissing the suggestion
   * @param source - External source of the paper (e.g., 'arxiv')
   * @param externalId - Source-specific identifier of the paper
   */
  async dismissSuggestion(userDid: string, source: string, externalId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO dismissed_suggestions (user_did, source, external_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_did, source, external_id) DO NOTHING`,
      [userDid, source, externalId]
    );
  }

  /**
   * Gets the set of dismissed suggestion keys for a user.
   *
   * @param userDid - DID of the user
   * @returns Set of composite keys in the form 'source:externalId'
   */
  private async getDismissedSuggestions(userDid: string): Promise<Set<string>> {
    const result = await this.db.query<{ source: string; external_id: string }>(
      'SELECT source, external_id FROM dismissed_suggestions WHERE user_did = $1',
      [userDid]
    );
    return new Set(result.rows.map((row) => `${row.source}:${row.external_id}`));
  }

  /**
   * Searches Chive's own eprints_index for papers matching the user's name variants.
   *
   * @param nameVariants - Name forms to search for in the authors JSONB column
   * @param userDid - DID of the user (excluded from results to skip already-confirmed authorship)
   * @param limit - Maximum number of results
   * @returns Matching papers formatted as ExternalEprintWithSource with source 'chive'
   *
   * @private
   */
  private async searchInternalPapers(
    nameVariants: readonly string[],
    userDid: string,
    limit: number
  ): Promise<ExternalEprintWithSource[]> {
    if (nameVariants.length === 0) {
      return [];
    }

    // Build ILIKE patterns with wildcards for fuzzy matching
    const patterns = nameVariants.map((name) => `%${name}%`);

    const result = await this.db.query<{
      uri: string;
      title: string;
      abstract: string;
      keywords: string[] | null;
      authors: unknown;
      doi: string | null;
      created_at: Date;
    }>(
      `SELECT
         e.uri,
         e.title,
         e.abstract,
         e.keywords,
         e.authors,
         e.published_version->>'doi' AS doi,
         e.created_at
       FROM eprints_index e
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(e.authors) a
         WHERE a->>'name' ILIKE ANY($1)
       )
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(e.authors) a
         WHERE a->>'did' = $2
       )
       ORDER BY e.created_at DESC
       LIMIT $3`,
      [patterns, userDid, limit]
    );

    return result.rows.map((row) => {
      const authors = Array.isArray(row.authors)
        ? (row.authors as { name?: string; did?: string }[])
        : typeof row.authors === 'string'
          ? (JSON.parse(row.authors) as { name?: string; did?: string }[])
          : [];

      return {
        externalId: row.uri,
        url: `/eprints/${encodeURIComponent(row.uri)}`,
        title: row.title,
        abstract: row.abstract,
        authors: authors.map((a) => ({ name: a.name ?? '' })),
        publicationDate: row.created_at,
        doi: row.doi ?? undefined,
        categories: row.keywords ?? undefined,
        source: 'chive' as ImportSource,
        chiveUri: row.uri,
      };
    });
  }

  /**
   * Scores how well a paper matches a user's profile using multi-signal scoring.
   *
   * Four independent signals are combined into a final score (max 100):
   *
   * 1. Identity verification (0 or 40-50 pts): ORCID or external ID match
   * 2. Name matching (0-30 pts): Token-based matching with author count penalty
   * 3. Content overlap (0-30 pts): Topic, keyword, and field overlap
   * 4. Network context (0-20 pts): Affiliation and co-author overlap
   *
   * A content gate prevents name-only matches with no field overlap from
   * being surfaced. If (Signal 1 + Signal 2 < 40) AND (Signal 3 == 0),
   * the final score is capped at 5.
   *
   * @param paper - External eprint to score
   * @param profile - User's profile
   * @param userClaimedTopics - Aggregated topics from the user's claimed papers
   * @returns Score (0-100) and descriptive reasons
   *
   * @private
   */
  private scorePaperMatch(
    paper: ExternalEprintWithSource,
    profile: UserProfile,
    userClaimedTopics?: {
      concepts: string[];
      topics: string[];
      keywords: string[];
      coauthorNames: string[];
    }
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    const authorCount = paper.authors?.length ?? 0;

    // ================================================================
    // Signal 1: Identity verification (0 or 40-50 pts)
    // ================================================================
    let identityScore = 0;
    let identityMatched = false;

    // ORCID exact match on paper author
    if (profile.orcid) {
      const authorWithOrcid = paper.authors?.find((a) => a.orcid === profile.orcid);
      if (authorWithOrcid) {
        identityScore = 50;
        identityMatched = true;
        reasons.push('ORCID match');
      }
    }

    // External ID match (Semantic Scholar or OpenAlex author ID in paper metadata)
    if (!identityMatched && (profile.semanticScholarId ?? profile.openAlexId)) {
      const paperMeta = paper.metadata as
        | {
            semanticScholarAuthorIds?: string[];
            openAlexAuthorIds?: string[];
          }
        | undefined;
      if (paperMeta) {
        if (
          profile.semanticScholarId &&
          paperMeta.semanticScholarAuthorIds?.includes(profile.semanticScholarId)
        ) {
          identityScore = 40;
          identityMatched = true;
          reasons.push('Semantic Scholar author ID match');
        } else if (
          profile.openAlexId &&
          paperMeta.openAlexAuthorIds?.includes(profile.openAlexId)
        ) {
          identityScore = 40;
          identityMatched = true;
          reasons.push('OpenAlex author ID match');
        }
      }
    }

    // ================================================================
    // Signal 2: Name matching (0-30 pts, with author count penalty)
    // Skip if identity was already verified.
    // ================================================================
    let nameScore = 0;

    if (!identityMatched) {
      let bestMatch: {
        score: number;
        matchType: 'exact' | 'partial' | 'single' | 'none';
        authorName: string;
      } = { score: 0, matchType: 'none', authorName: '' };

      // Collect all name forms to check
      const namesToCheck: string[] = [];
      if (profile.displayName) {
        namesToCheck.push(profile.displayName);
      }
      if (profile.nameVariants) {
        for (const v of profile.nameVariants) {
          if (!namesToCheck.includes(v)) {
            namesToCheck.push(v);
          }
        }
      }

      for (const author of paper.authors ?? []) {
        for (const name of namesToCheck) {
          const match = this.calculateTokenNameMatch(name, author.name);
          if (match.score > bestMatch.score) {
            bestMatch = { ...match, authorName: author.name };
          }
        }
      }

      if (bestMatch.score > 0) {
        // Apply author count penalty multiplier
        let penalty = 1.0;
        if (authorCount > 200) {
          penalty = 0.05;
        } else if (authorCount > 50) {
          penalty = 0.2;
        } else if (authorCount > 10) {
          penalty = 0.5;
        }

        nameScore = Math.round(bestMatch.score * penalty);

        const matchLabel =
          bestMatch.matchType === 'exact'
            ? 'Exact name match'
            : bestMatch.matchType === 'partial'
              ? 'Partial name match'
              : 'Single token name match';
        reasons.push(`${matchLabel}: ${bestMatch.authorName}`);

        if (penalty < 1.0) {
          reasons.push(`Author count penalty: ${authorCount} authors (${penalty}x)`);
        }
      }
    }

    // ================================================================
    // Signal 3: Content overlap (0-30 pts, acts as gate)
    // ================================================================
    let contentScore = 0;
    const paperText = `${paper.title} ${paper.abstract ?? ''}`.toLowerCase();

    // 3a. OpenAlex topic overlap
    if (userClaimedTopics && userClaimedTopics.topics.length > 0) {
      for (const topic of userClaimedTopics.topics) {
        if (paperText.includes(topic.toLowerCase())) {
          contentScore += 15;
          reasons.push(`Topic overlap: ${topic}`);
          break; // Only count once for topic-level overlap
        }
      }
    }

    if (contentScore === 0 && userClaimedTopics && userClaimedTopics.concepts.length > 0) {
      for (const concept of userClaimedTopics.concepts) {
        if (paperText.includes(concept.toLowerCase())) {
          contentScore += 15;
          reasons.push(`Concept overlap: ${concept}`);
          break;
        }
      }
    }

    // 3b. Keyword matching (user profile keywords vs paper text)
    let keywordMatches = 0;
    if (profile.researchKeywords && profile.researchKeywords.length > 0) {
      for (const keyword of profile.researchKeywords) {
        if (paperText.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
    }

    // Also check claimed paper keywords against paper text
    if (userClaimedTopics && userClaimedTopics.keywords.length > 0) {
      for (const kw of userClaimedTopics.keywords) {
        if (paperText.includes(kw)) {
          keywordMatches++;
        }
      }
    }

    if (keywordMatches > 0) {
      const kwScore = Math.min(keywordMatches * 3, 10);
      contentScore += kwScore;
      reasons.push(`${keywordMatches} keyword match(es)`);
    }

    // 3c. Inferred field match from claimed paper keywords
    if (userClaimedTopics && userClaimedTopics.keywords.length > 0 && paper.categories) {
      const paperCats = paper.categories.map((c) => c.toLowerCase());
      const hasFieldOverlap = userClaimedTopics.keywords.some((kw) =>
        paperCats.some((cat) => cat.includes(kw) || kw.includes(cat))
      );
      if (hasFieldOverlap) {
        contentScore += 5;
        reasons.push('Inferred field match from claimed papers');
      }
    }

    // Cap content score at 30
    contentScore = Math.min(contentScore, 30);

    // ================================================================
    // Signal 4: Network context (0-20 pts)
    // ================================================================
    let networkScore = 0;

    // 4a. Affiliation match
    const allAffiliations = [
      ...(profile.affiliations ?? []),
      ...(profile.previousAffiliations ?? []),
    ];
    if (allAffiliations.length > 0) {
      let affiliationMatched = false;
      for (const author of paper.authors ?? []) {
        if (affiliationMatched) break;
        if (author.affiliation) {
          for (const userAff of allAffiliations) {
            if (
              author.affiliation.toLowerCase().includes(userAff.toLowerCase()) ||
              userAff.toLowerCase().includes(author.affiliation.toLowerCase())
            ) {
              networkScore += 10;
              reasons.push(`Affiliation match: ${author.affiliation}`);
              affiliationMatched = true;
              break;
            }
          }
        }
      }
    }

    // 4b. Co-author overlap
    if (userClaimedTopics && userClaimedTopics.coauthorNames.length > 0) {
      let coauthorMatched = false;
      for (const author of paper.authors ?? []) {
        if (coauthorMatched) break;
        const authorNameLower = author.name.toLowerCase();
        for (const coauthor of userClaimedTopics.coauthorNames) {
          if (authorNameLower === coauthor || authorNameLower.includes(coauthor)) {
            networkScore += 10;
            reasons.push(`Co-author overlap: ${author.name}`);
            coauthorMatched = true;
            break;
          }
        }
      }
    }

    // Cap network score at 20
    networkScore = Math.min(networkScore, 20);

    // ================================================================
    // Final score with content gate
    // ================================================================
    let finalScore = identityScore + nameScore + contentScore + networkScore;

    // Detect bootstrap mode: user has no claimed papers yet, so
    // userClaimedTopics is empty. In this case, the content gate would
    // block ALL suggestions, creating a chicken-and-egg problem.
    const isBootstrap =
      !userClaimedTopics ||
      (userClaimedTopics.topics.length === 0 &&
        userClaimedTopics.concepts.length === 0 &&
        userClaimedTopics.keywords.length === 0 &&
        userClaimedTopics.coauthorNames.length === 0);

    // CONTENT GATE: If no identity match and weak name match, and no
    // content overlap at all, cap the score at 5. This prevents
    // name-only matches with no field relevance from being surfaced.
    // Skip in bootstrap mode so first-time users can discover papers.
    if (!isBootstrap && identityScore + nameScore < 40 && contentScore === 0) {
      finalScore = Math.min(finalScore, 5);
      if (reasons.length > 0) {
        reasons.push('Content gate: no field overlap');
      }
    }

    finalScore = Math.min(finalScore, 100);

    return {
      score: finalScore,
      reasons: reasons.length > 0 ? reasons : ['Weak match'],
    };
  }

  /**
   * Starts a claim from an external search result.
   *
   * @param source - External source
   * @param externalId - Source-specific identifier
   * @param claimantDid - DID of the user claiming
   * @returns Created claim request
   *
   * @remarks
   * Implements "import on demand" - only imports the eprint when
   * a user actually wants to claim it. This reduces storage and API load.
   *
   * Flow:
   * 1. Check if already imported -> use existing import
   * 2. If not imported -> fetch from source and import
   * 3. Start claim request
   *
   * @throws NotFoundError if eprint cannot be found in source
   * @throws ValidationError if source does not support search
   */
  async startClaimFromExternal(
    source: ImportSource,
    externalId: string,
    claimantDid: string
  ): Promise<ClaimRequest> {
    // Check if already imported
    let imported = await this.importService.get(source, externalId);

    if (!imported) {
      // Need to fetch and import on demand
      if (!this.pluginManager) {
        throw new ValidationError(
          'Plugin manager not configured, cannot import from external source',
          'source',
          'plugin_unavailable'
        );
      }

      // Find the searchable plugin for this source
      const pluginId = this.getPluginIdForSource(source);
      if (!pluginId) {
        throw new ValidationError(
          `No plugin configured for source: ${source}`,
          'source',
          'plugin_not_found'
        );
      }

      const plugin = this.pluginManager.getPlugin(pluginId);
      if (!plugin || !isSearchablePlugin(plugin)) {
        throw new ValidationError(
          `Source ${source} does not support on-demand import`,
          'source',
          'source_not_searchable'
        );
      }

      // Fetch the eprint by external ID
      const results = await plugin.search({ externalId, limit: 1 });
      if (results.length === 0) {
        throw new NotFoundError('ExternalEprint', `${source}:${externalId}`);
      }

      const eprint = results[0];
      if (!eprint) {
        throw new NotFoundError('ExternalEprint', `${source}:${externalId}`);
      }

      // Import the eprint
      imported = await this.importService.create({
        source,
        externalId: eprint.externalId,
        externalUrl: eprint.url,
        title: eprint.title,
        abstract: eprint.abstract,
        authors: eprint.authors,
        publicationDate: eprint.publicationDate,
        doi: eprint.doi,
        pdfUrl: eprint.pdfUrl,
        categories: eprint.categories,
        importedByPlugin: pluginId,
        metadata: eprint.metadata,
      });

      this.logger.info('Imported eprint on demand', {
        source,
        externalId,
        importId: imported.id,
      });
    }

    // Start the claim
    return this.startClaim(imported.id, claimantDid);
  }

  /**
   * Gets or imports an eprint from an external source.
   *
   * @param source - External source
   * @param externalId - Source-specific identifier
   * @returns Imported eprint
   *
   * @remarks
   * Implements "import on demand" - only imports the eprint when
   * a user actually wants to claim it. This reduces storage and API load.
   *
   * Flow:
   * 1. Check if already imported -> return existing import
   * 2. If not imported -> fetch from source and import
   *
   * @throws NotFoundError if eprint cannot be found in source
   * @throws ValidationError if source does not support search
   */
  async getOrImportFromExternal(source: ImportSource, externalId: string): Promise<ImportedEprint> {
    // Check if already imported
    const existing = await this.importService.get(source, externalId);
    if (existing) {
      return existing;
    }

    // Need to fetch and import on demand
    if (!this.pluginManager) {
      throw new ValidationError(
        'Plugin manager not configured, cannot import from external source',
        'source',
        'plugin_unavailable'
      );
    }

    // Find the searchable plugin for this source
    const pluginId = this.getPluginIdForSource(source);
    if (!pluginId) {
      throw new ValidationError(
        `No plugin configured for source: ${source}`,
        'source',
        'plugin_not_found'
      );
    }

    const plugin = this.pluginManager.getPlugin(pluginId);
    if (!plugin || !isSearchablePlugin(plugin)) {
      throw new ValidationError(
        `Source ${source} does not support on-demand import`,
        'source',
        'source_not_searchable'
      );
    }

    // Fetch the eprint by external ID
    const results = await plugin.search({ externalId, limit: 1 });
    if (results.length === 0) {
      throw new NotFoundError('ExternalEprint', `${source}:${externalId}`);
    }

    const eprint = results[0];
    if (!eprint) {
      throw new NotFoundError('ExternalEprint', `${source}:${externalId}`);
    }

    // Import the eprint
    const imported = await this.importService.create({
      source,
      externalId: eprint.externalId,
      externalUrl: eprint.url,
      title: eprint.title,
      abstract: eprint.abstract,
      authors: eprint.authors,
      publicationDate: eprint.publicationDate,
      doi: eprint.doi,
      pdfUrl: eprint.pdfUrl,
      categories: eprint.categories,
      importedByPlugin: pluginId,
      metadata: eprint.metadata,
    });

    this.logger.info('Imported eprint on demand', {
      source,
      externalId,
      importId: imported.id,
    });

    return imported;
  }

  /**
   * Gets the plugin ID for a given import source.
   *
   * @param source - Import source
   * @returns Plugin ID or undefined if not found
   */
  private getPluginIdForSource(source: ImportSource): string | undefined {
    const sourceToPluginId: Partial<Record<ImportSource, string>> = {
      arxiv: 'pub.chive.plugin.arxiv',
      openreview: 'pub.chive.plugin.openreview',
      psyarxiv: 'pub.chive.plugin.psyarxiv',
      lingbuzz: 'pub.chive.plugin.lingbuzz',
      semanticsarchive: 'pub.chive.plugin.semanticsarchive',
    };
    return sourceToPluginId[source];
  }

  /**
   * Gets the import source for a given plugin ID.
   *
   * @param pluginId - Plugin ID
   * @returns Import source or undefined if not found
   */
  private getPluginSource(pluginId: string): ImportSource | undefined {
    const pluginIdToSource: Record<string, ImportSource> = {
      'pub.chive.plugin.arxiv': 'arxiv',
      'pub.chive.plugin.openreview': 'openreview',
      'pub.chive.plugin.psyarxiv': 'psyarxiv',
      'pub.chive.plugin.lingbuzz': 'lingbuzz',
      'pub.chive.plugin.semanticsarchive': 'semanticsarchive',
    };
    return pluginIdToSource[pluginId];
  }

  /**
   * Converts an ImportedEprint to ExternalEprint format.
   */
  private importedEprintToExternal(imported: ImportedEprint): ExternalEprint {
    return {
      externalId: imported.externalId,
      url: imported.url,
      title: imported.title,
      abstract: imported.abstract,
      authors: imported.authors,
      publicationDate: imported.publicationDate,
      doi: imported.doi,
      pdfUrl: imported.pdfUrl,
      categories: imported.categories,
      license: imported.license,
      version: imported.version,
      metadata: imported.metadata,
    };
  }

  /**
   * Executes a promise with timeout.
   *
   * @param promise - Promise to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param errorMessage - Error message on timeout
   * @returns Promise result
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Gets claim by import and claimant.
   */
  private async getClaimByImportAndClaimant(
    importId: number,
    claimantDid: string
  ): Promise<ClaimRequest | null> {
    const result = await this.db.query<ClaimRequestRow>(
      `SELECT * FROM claim_requests
       WHERE import_id = $1 AND claimant_did = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [importId, claimantDid]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.rowToClaimRequest(row);
  }

  /**
   * Converts database row to ClaimRequest.
   */
  private rowToClaimRequest(row: ClaimRequestRow): ClaimRequest {
    return {
      id: row.id,
      importId: row.import_id,
      claimantDid: row.claimant_did,
      status: row.status as ClaimStatus,
      canonicalUri: row.canonical_uri ?? undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      reviewedBy: row.reviewed_by_did ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
    };
  }

  // ============================================================
  // Evidence Collection Methods
  // ============================================================

  /**
   * Gets user profile for claim verification.
   *
   * @param did - User DID
   * @returns User profile with linked identities
   *
   * @private
   */
  private async getUserProfile(did: string): Promise<UserProfile | null> {
    try {
      // Resolve DID to get handle from alsoKnownAs
      const didDocument = await this.identity.resolveDID(did as DID);
      if (!didDocument) {
        return null;
      }

      // Extract handle from alsoKnownAs (format: "at://handle")
      const alsoKnownAs = didDocument.alsoKnownAs?.[0];
      const handle = alsoKnownAs?.replace('at://', '') ?? did;

      // Get profile data from user's PDS (via XRPC)
      const pdsEndpoint = await this.identity.getPDSEndpoint(did as DID);
      if (!pdsEndpoint) {
        return { did, handle };
      }

      // Fetch both Bluesky and Chive profiles in parallel
      const [bskyResponse, chiveResponse] = await Promise.all([
        fetch(
          `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=app.bsky.actor.profile&rkey=self`
        ).catch(() => null),
        fetch(
          `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=pub.chive.actor.profile&rkey=self`
        ).catch(() => null),
      ]);

      // Parse Bluesky profile
      let displayName: string | undefined;
      let bskyOrcid: string | undefined;
      let bskyS2Id: string | undefined;

      if (bskyResponse?.ok) {
        const bskyRecord = (await bskyResponse.json()) as {
          value?: {
            displayName?: string;
            description?: string;
          };
        };
        displayName = bskyRecord.value?.displayName;

        // Extract linked identities from profile description
        const description = bskyRecord.value?.description ?? '';
        const orcidMatch = /orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i.exec(description);
        const s2Match = /semanticscholar\.org\/author\/(\d+)/i.exec(description);
        bskyOrcid = orcidMatch?.[1];
        bskyS2Id = s2Match?.[1];
      }

      // Parse Chive academic profile (with structured affiliation/keyword types)
      interface ChiveProfileRaw {
        displayName?: string;
        bio?: string;
        orcid?: string;
        affiliations?: { name: string; rorId?: string }[];
        nameVariants?: string[];
        previousAffiliations?: { name: string; rorId?: string }[];
        researchKeywords?: { label: string; fastId?: string; wikidataId?: string }[];
        semanticScholarId?: string;
        openAlexId?: string;
        googleScholarId?: string;
        arxivAuthorId?: string;
        openReviewId?: string;
        dblpId?: string;
        scopusAuthorId?: string;
      }

      let chiveProfileRaw: ChiveProfileRaw = {};

      if (chiveResponse?.ok) {
        const chiveRecord = (await chiveResponse.json()) as {
          value?: ChiveProfileRaw;
        };
        chiveProfileRaw = chiveRecord.value ?? {};
      }

      // Extract string values from structured types for matching logic
      const affiliationNames = chiveProfileRaw.affiliations?.map((a) => a.name);
      const previousAffiliationNames = chiveProfileRaw.previousAffiliations?.map((a) => a.name);
      const keywordLabels = chiveProfileRaw.researchKeywords?.map((k) => k.label);

      // Merge profiles, preferring Chive profile data where available
      return {
        did,
        handle,
        displayName: chiveProfileRaw.displayName ?? displayName,
        orcid: chiveProfileRaw.orcid ?? bskyOrcid,
        semanticScholarId: chiveProfileRaw.semanticScholarId ?? bskyS2Id,
        openAlexId: chiveProfileRaw.openAlexId,
        googleScholarId: chiveProfileRaw.googleScholarId,
        arxivAuthorId: chiveProfileRaw.arxivAuthorId,
        openReviewId: chiveProfileRaw.openReviewId,
        dblpId: chiveProfileRaw.dblpId,
        scopusAuthorId: chiveProfileRaw.scopusAuthorId,
        nameVariants: chiveProfileRaw.nameVariants,
        affiliations: affiliationNames,
        previousAffiliations: previousAffiliationNames,
        researchKeywords: keywordLabels,
      };
    } catch (error) {
      this.logger.warn('Failed to get user profile', { did, error });
      return null;
    }
  }

  /**
   * Token-based name matching that compares individual name tokens.
   *
   * Unlike Dice coefficient bigrams, this method avoids false positives
   * from partial string overlaps (e.g., "White" matching "Whitehead").
   * Tokens shorter than 2 characters are filtered out to ignore initials.
   *
   * @param userName - User's name to match
   * @param paperAuthorName - Author name from the paper
   * @returns Score (0-30) and match type classification
   *
   * @private
   */
  private calculateTokenNameMatch(
    userName: string,
    paperAuthorName: string
  ): { score: number; matchType: 'exact' | 'partial' | 'single' | 'none' } {
    const normalize = (s: string): string => s.toLowerCase().trim();
    const userTokens = normalize(userName)
      .split(/\s+/)
      .filter((t) => t.length > 1);
    const paperTokens = normalize(paperAuthorName)
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (userTokens.length === 0 || paperTokens.length === 0) {
      return { score: 0, matchType: 'none' };
    }

    const matchingTokens = userTokens.filter((ut) => paperTokens.some((pt) => pt === ut));
    const matchCount = matchingTokens.length;
    const coverage = matchCount / Math.max(userTokens.length, paperTokens.length);

    // Exact: all tokens present (any order)
    if (matchCount === userTokens.length && matchCount === paperTokens.length) {
      return { score: 30, matchType: 'exact' };
    }
    // Partial: >= 2 matching tokens AND >= 50% coverage
    if (matchCount >= 2 && coverage >= 0.5) {
      return { score: 15, matchType: 'partial' };
    }
    // Single token match
    if (matchCount >= 1) {
      return { score: 5, matchType: 'single' };
    }

    return { score: 0, matchType: 'none' };
  }

  /**
   * Fetches topic and co-author context from a user's previously claimed papers.
   *
   * @param userDid - DID of the user
   * @returns Aggregated concepts, topics, keywords, and co-author names
   *
   * @remarks
   * This data is used as a content overlap signal when scoring paper
   * suggestions. If the user has no approved claims or the query fails,
   * empty arrays are returned so that scoring degrades gracefully.
   *
   * @private
   */
  private async getUserClaimedTopics(userDid: string): Promise<{
    concepts: string[];
    topics: string[];
    keywords: string[];
    coauthorNames: string[];
  }> {
    const result = {
      concepts: [] as string[],
      topics: [] as string[],
      keywords: [] as string[],
      coauthorNames: [] as string[],
    };

    try {
      // Get canonical URIs for the user's approved claims
      const claimsResult = await this.db.query<{
        canonical_uri: string | null;
      }>(
        `SELECT ie.canonical_uri
         FROM claim_requests cr
         JOIN imported_eprints ie ON cr.import_id = ie.id
         WHERE cr.claimant_did = $1
           AND cr.status = 'approved'
           AND ie.canonical_uri IS NOT NULL`,
        [userDid]
      );

      if (claimsResult.rows.length === 0) return result;

      const uris = claimsResult.rows
        .map((r) => r.canonical_uri)
        .filter((u): u is string => u !== null);

      if (uris.length === 0) return result;

      // Get enrichment data (concepts + topics) for claimed papers
      const enrichmentResult = await this.db.query<{
        concepts: unknown;
        topics: unknown;
      }>(`SELECT concepts, topics FROM eprint_enrichment WHERE uri = ANY($1)`, [uris]);

      for (const row of enrichmentResult.rows) {
        if (row.concepts) {
          const concepts =
            typeof row.concepts === 'string'
              ? (JSON.parse(row.concepts) as { display_name?: string }[])
              : (row.concepts as { display_name?: string }[]);
          for (const c of concepts) {
            if (c.display_name && !result.concepts.includes(c.display_name)) {
              result.concepts.push(c.display_name);
            }
          }
        }
        if (row.topics) {
          const topics =
            typeof row.topics === 'string'
              ? (JSON.parse(row.topics) as { display_name?: string }[])
              : (row.topics as { display_name?: string }[]);
          for (const t of topics) {
            if (t.display_name && !result.topics.includes(t.display_name)) {
              result.topics.push(t.display_name);
            }
          }
        }
      }

      // Get keywords and co-author names from claimed eprints
      const eprintsResult = await this.db.query<{
        keywords: unknown;
        authors: unknown;
      }>(`SELECT keywords, authors FROM eprints_index WHERE uri = ANY($1)`, [uris]);

      for (const row of eprintsResult.rows) {
        if (row.keywords) {
          const kws = Array.isArray(row.keywords)
            ? (row.keywords as unknown[])
            : typeof row.keywords === 'string'
              ? (JSON.parse(row.keywords) as unknown[])
              : [];
          for (const kw of kws) {
            const kwStr = typeof kw === 'string' ? kw : '';
            if (kwStr && !result.keywords.includes(kwStr.toLowerCase())) {
              result.keywords.push(kwStr.toLowerCase());
            }
          }
        }
        if (row.authors) {
          const authors = Array.isArray(row.authors)
            ? (row.authors as { name?: string; displayName?: string; did?: string }[])
            : typeof row.authors === 'string'
              ? (JSON.parse(row.authors) as {
                  name?: string;
                  displayName?: string;
                  did?: string;
                }[])
              : [];
          for (const a of authors) {
            const name = a.name ?? a.displayName ?? '';
            if (name && a.did !== userDid && !result.coauthorNames.includes(name.toLowerCase())) {
              result.coauthorNames.push(name.toLowerCase());
            }
          }
        }
      }
    } catch (error) {
      // Log but do not fail; topics are a bonus signal
      this.logger.warn('Failed to fetch user claimed topics', { userDid, error });
    }

    return result;
  }
}
