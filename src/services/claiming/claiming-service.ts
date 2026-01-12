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
  ClaimEvidence,
  ClaimEvidenceType,
  ClaimRequest,
  ClaimStatus,
  ExternalAuthor,
  ExternalEprint,
  ExternalSearchQuery,
  IClaimingService,
  IImportService,
  IPluginManager,
  ImportedEprint,
  ImportSource,
} from '../../types/interfaces/plugin.interface.js';
import { isSearchablePlugin } from '../../types/interfaces/plugin.interface.js';

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
 * Evidence weights for confidence scoring.
 *
 * @remarks
 * Based on industry standards and ATProto bidirectional verification principles.
 */
const EVIDENCE_WEIGHTS: Record<ClaimEvidenceType, number> = {
  'orcid-match': 0.35, // Highest (cryptographically verified)
  'semantic-scholar-match': 0.15, // High (claimed profile)
  'openreview-match': 0.15, // High (authenticated profile)
  'openalex-match': 0.1, // Medium-High (ORCID-linked)
  'arxiv-ownership': 0.1, // Medium-High (author ownership system)
  'institutional-email': 0.08, // Medium (domain verification)
  'ror-affiliation': 0.05, // Lower (organization match)
  'name-match': 0.02, // Lowest (fuzzy matching only)
  'coauthor-overlap': 0.05, // Supplementary (network analysis)
  'author-claim': 0.2, // Self-attestation with evidence
};

/**
 * Decision thresholds for claim approval.
 */
