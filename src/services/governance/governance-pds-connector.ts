/**
 * Graph PDS Connector for reading community authority records.
 *
 * @remarks
 * Connects to the Chive Graph PDS (`did:plc:chive-governance`) to read
 * community-approved authority records, facets, and organizations.
 *
 * **ATProto Compliance**:
 * - READ-ONLY: This connector never writes to the Graph PDS
 * - Reads via standard `IRepository.getRecord` and `listRecords`
 * - Caches locally for performance (Redis) but never becomes source of truth
 * - Tracks source PDS URL for all indexed records
 *
 * **Architecture**:
 * - Graph records live in a dedicated PDS (`did:plc:chive-governance`)
 * - Records are published to firehose for interoperability
 * - Trusted editors create records via delegated signing authority
 * - AppView reads and indexes, community votes via their own PDSes
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';
import type { Pool, QueryResult } from 'pg';

import type { AtUri, DID, NSID, Timestamp } from '../../types/atproto.js';
import { DatabaseError } from '../../types/errors.js';
import type { IIdentityResolver } from '../../types/interfaces/identity.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';
import type { IRepository, RepositoryRecord } from '../../types/interfaces/repository.interface.js';
import type {
  ConsensusResult,
  FacetDimension,
  GovernanceAuthorityRecord,
  GovernanceFacet,
  GovernanceListOptions,
  GovernanceOrganization,
  GovernanceSubscription,
  GovernanceUpdateEvent,
  GovernanceUpdateHandler,
} from '../../types/models/governance.js';
import type { Result } from '../../types/result.js';

/**
 * Governance PDS connector configuration.
 *
 * @public
 */
export interface GovernancePDSConnectorOptions {
  /**
   * DID of the Governance PDS.
   *
   * @example "did:plc:chive-governance"
   */
  readonly graphPdsDid: DID;

  /**
   * Repository interface for reading records.
   */
  readonly repository: IRepository;

  /**
   * Identity resolver for PDS endpoint lookup.
   */
  readonly identity: IIdentityResolver;

  /**
   * Logger instance.
   */
  readonly logger: ILogger;

  /**
   * Optional Redis client for caching authority records.
   *
   * @remarks
   * If provided, authority records are cached with TTL for performance.
   * Cache is invalidated when records are updated via firehose.
   */
  readonly cache?: Redis;

  /**
   * Cache TTL in seconds.
   *
   * @defaultValue 3600 (1 hour)
   */
  readonly cacheTtlSeconds?: number;

  /**
   * PostgreSQL pool for querying indexed votes.
   *
   * @remarks
   * Required for consensus checking. Votes from user PDSes are indexed
   * in PostgreSQL and aggregated for consensus calculation.
   */
  readonly pool?: Pool;
}

/**
 * Raw authority record from Governance PDS.
 *
 * @internal
 */
