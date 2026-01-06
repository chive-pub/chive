/**
 * Governance domain models for Chive's decentralized authority control.
 *
 * @remarks
 * This module defines domain models for community governance records stored
 * in the Chive Governance PDS (`did:plc:chive-governance`).
 *
 * **ATProto Compliance**:
 * - All governance records are ATProto-native (stored in Governance PDS)
 * - Published to firehose for interoperability
 * - Chive AppView reads governance records, never writes
 * - Authority records link to external sources (Wikidata, LCSH, FAST)
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri, CID, DID, Timestamp } from '../atproto.js';

/**
 * Facet dimension type.
 *
 * @remarks
 * 10-dimensional classification system combining PMEST and FAST:
 *
 * **PMEST** (Ranganathan's Colon Classification):
 * - `personality`: Disciplinary perspective
 * - `matter`: Subject matter, phenomena
 * - `energy`: Processes, methods
 * - `space`: Geographic/spatial context
 * - `time`: Temporal period
 *
 * **FAST** (OCLC Faceted Application of Subject Terminology):
 * - `form`: Document genre
 * - `topical`: General topics
 * - `geographic`: Geographic entities
 * - `chronological`: Historical periods
 * - `event`: Named events
 *
 * @public
 */
export type FacetDimension =
  | 'personality'
  | 'matter'
  | 'energy'
  | 'space'
  | 'time'
  | 'form'
  | 'topical'
  | 'geographic'
  | 'chronological'
  | 'event';

/**
 * Authority record status.
 *
 * @remarks
 * - `proposed`: Awaiting community review
 * - `provisional`: Approved for use, pending full validation
 * - `established`: Fully validated and approved
 * - `deprecated`: Superseded by another record
 *
 * @public
 */
export type AuthorityStatus = 'proposed' | 'provisional' | 'established' | 'deprecated';

/**
 * External source reference.
 *
 * @remarks
 * Links authority records to external knowledge bases for interoperability.
 *
 * @public
 */
export interface ExternalSource {
  /**
   * External system identifier.
   *
   * @example "wikidata", "lcsh", "fast", "ror"
   */
  readonly system: string;

  /**
   * Identifier within the external system.
   *
   * @example "Q82001", "sh2003003871", "fst01004795"
   */
  readonly identifier: string;

  /**
   * Full URI to the external record.
   */
  readonly uri: string;

  /**
   * Label from the external source.
   */
  readonly label?: string;

  /**
   * Match type for this source.
   */
  readonly matchType: 'exact-match' | 'close-match' | 'broader-match' | 'narrower-match';

  /**
   * Confidence score (0-1).
   */
  readonly confidence?: number;

  /**
   * Last synchronization timestamp.
   */
  readonly lastSynced?: Timestamp;
}

/**
 * Governance authority record.
 *
 * @remarks
 * Canonical forms for fields, topics, and concepts stored in the
 * Chive Governance PDS. Authority records follow IFLA LRM 2024-2025
 * principles.
 *
 * **ATProto Compliance**:
 * - Stored in Governance PDS, not Chive database
 * - Published to firehose
 * - AppView indexes but never modifies
 *
 * @public
 */
export interface GovernanceAuthorityRecord {
  /**
   * AT URI of the authority record.
   */
  readonly uri: AtUri;

  /**
   * CID of this record version.
   */
  readonly cid: CID;

  /**
   * Authorized (preferred) form.
   *
   * @example "Quantum Computing", "Machine Learning"
   */
  readonly authorizedForm: string;

  /**
   * Variant forms (synonyms, abbreviations, alternate spellings).
   *
   * @example ["Quantum Computation", "QC", "Quantum Information Processing"]
   */
  readonly variantForms: readonly string[];

  /**
   * Scope note clarifying usage boundaries.
   *
   * @example "Research on quantum algorithms, quantum hardware, and quantum
   * information theory. For classical computing, see Computer science."
   */
  readonly scopeNote?: string;

  /**
   * Links to external authority sources.
   */
  readonly sources: readonly ExternalSource[];

  /**
   * Record status.
   */
  readonly status: AuthorityStatus;

  /**
   * AT URI of the original proposal (if community-proposed).
   */
  readonly proposalUri?: AtUri;

  /**
   * DID of the editor who approved this record.
   */
  readonly approvedBy?: DID;

  /**
   * Approval timestamp.
   */
  readonly approvalDate?: Timestamp;

  /**
   * Record version number.
   */
  readonly version: number;

  /**
   * AT URI of previous version (if updated).
   */
  readonly previousVersion?: AtUri;

  /**
   * Source PDS URL.
   *
   * @remarks
   * For ATProto compliance, tracks which PDS this record came from.
   * Should always be the Governance PDS endpoint.
   */
  readonly sourcePds: string;

  /**
   * Record creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last update timestamp.
   */
  readonly updatedAt?: Timestamp;
}

/**
 * Governance facet record.
 *
 * @remarks
 * Facet values for 10-dimensional classification stored in Governance PDS.
 *
 * @public
 */
export interface GovernanceFacet {
  /**
   * AT URI of the facet record.
   */
  readonly uri: AtUri;

  /**
   * CID of this record version.
   */
  readonly cid: CID;

  /**
   * Facet dimension.
   */
  readonly dimension: FacetDimension;

  /**
   * Facet value (human-readable).
   */
  readonly value: string;

  /**
   * Description of this facet value.
   */
  readonly description?: string;

  /**
   * External identifiers (ORCID, VIAF, Wikidata, etc.).
   */
  readonly externalIds?: Readonly<Record<string, string>>;

  /**
   * Record status.
   */
  readonly status: AuthorityStatus;

  /**
   * AT URI of the original proposal.
   */
  readonly proposalUri?: AtUri;