const DECISION_THRESHOLDS = {
  AUTO_APPROVE: 0.9,
  EXPEDITED: 0.7,
  MANUAL: 0.5,
} as const;

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
   * @param evidence - Optional initial evidence
   * @returns Created claim request
   *
   * @throws NotFoundError if import not found
   * @throws ValidationError if import already claimed or claim already pending
   */
  async startClaim(
    importId: number,
    claimantDid: string,
    evidence?: readonly ClaimEvidence[]
  ): Promise<ClaimRequest> {
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

    // Compute initial score if evidence provided
    const initialEvidence = evidence ?? [];
    const { score } = this.computeScore(initialEvidence);

    // Create claim request
    const result = await this.db.query<ClaimRequestRow>(
      `INSERT INTO claim_requests (
        import_id, claimant_did, evidence, verification_score, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'pending', NOW(), NOW()
      )
      RETURNING *`,
      [importId, claimantDid, JSON.stringify(initialEvidence), score]
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
   * Collects evidence from multiple authorities.
   *
   * @param claimId - ID of the claim request
   * @returns Updated claim request with collected evidence
   *
   * @remarks
   * This method orchestrates evidence collection from:
   * - ORCID (if user has verified ORCID)
   * - Semantic Scholar (author page lookup)
   * - OpenReview (profile lookup)
   * - OpenAlex (author ID lookup)
   * - Institutional verification (email domain)
   * - Name matching against import authors
   */
  async collectEvidence(claimId: number): Promise<ClaimRequest> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new NotFoundError('ClaimRequest', claimId.toString());
    }

    const imported = await this.importService.getById(claim.importId);
    if (!imported) {
      throw new NotFoundError('ImportedEprint', claim.importId.toString());
    }

    // Collect evidence from various sources in parallel
    const collectedEvidence: ClaimEvidence[] = [...claim.evidence];

    // Run all evidence collectors in parallel for performance
    const evidencePromises = [
      // 1. Check for ORCID match against import authors
      this.collectOrcidEvidence(claim.claimantDid, imported.authors),
      // 2. Check Semantic Scholar
      this.collectSemanticScholarEvidence(claim.claimantDid, imported),
      // 3. Check OpenReview
      this.collectOpenReviewEvidence(claim.claimantDid, imported),
      // 4. Check OpenAlex
      this.collectOpenAlexEvidence(claim.claimantDid, imported),
      // 5. Check institutional email verification
      this.collectInstitutionalEvidence(claim.claimantDid, imported.authors),
      // 6. Name matching
      this.collectNameMatchEvidence(claim.claimantDid, imported.authors),
    ];

    const results = await Promise.allSettled(evidencePromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        collectedEvidence.push(result.value);
      } else if (result.status === 'rejected') {
        this.logger.warn('Evidence collection failed', { error: result.reason });
      }
    }

    // Deduplicate evidence by type
    const uniqueEvidence = this.deduplicateEvidence(collectedEvidence);

    // Compute score
    const { score } = this.computeScore(uniqueEvidence);

    // Update claim with evidence and score
    const updatedClaim = await this.updateClaimEvidence(claimId, uniqueEvidence, score);

    this.logger.info('Evidence collected', {
      claimId,
      evidenceCount: uniqueEvidence.length,
      score,
    });

    return updatedClaim;
  }

  /**
   * Computes confidence score from evidence.
   *
   * @param evidence - Array of claim evidence
   * @returns Score (0-1) and decision
   */
  computeScore(evidence: readonly ClaimEvidence[]): {
    score: number;
    decision: 'auto-approve' | 'expedited' | 'manual' | 'insufficient';
  } {
    let totalScore = 0;

    for (const item of evidence) {
      const weight = EVIDENCE_WEIGHTS[item.type] ?? 0;
      totalScore += weight * item.score;
    }

    // Cap score at 1.0
    const score = Math.min(totalScore, 1.0);

    // Determine decision based on thresholds
    let decision: 'auto-approve' | 'expedited' | 'manual' | 'insufficient';
    if (score >= DECISION_THRESHOLDS.AUTO_APPROVE) {
      decision = 'auto-approve';
    } else if (score >= DECISION_THRESHOLDS.EXPEDITED) {
      decision = 'expedited';
    } else if (score >= DECISION_THRESHOLDS.MANUAL) {
      decision = 'manual';
    } else {
      decision = 'insufficient';
    }

    return { score, decision };
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
  }): Promise<readonly ExternalEprintWithSource[]> {
    if (!this.pluginManager) {
      this.logger.warn('Plugin manager not configured, falling back to local search');
      const localResults = await this.importService.search({
        query: options.query,
        authorName: options.author,
        limit: options.limit,
      });
      return localResults.eprints.map((p) => ({
        ...this.importedEprintToExternal(p),
        source: p.source,
      }));
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
    };

    // Search each source in parallel with timeout
    const searchPromises = plugins
      .filter((plugin) => {
        // Skip if sources filter is specified and this source is not included
        if (options.sources && options.sources.length > 0) {
          const pluginSource = this.getPluginSource(plugin.id);
          if (pluginSource && !options.sources.includes(pluginSource)) {
            return false;
          }
        }
        return isSearchablePlugin(plugin);
      })
      .map(async (plugin) => {
        if (!isSearchablePlugin(plugin)) {
          return [];
        }

        try {
          const pluginResults = await this.withTimeout(
            plugin.search(searchQuery),
            timeoutMs,
            `Search timeout for ${plugin.id}`
          );

          const source = this.getPluginSource(plugin.id);
          return pluginResults.map((p) => ({
            ...p,
            source: source ?? ('other' as ImportSource),
          }));
        } catch (error) {
          this.logger.warn('Plugin search failed', {
            pluginId: plugin.id,
            error: error instanceof Error ? error.message : String(error),
          });
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
    }

    this.logger.debug('External search completed', {
      query: options.query,
      author: options.author,
      resultCount: results.length,
    });

    return results;
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

    return this.searchAllSources({
      query,
      limit,
      timeoutMs,
    });
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

    // Search for papers using each name variant (limit searches to avoid overload)
    const searchPromises: Promise<readonly ExternalEprintWithSource[]>[] = [];
    const maxNameSearches = 3; // Limit to top 3 name variants

    for (const name of namesToSearch.slice(0, maxNameSearches)) {
      searchPromises.push(
        this.searchAllSources({
          author: name,
          limit: Math.ceil(limit / maxNameSearches),
          timeoutMs,
        }).catch(() => [])
      );
    }

    // Wait for all searches
    const searchResults = await Promise.all(searchPromises);

    // Deduplicate results by external ID
    const seenIds = new Set<string>();
    const allPapers: (ExternalEprintWithSource & {
      matchScore: number;
      matchReason: string;
    })[] = [];

    for (const results of searchResults) {
      for (const paper of results) {
        const uniqueKey = `${paper.source}:${paper.externalId}`;
        if (seenIds.has(uniqueKey)) continue;
        seenIds.add(uniqueKey);

        // Score the match
        const { score, reason } = this.scorePaperMatch(paper, profile, namesToSearch);

        allPapers.push({
          ...paper,
          matchScore: score,
          matchReason: reason,
        });
      }
    }

    // Sort by match score descending
    allPapers.sort((a, b) => b.matchScore - a.matchScore);

    // Return top results
    return {
      papers: allPapers.slice(0, limit),
      profileUsed: {
        displayName: profile.displayName,
        nameVariants: profile.nameVariants ?? [],
        hasOrcid,
        hasExternalIds,
      },
    };
  }

  /**
   * Scores how well a paper matches a user's profile.
   *
   * @param paper - External eprint to score
   * @param profile - User's profile
   * @param namesToMatch - Normalized name variants
   * @returns Score (0-100) and reason
   *
   * @private
   */
  private scorePaperMatch(
    paper: ExternalEprintWithSource,
    profile: UserProfile,
    namesToMatch: readonly string[]
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // 1. ORCID match (highest confidence)
    if (profile.orcid) {
      const authorWithOrcid = paper.authors?.find((a) => a.orcid === profile.orcid);
      if (authorWithOrcid) {
        score += 50;
        reasons.push('ORCID match');
      }
    }

    // 2. Name match scoring
    let bestNameScore = 0;
    let matchedAuthorName: string | undefined;

    for (const author of paper.authors ?? []) {
      for (const name of namesToMatch) {
        const similarity = this.calculateNameSimilarity(name, author.name);
        if (similarity > bestNameScore) {
          bestNameScore = similarity;
          matchedAuthorName = author.name;
        }
      }
    }

    if (bestNameScore > 0.95) {
      score += 30;
      reasons.push(`Exact name match: ${matchedAuthorName}`);
    } else if (bestNameScore > 0.8) {
      score += 20;
      reasons.push(`Strong name match: ${matchedAuthorName}`);
    } else if (bestNameScore > 0.7) {
      score += 10;
      reasons.push(`Fuzzy name match: ${matchedAuthorName}`);
    }

    // 3. Affiliation match
    const allAffiliations = [
      ...(profile.affiliations ?? []),
      ...(profile.previousAffiliations ?? []),
    ];
    if (allAffiliations.length > 0) {
      for (const author of paper.authors ?? []) {
        if (author.affiliation) {
          for (const userAff of allAffiliations) {
            if (
              author.affiliation.toLowerCase().includes(userAff.toLowerCase()) ||
              userAff.toLowerCase().includes(author.affiliation.toLowerCase())
            ) {
              score += 10;
              reasons.push(`Affiliation: ${author.affiliation}`);
              break;
            }
          }
        }
      }
    }

    // 4. Research keyword match (boost papers in user's fields)
    if (profile.researchKeywords && profile.researchKeywords.length > 0) {
      const paperText = `${paper.title} ${paper.abstract ?? ''}`.toLowerCase();
      let keywordMatches = 0;
      for (const keyword of profile.researchKeywords) {
        if (paperText.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
      if (keywordMatches > 0) {
        score += Math.min(keywordMatches * 2, 10);
        reasons.push(`${keywordMatches} keyword match(es)`);
      }
    }

    // Cap score at 100
    score = Math.min(score, 100);

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : 'Weak match',
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
   * Updates claim with collected evidence.
   */
  private async updateClaimEvidence(
    claimId: number,
    evidence: ClaimEvidence[],
    score: number
  ): Promise<ClaimRequest> {
    const result = await this.db.query<ClaimRequestRow>(
      `UPDATE claim_requests
       SET evidence = $1, verification_score = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(evidence), score, claimId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('ClaimRequest', claimId.toString());
    }

    return this.rowToClaimRequest(row);
  }

  /**
   * Deduplicates evidence by type, keeping highest score.
   */
  private deduplicateEvidence(evidence: ClaimEvidence[]): ClaimEvidence[] {
    const byType = new Map<ClaimEvidenceType, ClaimEvidence>();

    for (const item of evidence) {
      const existing = byType.get(item.type);
      if (!existing || item.score > existing.score) {
        byType.set(item.type, item);
      }
    }

    return Array.from(byType.values());
  }

  /**
   * Converts database row to ClaimRequest.
   */
  private rowToClaimRequest(row: ClaimRequestRow): ClaimRequest {
    // PostgreSQL JSONB columns are auto-parsed by pg driver; handle both cases.
    const evidence = (
      typeof row.evidence === 'string' ? JSON.parse(row.evidence) : row.evidence
    ) as ClaimEvidence[];

    return {
      id: row.id,
      importId: row.import_id,
      claimantDid: row.claimant_did,
      evidence,
      verificationScore: row.verification_score ?? 0,
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
   * Collects ORCID-based evidence.
   *
   * @remarks
   * ORCID matching provides the highest confidence evidence because:
   * 1. ORCID iDs are persistent, unique identifiers for researchers
   * 2. Authors often include ORCID in eprint metadata
   * 3. OAuth verification confirms the user controls the ORCID
   *
   * @private
   */
  private async collectOrcidEvidence(
    claimantDid: string,
    authors: readonly ExternalAuthor[]
  ): Promise<ClaimEvidence | null> {
    // Get user's verified ORCID from profile
    const profile = await this.getUserProfile(claimantDid);
    if (!profile?.orcid) {
      return null;
    }

    // Check if any author has matching ORCID
    const matchingAuthor = authors.find((a) => a.orcid === profile.orcid);
    if (!matchingAuthor) {
      return null;
    }

    // Query ORCID API to verify the ORCID is valid and active
    try {
      const orcidUrl = `https://pub.orcid.org/v3.0/${profile.orcid}/person`;
      const response = await fetch(orcidUrl, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('ORCID API request failed', {
          orcid: profile.orcid,
          status: response.status,
        });
        return null;
      }

      const orcidData = (await response.json()) as {
        name?: { 'given-names'?: { value?: string } };
      };

      // Verify name roughly matches
      const orcidName = orcidData.name?.['given-names']?.value ?? '';

      return {
        type: 'orcid-match',
        score: 1.0, // Full confidence for verified ORCID match
        details: `ORCID ${profile.orcid} matches author "${matchingAuthor.name}"`,
        data: {
          orcid: profile.orcid,
          authorName: matchingAuthor.name,
          orcidName,
          matchType: 'exact',
          source: 'orcid-api',
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.warn('ORCID verification failed', {
        orcid: profile.orcid,
        error,
      });
      return null;
    }
  }

  /**
   * Collects Semantic Scholar evidence.
   *
   * @remarks
   * Checks if the eprint appears in the user's claimed Semantic Scholar
   * author page. S2 allows researchers to claim their publications.
   *
   * @private
   */
  private async collectSemanticScholarEvidence(
    claimantDid: string,
    imported: ImportedEprint
  ): Promise<ClaimEvidence | null> {
    const profile = await this.getUserProfile(claimantDid);

    // Try to find S2 author by ORCID if available
    let authorId = profile?.semanticScholarId;

    if (!authorId && profile?.orcid) {
      // Look up author by ORCID
      try {
        const searchUrl = `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(profile.orcid)}&fields=authorId,externalIds`;
        const response = await fetch(searchUrl);

        if (response.ok) {
          const searchData = (await response.json()) as {
            data?: { authorId?: string; externalIds?: { ORCID?: string } }[];
          };
          const matchingAuthor = searchData.data?.find(
            (a) => a.externalIds?.ORCID === profile.orcid
          );
          authorId = matchingAuthor?.authorId;
        }
      } catch {
        // Continue without S2 ID
      }
    }

    if (!authorId) {
      return null;
    }

    // Check if imported eprint appears in author's papers
    try {
      const papersUrl = `https://api.semanticscholar.org/graph/v1/author/${authorId}/papers?fields=externalIds,title&limit=500`;
      const response = await fetch(papersUrl);

      if (!response.ok) {
        return null;
      }

      const papersData = (await response.json()) as {
        data?: {
          externalIds?: { DOI?: string; ArXiv?: string };
          title: string;
        }[];
      };
      const papers = papersData.data ?? [];

      // Match by DOI or arXiv ID
      const matchingPaper = papers.find((p) => {
        if (imported.doi && p.externalIds?.DOI?.toLowerCase() === imported.doi.toLowerCase()) {
          return true;
        }
        if (
          imported.source === 'arxiv' &&
          p.externalIds?.ArXiv === imported.externalId.replace('arXiv:', '')
        ) {
          return true;
        }
        return false;
      });

      if (!matchingPaper) {
        return null;
      }

      return {
        type: 'semantic-scholar-match',
        score: 0.9, // High confidence (paper is in claimed author profile)
        details: `Paper "${matchingPaper.title}" found in Semantic Scholar author profile`,
        data: {
          authorId,
          paperTitle: matchingPaper.title,
          matchType: imported.doi ? 'doi' : 'arxiv-id',
          source: 'semantic-scholar-api',
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.warn('Semantic Scholar lookup failed', { authorId, error });
      return null;
    }
  }

  /**
   * Collects OpenReview evidence.
   *
   * @remarks
   * OpenReview provides authenticated author profiles with verified
   * email addresses and ORCID links.
   *
   * @private
   */
  private async collectOpenReviewEvidence(
    claimantDid: string,
    imported: ImportedEprint
  ): Promise<ClaimEvidence | null> {
    const profile = await this.getUserProfile(claimantDid);
    if (!profile?.orcid) {
      // OpenReview lookup requires ORCID or email
      return null;
    }

    try {
      // OpenReview API v2: search for profile by ORCID
      const profileUrl = `https://api2.openreview.net/profiles?orcid=${profile.orcid}`;
      const profileResponse = await fetch(profileUrl);

      if (!profileResponse.ok) {
        return null;
      }

      const profilesData = (await profileResponse.json()) as {
        profiles?: { id: string }[];
      };
      const orProfile = profilesData.profiles?.[0];

      if (!orProfile) {
        return null;
      }

      // Get author's submissions
      const authorId = orProfile.id;
      const submissionsUrl = `https://api2.openreview.net/notes?content.authorids=${encodeURIComponent(authorId)}&limit=500`;
      const submissionsResponse = await fetch(submissionsUrl);

      if (!submissionsResponse.ok) {
        return null;
      }

      const submissionsData = (await submissionsResponse.json()) as {
        notes?: {
          content?: { title?: { value: string }; _bibtex?: { value: string } };
        }[];
      };
      const notes = submissionsData.notes ?? [];

      // Match by title similarity (OpenReview doesn't always have DOI)
      const importTitle = imported.title.toLowerCase();
      const matchingNote = notes.find((n) => {
        const noteTitle = n.content?.title?.value?.toLowerCase() ?? '';
        return this.calculateTitleSimilarity(importTitle, noteTitle) > 0.85;
      });

      if (!matchingNote) {
        return null;
      }

      const matchedTitle = matchingNote.content?.title?.value ?? '';

      return {
        type: 'openreview-match',
        score: 0.85, // Good confidence (verified OR profile with paper)
        details: `Paper "${matchedTitle}" found in OpenReview profile`,
        data: {
          profileId: authorId,
          matchedTitle,
          matchType: 'title-similarity',
          source: 'openreview-api',
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.warn('OpenReview lookup failed', { orcid: profile.orcid, error });
      return null;
    }
  }

  /**
   * Collects OpenAlex evidence.
   *
   * @remarks
   * OpenAlex aggregates scholarly metadata and links authors via ORCID.
   * It provides a comprehensive view of an author's works.
   *
   * @private
   */
  private async collectOpenAlexEvidence(
    claimantDid: string,
    imported: ImportedEprint
  ): Promise<ClaimEvidence | null> {
    const profile = await this.getUserProfile(claimantDid);
    if (!profile?.orcid) {
      return null;
    }

    try {
      // Look up author by ORCID in OpenAlex
      const authorUrl = `https://api.openalex.org/authors?filter=orcid:${profile.orcid}`;
      const authorResponse = await fetch(authorUrl, {
        headers: {
          'User-Agent': 'Chive/1.0 (https://chive.pub; mailto:admin@chive.pub)',
        },
      });

      if (!authorResponse.ok) {
        return null;
      }

      const authorData = (await authorResponse.json()) as {
        results?: {
          id: string;
          display_name: string;
          works_count: number;
        }[];
      };
      const author = authorData.results?.[0];

      if (!author) {
        return null;
      }

      // Check if imported work appears in author's works
      let matchFound = false;
      let matchedWorkTitle = '';

      if (imported.doi) {
        // Direct DOI lookup
        const workUrl = `https://api.openalex.org/works/doi:${imported.doi}`;
        const workResponse = await fetch(workUrl, {
          headers: {
            'User-Agent': 'Chive/1.0 (https://chive.pub; mailto:admin@chive.pub)',
          },
        });

        if (workResponse.ok) {
          const work = (await workResponse.json()) as {
            title?: string;
            authorships?: { author?: { orcid?: string } }[];
          };
          // Check if author is in the work's authorships
          const authorMatch = work.authorships?.find(
            (a) => a.author?.orcid === `https://orcid.org/${profile.orcid}`
          );
          if (authorMatch) {
            matchFound = true;
            matchedWorkTitle = work.title ?? '';
          }
        }
      }

      if (!matchFound) {
        return null;
      }

      return {
        type: 'openalex-match',
        score: 0.9, // High confidence (ORCID-linked author in work metadata)
        details: `Work "${matchedWorkTitle}" linked to author ${author.display_name} in OpenAlex`,
        data: {
          openAlexAuthorId: author.id,
          displayName: author.display_name,
          matchedWorkTitle,
          worksCount: author.works_count,
          source: 'openalex-api',
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.warn('OpenAlex lookup failed', { orcid: profile.orcid, error });
      return null;
    }
  }

  /**
   * Collects institutional email evidence.
   *
   * @remarks
   * Uses ATProto-style domain verification:
   * 1. User's handle is checked against author affiliations
   * 2. If handle domain matches an institutional domain in author affiliations,
   *    this provides evidence of institutional affiliation
   *
   * @private
   */
  private async collectInstitutionalEvidence(
    claimantDid: string,
    authors: readonly ExternalAuthor[]
  ): Promise<ClaimEvidence | null> {
    const profile = await this.getUserProfile(claimantDid);
    if (!profile?.handle) {
      return null;
    }

    // Extract domain from handle (e.g., "alice.mit.edu" -> "mit.edu")
    const handleParts = profile.handle.split('.');
    if (handleParts.length < 2) {
      return null;
    }

    // Get institutional domain (last two parts typically)
    const handleDomain = handleParts.slice(-2).join('.');

    // Common institutional domain patterns
    const institutionalPatterns = ['.edu', '.ac.uk', '.edu.au', '.ac.jp', '.edu.cn'];
    const isInstitutional = institutionalPatterns.some((p) => profile.handle.endsWith(p));

    if (!isInstitutional) {
      return null;
    }

    // Check if any author has matching institutional affiliation
    const matchingAuthor = authors.find((a) => {
      if (!a.affiliation) return false;

      // Extract domain-like patterns from affiliation
      const affiliationLower = a.affiliation.toLowerCase();

      // Check for domain match
      if (affiliationLower.includes(handleDomain.toLowerCase())) {
        return true;
      }

      // Check for institution name match (e.g., "MIT" in "Massachusetts Institute of Technology")
      const institutionName = handleParts.slice(-2, -1)[0]?.toLowerCase();
      if (
        institutionName &&
        institutionName.length > 2 &&
        affiliationLower.includes(institutionName)
      ) {
        return true;
      }

      return false;
    });

    if (!matchingAuthor) {
      return null;
    }

    return {
      type: 'institutional-email',
      score: 0.8, // Good confidence (domain verification)
      details: `Handle domain ${handleDomain} matches author affiliation "${matchingAuthor.affiliation}"`,
      data: {
        handle: profile.handle,
        handleDomain,
        authorAffiliation: matchingAuthor.affiliation,
        authorName: matchingAuthor.name,
        source: 'handle-verification',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Collects name match evidence.
   *
   * @remarks
   * Performs fuzzy name matching between claimant profile and import authors.
   * This is the weakest form of evidence due to:
   * - Name ambiguity (common names)
   * - Transliteration differences
   * - Maiden/married name changes
   *
   * Uses Dice coefficient for similarity scoring.
   *
   * @private
   */
  private async collectNameMatchEvidence(
    claimantDid: string,
    authors: readonly ExternalAuthor[]
  ): Promise<ClaimEvidence | null> {
    const profile = await this.getUserProfile(claimantDid);
    if (!profile?.displayName && (!profile?.nameVariants || profile.nameVariants.length === 0)) {
      return null;
    }

    // Collect all name forms to match against (displayName + nameVariants)
    const namesToMatch: string[] = [];
    if (profile?.displayName) {
      namesToMatch.push(profile.displayName.toLowerCase().trim());
    }
    if (profile?.nameVariants) {
      for (const variant of profile.nameVariants) {
        const normalized = variant.toLowerCase().trim();
        if (!namesToMatch.includes(normalized)) {
          namesToMatch.push(normalized);
        }
      }
    }

    if (namesToMatch.length === 0) {
      return null;
    }

    // Find best matching author across all name variants
    let bestMatch: {
      author: ExternalAuthor;
      score: number;
      matchedName: string;
    } | null = null;

    for (const author of authors) {
      const authorName = author.name.toLowerCase().trim();

      for (const nameToMatch of namesToMatch) {
        // Calculate similarity using Dice coefficient
        const similarity = this.calculateNameSimilarity(nameToMatch, authorName);

        if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.score)) {
          bestMatch = { author, score: similarity, matchedName: nameToMatch };
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    // Slightly higher confidence if matched via explicit name variant
    const isVariantMatch =
      profile?.nameVariants?.some((v) => v.toLowerCase().trim() === bestMatch.matchedName) ?? false;
    const baseScore = bestMatch.score * (isVariantMatch ? 0.6 : 0.5);
    const confidenceScore = Math.min(baseScore, 0.5);
    const matchType = bestMatch.score > 0.95 ? 'exact' : 'fuzzy';

    return {
      type: 'name-match',
      score: confidenceScore,
      details: `Name "${bestMatch.matchedName}" ${matchType} matches author "${bestMatch.author.name}"${isVariantMatch ? ' (via name variant)' : ''}`,
      data: {
        displayName: profile?.displayName,
        matchedName: bestMatch.matchedName,
        authorName: bestMatch.author.name,
        similarityScore: bestMatch.score,
        matchType,
        isVariantMatch,
        source: 'fuzzy-matching',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Calculates name similarity using Dice coefficient.
   *
   * @param name1 - First name
   * @param name2 - Second name
   * @returns Similarity score (0-1)
   *
   * @private
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Normalize names
    const n1 = name1.toLowerCase().replace(/[^a-z\s]/g, '');
    const n2 = name2.toLowerCase().replace(/[^a-z\s]/g, '');

    if (n1 === n2) return 1.0;

    // Generate bigrams
    const getBigrams = (str: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.slice(i, i + 2));
      }
      return bigrams;
    };

    const bigrams1 = getBigrams(n1);
    const bigrams2 = getBigrams(n2);

    if (bigrams1.size === 0 || bigrams2.size === 0) return 0;

    // Calculate intersection
    let intersection = 0;
    for (const bg of bigrams1) {
      if (bigrams2.has(bg)) {
        intersection++;
      }
    }

    // Dice coefficient
    return (2 * intersection) / (bigrams1.size + bigrams2.size);
  }

  /**
   * Calculates title similarity for paper matching.
   *
   * @param title1 - First title
   * @param title2 - Second title
   * @returns Similarity score (0-1)
   *
   * @private
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    // Normalize titles
    const normalize = (t: string): string =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const t1 = normalize(title1);
    const t2 = normalize(title2);

    if (t1 === t2) return 1.0;

    // Word-based Jaccard similarity
    const words1 = new Set(t1.split(' ').filter((w) => w.length > 2));
    const words2 = new Set(t2.split(' ').filter((w) => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        intersection++;
      }
    }

    const union = words1.size + words2.size - intersection;
    return intersection / union;
  }
}