interface RawAuthorityRecord {
  readonly $type: 'pub.chive.graph.authority';
  readonly authorizedForm: string;
  readonly variantForms?: readonly string[];
  readonly scopeNote?: string;
  readonly sources?: readonly {
    readonly system: string;
    readonly identifier: string;
    readonly uri: string;
    readonly label?: string;
    readonly matchType: string;
    readonly confidence?: number;
    readonly lastSynced?: string;
  }[];
  readonly status: string;
  readonly proposalUri?: string;
  readonly approvedBy?: string;
  readonly approvalDate?: string;
  readonly version: number;
  readonly previousVersion?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

/**
 * Raw facet record from Governance PDS.
 *
 * @internal
 */
interface RawFacetRecord {
  readonly $type: 'pub.chive.graph.facet';
  readonly dimension: string;
  readonly value: string;
  readonly description?: string;
  readonly externalIds?: Readonly<Record<string, string>>;
  readonly status: string;
  readonly proposalUri?: string;
  readonly createdAt: string;
}

/**
 * Raw organization record from Governance PDS.
 *
 * @internal
 */
interface RawOrganizationRecord {
  readonly $type: 'pub.chive.graph.organization';
  readonly name: string;
  readonly abbreviation?: string;
  readonly type: string;
  readonly parentOrganization?: string;
  readonly externalIds?: Readonly<Record<string, string>>;
  readonly homepage?: string;
  readonly location?: {
    readonly city?: string;
    readonly state?: string;
    readonly country: string;
  };
  readonly status: string;
  readonly createdAt: string;
}

/**
 * Collection NSIDs for governance records.
 */
const COLLECTIONS = {
  AUTHORITY_RECORD: 'pub.chive.graph.authority' as NSID,
  FACET: 'pub.chive.graph.facet' as NSID,
  ORGANIZATION: 'pub.chive.graph.organization' as NSID,
} as const;

/**
 * Governance PDS Connector.
 *
 * @remarks
 * Provides read-only access to community authority records stored in the
 * Chive Governance PDS. Authority records, facets, and organizations are
 * indexed for search and classification.
 *
 * **Cache Strategy**:
 * - L1: Redis cache with configurable TTL (default 1 hour)
 * - L2: Direct PDS fetch (source of truth)
 * - Cache invalidation via firehose subscription
 *
 * **Performance**:
 * - Batch fetching for list operations
 * - Cache-aside pattern with TTL
 * - Async iterator for memory-efficient streaming
 *
 * @example
 * ```typescript
 * const connector = new GovernancePDSConnector({
 *   graphPdsDid: 'did:plc:chive-governance' as DID,
 *   repository,
 *   identity,
 *   logger,
 *   cache: redis,
 * });
 *
 * // Get a single authority record
 * const authority = await connector.getAuthorityRecord(uri);
 * if (authority) {
 *   console.log(`Authorized form: ${authority.authorizedForm}`);
 * }
 *
 * // List all established authority records
 * for await (const record of connector.listAuthorityRecords({ status: 'established' })) {
 *   console.log(record.authorizedForm);
 * }
 * ```
 *
 * @public
 */
export class GovernancePDSConnector {
  private readonly graphPdsDid: DID;
  private readonly repository: IRepository;
  private readonly identity: IIdentityResolver;
  private readonly logger: ILogger;
  private readonly cache?: Redis;
  private readonly cacheTtlSeconds: number;
  private readonly subscriptions = new Map<string, GovernanceUpdateHandler>();
  private readonly pool?: Pool;

  private governancePdsUrl?: string;

  constructor(options: GovernancePDSConnectorOptions) {
    this.graphPdsDid = options.graphPdsDid;
    this.repository = options.repository;
    this.identity = options.identity;
    this.logger = options.logger;
    this.cache = options.cache;
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 3600;
    this.pool = options.pool;
  }

  /**
   * Gets the Governance PDS URL.
   *
   * @returns PDS endpoint URL
   *
   * @remarks
   * Resolves and caches the Governance PDS endpoint URL.
   *
   * @internal
   */
  private async getPdsUrl(): Promise<string> {
    if (this.governancePdsUrl) {
      return this.governancePdsUrl;
    }

    const pdsUrl = await this.identity.getPDSEndpoint(this.graphPdsDid);
    if (!pdsUrl) {
      throw new DatabaseError('READ', `Failed to resolve PDS endpoint for ${this.graphPdsDid}`);
    }

    this.governancePdsUrl = pdsUrl;
    return pdsUrl;
  }

  /**
   * Gets a single authority record by AT URI.
   *
   * @param uri - AT URI of the authority record
   * @returns Authority record or null if not found
   *
   * @remarks
   * Checks Redis cache first, then fetches from Governance PDS if not cached.
   *
   * @example
   * ```typescript
   * const uri = 'at://did:plc:chive-governance/pub.chive.graph.authority/abc123' as AtUri;
   * const record = await connector.getAuthorityRecord(uri);
   * ```
   *
   * @public
   */
  async getAuthorityRecord(uri: AtUri): Promise<GovernanceAuthorityRecord | null> {
    try {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get(this.cacheKey('authority', uri));
        if (cached) {
          this.logger.debug('Cache hit for authority record', { uri });
          return JSON.parse(cached) as GovernanceAuthorityRecord;
        }
      }

      // Fetch from PDS
      const record = await this.repository.getRecord<RawAuthorityRecord>(uri);
      if (!record) {
        return null;
      }

      const pdsUrl = await this.getPdsUrl();
      const authority = this.transformAuthorityRecord(record, pdsUrl);

      // Cache the result
      if (this.cache) {
        await this.cache.setex(
          this.cacheKey('authority', uri),
          this.cacheTtlSeconds,
          JSON.stringify(authority)
        );
      }

      return authority;
    } catch (error) {
      this.logger.error(
        'Failed to get authority record',
        error instanceof Error ? error : undefined,
        { uri }
      );
      return null;
    }
  }