  /**
   * Source PDS URL.
   */
  readonly sourcePds: string;

  /**
   * Record creation timestamp.
   */
  readonly createdAt: Timestamp;
}

/**
 * Governance organization record.
 *
 * @remarks
 * Research institutions, funding bodies, and publishers stored in
 * Governance PDS for author affiliation linking.
 *
 * @public
 */
export interface GovernanceOrganization {
  /**
   * AT URI of the organization record.
   */
  readonly uri: AtUri;

  /**
   * CID of this record version.
   */
  readonly cid: CID;

  /**
   * Organization name.
   */
  readonly name: string;

  /**
   * Common abbreviation.
   */
  readonly abbreviation?: string;

  /**
   * Organization type.
   */
  readonly type:
    | 'university'
    | 'research-lab'
    | 'funding-body'
    | 'publisher'
    | 'consortium'
    | 'other';

  /**
   * AT URI of parent organization.
   */
  readonly parentOrganization?: AtUri;

  /**
   * External identifiers (ROR, GRID, Wikidata).
   */
  readonly externalIds?: Readonly<Record<string, string>>;

  /**
   * Organization homepage URL.
   */
  readonly homepage?: string;

  /**
   * Location information.
   */
  readonly location?: {
    readonly city?: string;
    readonly state?: string;
    readonly country: string;
  };

  /**
   * Record status.
   */
  readonly status: AuthorityStatus;

  /**
   * Source PDS URL.
   */
  readonly sourcePds: string;

  /**
   * Record creation timestamp.
   */
  readonly createdAt: Timestamp;
}

/**
 * Governance reconciliation record.
 *
 * @remarks
 * Links between Chive entities and external knowledge bases.
 * Records how entities were matched and verified.
 *
 * @public
 */
export interface GovernanceReconciliation {
  /**
   * AT URI of the reconciliation record.
   */
  readonly uri: AtUri;

  /**
   * CID of this record version.
   */
  readonly cid: CID;

  /**
   * AT URI of the Chive entity being reconciled.
   */
  readonly chiveEntityUri: AtUri;

  /**
   * External entity reference.
   */
  readonly externalEntity: ExternalSource;

  /**
   * Reconciliation method used.
   */
  readonly reconciliationMethod: 'automatic' | 'expert-validation' | 'community-vote';

  /**
   * Evidence supporting this reconciliation.
   */
  readonly evidence: readonly ReconciliationEvidence[];

  /**
   * Verification status.
   */
  readonly status: 'unverified' | 'verified' | 'disputed';

  /**
   * DIDs of editors who verified this reconciliation.
   */
  readonly verifiedBy?: readonly DID[];

  /**
   * Source PDS URL.
   */
  readonly sourcePds: string;

  /**
   * Record creation timestamp.
   */
  readonly createdAt: Timestamp;

  /**
   * Last external sync timestamp.
   */
  readonly lastSyncedAt?: Timestamp;
}

/**
 * Evidence supporting a reconciliation.
 *
 * @public
 */
export interface ReconciliationEvidence {
  /**
   * Evidence type.
   */
  readonly type: 'name-match' | 'expert-validation' | 'community-vote' | 'bibliometric-analysis';

  /**
   * Confidence score (0-1).
   */
  readonly score: number;

  /**
   * Description of the evidence.
   */
  readonly details: string;

  /**
   * DID of validator (for expert-validation type).
   */
  readonly validatedBy?: DID;

  /**
   * Validation timestamp.
   */
  readonly validatedAt?: Timestamp;
}

/**
 * Consensus result for a governance proposal.
 *
 * @remarks
 * Summarizes voting results and whether consensus was reached.
 *
 * @public
 */
export interface ConsensusResult {
  /**
   * AT URI of the proposal.
   */
  readonly proposalUri: AtUri;

  /**
   * Approval vote count.
   */
  readonly approveCount: number;

  /**
   * Rejection vote count.
   */
  readonly rejectCount: number;

  /**
   * Abstention count.
   */
  readonly abstainCount: number;

  /**
   * Total eligible voters.
   */
  readonly totalEligibleVoters: number;

  /**
   * Participation rate (0-1).
   */
  readonly participationRate: number;

  /**
   * Whether consensus threshold was met.
   */
  readonly consensusReached: boolean;

  /**
   * Final decision.
   */
  readonly decision: 'approved' | 'rejected' | 'pending' | 'expired';

  /**
   * Decision timestamp (if decided).
   */
  readonly decidedAt?: Timestamp;
}

/**
 * Options for listing governance records.
 *
 * @public
 */
export interface GovernanceListOptions {
  /**
   * Maximum number of records to return.
   */
  readonly limit?: number;

  /**
   * Cursor for pagination.
   */
  readonly cursor?: string;

  /**
   * Filter by status.
   */
  readonly status?: AuthorityStatus;
}

/**
 * Governance update event for subscription.
 *
 * @public
 */
export interface GovernanceUpdateEvent {
  /**
   * Event type.
   */
  readonly type: 'authority-created' | 'authority-updated' | 'facet-created' | 'proposal-decided';

  /**
   * AT URI of the affected record.
   */
  readonly uri: AtUri;

  /**
   * New CID of the record.
   */
  readonly cid: CID;

  /**
   * Event timestamp.
   */
  readonly timestamp: Timestamp;
}

/**
 * Handler for governance update events.
 *
 * @public
 */
export type GovernanceUpdateHandler = (event: GovernanceUpdateEvent) => void | Promise<void>;

/**
 * Subscription handle for governance updates.
 *
 * @public
 */
export interface GovernanceSubscription {
  /**
   * Unsubscribes from governance updates.
   */
  unsubscribe(): void;
}