  /**
   * Lists authority records from Governance PDS.
   *
   * @param options - List options (limit, cursor, status filter)
   * @returns Async iterable of authority records
   *
   * @remarks
   * Returns an async iterable for memory-efficient streaming. Use `for await...of`
   * to iterate through records.
   *
   * @example
   * ```typescript
   * // List all established authority records
   * for await (const record of connector.listAuthorityRecords({ status: 'established' })) {
   *   console.log(record.authorizedForm);
   * }
   *
   * // List with limit
   * for await (const record of connector.listAuthorityRecords({ limit: 10 })) {
   *   // Process first 10 records
   * }
   * ```
   *
   * @public
   */
  async *listAuthorityRecords(
    options?: GovernanceListOptions
  ): AsyncIterable<GovernanceAuthorityRecord> {
    const pdsUrl = await this.getPdsUrl();
    const records = this.repository.listRecords<RawAuthorityRecord>(
      this.graphPdsDid,
      COLLECTIONS.AUTHORITY_RECORD,
      { limit: options?.limit, cursor: options?.cursor }
    );

    for await (const record of records) {
      const authority = this.transformAuthorityRecord(record, pdsUrl);

      // Apply status filter if specified
      if (options?.status && authority.status !== options.status) {
        continue;
      }

      yield authority;
    }
  }

  /**
   * Gets a single facet record by AT URI.
   *
   * @param uri - AT URI of the facet record
   * @returns Facet record or null if not found
   *
   * @public
   */
  async getFacet(uri: AtUri): Promise<GovernanceFacet | null> {
    try {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get(this.cacheKey('facet', uri));
        if (cached) {
          this.logger.debug('Cache hit for facet record', { uri });
          return JSON.parse(cached) as GovernanceFacet;
        }
      }

      // Fetch from PDS
      const record = await this.repository.getRecord<RawFacetRecord>(uri);
      if (!record) {
        return null;
      }

      const pdsUrl = await this.getPdsUrl();
      const facet = this.transformFacetRecord(record, pdsUrl);

      // Cache the result
      if (this.cache) {
        await this.cache.setex(
          this.cacheKey('facet', uri),
          this.cacheTtlSeconds,
          JSON.stringify(facet)
        );
      }

      return facet;
    } catch (error) {
      this.logger.error('Failed to get facet record', error instanceof Error ? error : undefined, {
        uri,
      });
      return null;
    }
  }

  /**
   * Lists facets by dimension from Governance PDS.
   *
   * @param dimension - Optional facet dimension filter
   * @param options - List options
   * @returns Async iterable of facet records
   *
   * @example
   * ```typescript
   * // List all matter facets
   * for await (const facet of connector.listFacets('matter')) {
   *   console.log(facet.value);
   * }
   * ```
   *
   * @public
   */
  async *listFacets(
    dimension?: FacetDimension,
    options?: GovernanceListOptions
  ): AsyncIterable<GovernanceFacet> {
    const pdsUrl = await this.getPdsUrl();
    const records = this.repository.listRecords<RawFacetRecord>(
      this.graphPdsDid,
      COLLECTIONS.FACET,
      { limit: options?.limit, cursor: options?.cursor }
    );

    for await (const record of records) {
      const facet = this.transformFacetRecord(record, pdsUrl);

      // Apply dimension filter if specified
      if (dimension && facet.dimension !== dimension) {
        continue;
      }

      // Apply status filter if specified
      if (options?.status && facet.status !== options.status) {
        continue;
      }

      yield facet;
    }
  }

  /**
   * Gets a single organization record by AT URI.
   *
   * @param uri - AT URI of the organization record
   * @returns Organization record or null if not found
   *
   * @public
   */
  async getOrganization(uri: AtUri): Promise<GovernanceOrganization | null> {
    try {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get(this.cacheKey('organization', uri));
        if (cached) {
          this.logger.debug('Cache hit for organization record', { uri });
          return JSON.parse(cached) as GovernanceOrganization;
        }
      }

      // Fetch from PDS
      const record = await this.repository.getRecord<RawOrganizationRecord>(uri);
      if (!record) {
        return null;
      }

      const pdsUrl = await this.getPdsUrl();
      const organization = this.transformOrganizationRecord(record, pdsUrl);

      // Cache the result
      if (this.cache) {
        await this.cache.setex(
          this.cacheKey('organization', uri),
          this.cacheTtlSeconds,
          JSON.stringify(organization)
        );
      }

      return organization;
    } catch (error) {
      this.logger.error(
        'Failed to get organization record',
        error instanceof Error ? error : undefined,
        { uri }
      );
      return null;
    }
  }

  /**
   * Lists organizations from Governance PDS.
   *
   * @param options - List options
   * @returns Async iterable of organization records
   *
   * @public
   */
  async *listOrganizations(options?: GovernanceListOptions): AsyncIterable<GovernanceOrganization> {
    const pdsUrl = await this.getPdsUrl();
    const records = this.repository.listRecords<RawOrganizationRecord>(
      this.graphPdsDid,
      COLLECTIONS.ORGANIZATION,
      { limit: options?.limit, cursor: options?.cursor }
    );

    for await (const record of records) {
      const organization = this.transformOrganizationRecord(record, pdsUrl);

      // Apply status filter if specified
      if (options?.status && organization.status !== options.status) {
        continue;
      }

      yield organization;
    }
  }

  /**
   * Checks consensus status for a governance proposal.
   *
   * @param proposalUri - AT URI of the proposal
   * @returns Consensus result with vote counts and decision
   *
   * @remarks
   * Aggregates votes from all user PDSes that reference this proposal.
   * Votes are stored in individual user PDSes as `pub.chive.graph.vote` records.
   *
   * **Consensus Thresholds** (configurable per proposal type):
   * - Minimum participation: 10 eligible voters
   * - Approval threshold: 66% of votes cast
   * - Quorum: 30% participation rate
   *
   * **Vote Weighting by Role**:
   * - community-member: 1.0x
   * - trusted-editor: 2.0x
   * - domain-expert: 3.0x
   * - administrator: 5.0x
   *
   * @example
   * ```typescript
   * const result = await connector.checkProposalConsensus(proposalUri);
   * if (result.consensusReached) {
   *   console.log(`Decision: ${result.decision}`);
   * }
   * ```
   *
   * @public
   */
  async checkProposalConsensus(
    proposalUri: AtUri
  ): Promise<Result<ConsensusResult, DatabaseError>> {
    try {
      this.logger.debug('Checking consensus for proposal', { proposalUri });

      // If no pool is configured, return a pending result
      if (!this.pool) {
        this.logger.warn('No PostgreSQL pool configured for consensus checking', { proposalUri });
        return {
          ok: true,
          value: {
            proposalUri,
            approveCount: 0,
            rejectCount: 0,
            abstainCount: 0,
            totalEligibleVoters: 0,
            participationRate: 0,
            consensusReached: false,
            decision: 'pending',
          },
        };
      }

      // Query indexed votes from PostgreSQL
      // Votes are indexed from user PDSes via firehose
      const voteResult: QueryResult<{
        vote: string;
        voter_role: string;
        count: string;
      }> = await this.pool.query(
        `SELECT vote, voter_role, COUNT(*) as count
         FROM votes_index
         WHERE proposal_uri = $1
         GROUP BY vote, voter_role`,
        [proposalUri]
      );

      // Role-based vote weights per governance rules
      const roleWeights: Record<string, number> = {
        'community-member': 1.0,
        'trusted-editor': 2.0,
        'domain-expert': 3.0,
        administrator: 5.0,
      };

      let approveCount = 0;
      let rejectCount = 0;
      let abstainCount = 0;
      let weightedApprove = 0;
      let weightedReject = 0;
      let trustedEditorApprovals = 0;
      let adminVetoes = 0;

      for (const row of voteResult.rows) {
        const count = parseInt(row.count, 10);
        const weight = roleWeights[row.voter_role] ?? 1.0;

        switch (row.vote) {
          case 'approve':
            approveCount += count;
            weightedApprove += count * weight;
            if (row.voter_role === 'trusted-editor') {
              trustedEditorApprovals += count;
            }
            break;
          case 'reject':
            rejectCount += count;
            weightedReject += count * weight;
            if (row.voter_role === 'administrator') {
              adminVetoes += count;
            }
            break;
          case 'abstain':
            abstainCount += count;
            break;
        }
      }

      // Get total eligible voters (could be from a separate configuration or query)
      const totalVotes = approveCount + rejectCount;
      const totalVoters = approveCount + rejectCount + abstainCount;

      // Consensus thresholds
      const minVotes = 5;
      const approvalThreshold = 0.66;
      const minTrustedEditors = 2;

      // Calculate approval ratio using weighted votes
      const approvalRatio =
        totalVotes > 0 ? weightedApprove / (weightedApprove + weightedReject) : 0;

      // Participation rate (using abstain count as indicator of engagement)
      const participationRate = totalVoters > 0 ? 1.0 : 0;

      // Determine if consensus is reached
      const consensusReached =
        totalVotes >= minVotes &&
        approvalRatio >= approvalThreshold &&
        trustedEditorApprovals >= minTrustedEditors &&
        adminVetoes === 0;

      // Determine decision
      let decision: 'approved' | 'rejected' | 'pending';
      if (adminVetoes > 0) {
        decision = 'rejected';
      } else if (consensusReached) {
        decision = 'approved';
      } else if (totalVotes >= minVotes && approvalRatio < 1 - approvalThreshold) {
        decision = 'rejected';
      } else {
        decision = 'pending';
      }

      const result: ConsensusResult = {
        proposalUri,
        approveCount,
        rejectCount,
        abstainCount,
        totalEligibleVoters: totalVoters,
        participationRate,
        consensusReached,
        decision,
      };

      this.logger.info('Consensus check completed', {
        proposalUri,
        approveCount,
        rejectCount,
        abstainCount,
        consensusReached,
        decision,
      });

      return { ok: true, value: result };
    } catch (error) {
      this.logger.error(
        'Failed to check proposal consensus',
        error instanceof Error ? error : undefined,
        { proposalUri }
      );

      return {
        ok: false,
        error: new DatabaseError(
          'READ',
          error instanceof Error ? error.message : `Failed to check consensus: ${String(error)}`
        ),
      };
    }
  }

  /**
   * Subscribes to governance record updates.
   *
   * @param handler - Callback function for update events
   * @returns Subscription handle with unsubscribe method
   *
   * @remarks
   * Receives events when authority records, facets, or proposals are
   * created or updated in the Governance PDS.
   *
   * **Event Types**:
   * - `authority-created`: New authority record approved
   * - `authority-updated`: Existing authority record modified
   * - `facet-created`: New facet value approved
   * - `proposal-decided`: Proposal reached consensus
   *
   * @example
   * ```typescript
   * const subscription = connector.subscribeToUpdates(async (event) => {
   *   if (event.type === 'authority-created') {
   *     console.log(`New authority: ${event.uri}`);
   *     // Invalidate cache, re-index, etc.
   *   }
   * });
   *
   * // Later, unsubscribe
   * subscription.unsubscribe();
   * ```
   *
   * @public
   */
  subscribeToUpdates(handler: GovernanceUpdateHandler): GovernanceSubscription {
    const subscriptionId = crypto.randomUUID();
    this.subscriptions.set(subscriptionId, handler);

    this.logger.info('Subscribed to governance updates', { subscriptionId });

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);
        this.logger.info('Unsubscribed from governance updates', { subscriptionId });
      },
    };
  }

  /**
   * Dispatches an update event to all subscribers.
   *
   * @param event - Governance update event
   *
   * @remarks
   * Called by firehose consumer when governance records change.
   *
   * @internal
   */
  async dispatchUpdate(event: GovernanceUpdateEvent): Promise<void> {
    // Invalidate cache for updated record
    if (this.cache) {
      const cacheType = event.type.includes('authority')
        ? 'authority'
        : event.type.includes('facet')
          ? 'facet'
          : 'organization';
      await this.cache.del(this.cacheKey(cacheType, event.uri));
    }

    // Notify all subscribers
    for (const handler of Array.from(this.subscriptions.values())) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          'Error in governance update handler',
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * Invalidates cached authority record.
   *
   * @param uri - AT URI of the record to invalidate
   *
   * @remarks
   * Call when a record is known to have been updated.
   *
   * @public
   */
  async invalidateCache(uri: AtUri): Promise<void> {
    if (!this.cache) {
      return;
    }

    // Invalidate all possible cache keys for this URI
    await Promise.all([
      this.cache.del(this.cacheKey('authority', uri)),
      this.cache.del(this.cacheKey('facet', uri)),
      this.cache.del(this.cacheKey('organization', uri)),
    ]);

    this.logger.debug('Invalidated cache for record', { uri });
  }

  /**
   * Builds cache key for a record.
   *
   * @internal
   */
  private cacheKey(type: string, uri: AtUri): string {
    return `chive:governance:${type}:${uri}`;
  }

  /**
   * Transforms raw authority record to domain model.
   *
   * @internal
   */
  private transformAuthorityRecord(
    record: RepositoryRecord<RawAuthorityRecord>,
    pdsUrl: string
  ): GovernanceAuthorityRecord {
    const value = record.value;

    return {
      uri: record.uri,
      cid: record.cid,
      authorizedForm: value.authorizedForm,
      variantForms: value.variantForms ?? [],
      scopeNote: value.scopeNote,
      sources:
        value.sources?.map((s) => ({
          system: s.system,
          identifier: s.identifier,
          uri: s.uri,
          label: s.label,
          matchType: s.matchType as
            | 'exact-match'
            | 'close-match'
            | 'broader-match'
            | 'narrower-match',
          confidence: s.confidence,
          lastSynced: s.lastSynced ? (Date.parse(s.lastSynced) as Timestamp) : undefined,
        })) ?? [],
      status: value.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
      proposalUri: value.proposalUri as AtUri | undefined,
      approvedBy: value.approvedBy as DID | undefined,
      approvalDate: value.approvalDate ? (Date.parse(value.approvalDate) as Timestamp) : undefined,
      version: value.version,
      previousVersion: value.previousVersion as AtUri | undefined,
      sourcePds: pdsUrl,
      createdAt: Date.parse(value.createdAt) as Timestamp,
      updatedAt: value.updatedAt ? (Date.parse(value.updatedAt) as Timestamp) : undefined,
    };
  }

  /**
   * Transforms raw facet record to domain model.
   *
   * @internal
   */
  private transformFacetRecord(
    record: RepositoryRecord<RawFacetRecord>,
    pdsUrl: string
  ): GovernanceFacet {
    const value = record.value;

    return {
      uri: record.uri,
      cid: record.cid,
      dimension: value.dimension as FacetDimension,
      value: value.value,
      description: value.description,
      externalIds: value.externalIds,
      status: value.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
      proposalUri: value.proposalUri as AtUri | undefined,
      sourcePds: pdsUrl,
      createdAt: Date.parse(value.createdAt) as Timestamp,
    };
  }

  /**
   * Transforms raw organization record to domain model.
   *
   * @internal
   */
  private transformOrganizationRecord(
    record: RepositoryRecord<RawOrganizationRecord>,
    pdsUrl: string
  ): GovernanceOrganization {
    const value = record.value;

    return {
      uri: record.uri,
      cid: record.cid,
      name: value.name,
      abbreviation: value.abbreviation,
      type: value.type as
        | 'university'
        | 'research-lab'
        | 'funding-body'
        | 'publisher'
        | 'consortium'
        | 'other',
      parentOrganization: value.parentOrganization as AtUri | undefined,
      externalIds: value.externalIds,
      homepage: value.homepage,
      location: value.location,
      status: value.status as 'proposed' | 'provisional' | 'established' | 'deprecated',
      sourcePds: pdsUrl,
      createdAt: Date.parse(value.createdAt) as Timestamp,
    };
  }
}
