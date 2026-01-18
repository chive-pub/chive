/**
 * Proposal service for Wikipedia-style community consensus on field nodes.
 *
 * @remarks
 * Manages voting, consensus calculation, and approval workflows for field
 * proposals. Uses weighted voting where trusted editors have higher influence.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../types/atproto.js';
import { ValidationError } from '../../types/errors.js';
import type { NodeProposal } from '../../types/interfaces/graph.interface.js';
import type { ILogger } from '../../types/interfaces/logger.interface.js';

/**
 * Vote record for a proposal.
 *
 * @public
 */
export interface Vote {
  /**
   * DID of voter.
   */
  readonly voterDid: DID;

  /**
   * Vote value.
   */
  readonly value: 'approve' | 'reject';

  /**
   * Vote weight (1.0 for regular users, higher for editors).
   */
  readonly weight: number;

  /**
   * Timestamp when vote was cast.
   */
  readonly votedAt: Date;
}

/**
 * Consensus result for a proposal.
 *
 * @public
 */
export interface ConsensusResult {
  /**
   * Whether consensus is reached.
   */
  readonly consensusReached: boolean;

  /**
   * Weighted approval percentage (0-1).
   */
  readonly approvalPercentage: number;

  /**
   * Total weighted votes for approval.
   */
  readonly weightedApprove: number;

  /**
   * Total weighted votes for rejection.
   */
  readonly weightedReject: number;

  /**
   * Number of unique voters.
   */
  readonly voterCount: number;

  /**
   * Recommended status based on consensus.
   */
  readonly recommendedStatus: 'approved' | 'rejected' | 'pending';
}

/**
 * User role for vote weighting.
 *
 * @public
 */
export type UserRole = 'editor' | 'trusted-contributor' | 'user';

/**
 * Proposal service configuration.
 *
 * @public
 */
export interface ProposalServiceOptions {
  /**
   * Logger for proposal events.
   */
  readonly logger: ILogger;

  /**
   * Consensus threshold (0-1).
   *
   * @remarks
   * Percentage of weighted votes needed for approval.
   *
   * @defaultValue 0.67 (67%)
   */
  readonly consensusThreshold?: number;

  /**
   * Minimum votes required.
   *
   * @remarks
   * Minimum number of unique voters before consensus can be reached.
   *
   * @defaultValue 3
   */
  readonly minimumVotes?: number;

  /**
   * Editor vote weight multiplier.
   *
   * @defaultValue 3.0
   */
  readonly editorWeight?: number;

  /**
   * Trusted contributor vote weight multiplier.
   *
   * @defaultValue 1.5
   */
  readonly trustedWeight?: number;
}

/**
 * Proposal service for community consensus.
 *
 * @remarks
 * Calculates weighted consensus for field proposals using Wikipedia-style
 * moderation. Trusted editors have higher vote weight to maintain quality.
 *
 * Consensus process:
 * 1. Users vote approve/reject on proposals
 * 2. Votes are weighted by user role (editor > trusted > user)
 * 3. Consensus threshold checked (default 67% approval)
 * 4. Minimum voter count required (default 3)
 * 5. Status updated: approved, rejected, or pending
 *
 * @example
 * ```typescript
 * const service = new ProposalService({
 *   logger,
 *   consensusThreshold: 0.67,
 *   minimumVotes: 3,
 *   editorWeight: 3.0,
 *   trustedWeight: 1.5
 * });
 *
 * // Calculate consensus
 * const result = service.calculateConsensus(proposal, votes, roles);
 *
 * if (result.consensusReached) {
 *   console.log(`Consensus: ${result.recommendedStatus}`);
 *   console.log(`Approval: ${(result.approvalPercentage * 100).toFixed(1)}%`);
 * }
 * ```
 *
 * @public
 */
export class ProposalService {
  private readonly logger: ILogger;
  private readonly consensusThreshold: number;
  private readonly minimumVotes: number;
  private readonly editorWeight: number;
  private readonly trustedWeight: number;

  constructor(options: ProposalServiceOptions) {
    this.logger = options.logger;
    this.consensusThreshold = options.consensusThreshold ?? 0.67;
    this.minimumVotes = options.minimumVotes ?? 3;
    this.editorWeight = options.editorWeight ?? 3.0;
    this.trustedWeight = options.trustedWeight ?? 1.5;
  }

  /**
   * Calculates consensus for a proposal.
   *
   * @param proposal - Field proposal
   * @param votes - All votes for this proposal
   * @param roles - Map of DID to user role
   * @returns Consensus result
   *
   * @remarks
   * Weighted consensus calculation:
   * 1. Apply weight based on voter role
   * 2. Sum weighted approve/reject votes
   * 3. Calculate approval percentage
   * 4. Check if threshold and minimum votes met
   *
   * @example
   * ```typescript
   * const roles = new Map([
   *   ['did:plc:editor1', 'editor'],
   *   ['did:plc:user1', 'user']
   * ]);
   *
   * const result = service.calculateConsensus(proposal, votes, roles);
   * ```
   *
   * @public
   */
  calculateConsensus(
    proposal: NodeProposal,
    votes: readonly Vote[],
    roles: ReadonlyMap<DID, UserRole>
  ): ConsensusResult {
    if (votes.length === 0) {
      return {
        consensusReached: false,
        approvalPercentage: 0,
        weightedApprove: 0,
        weightedReject: 0,
        voterCount: 0,
        recommendedStatus: 'pending',
      };
    }

    // Validate no duplicate votes
    const voters = new Set<DID>();
    for (const vote of votes) {
      if (voters.has(vote.voterDid)) {
        throw new ValidationError('Duplicate vote detected', 'voterDid');
      }
      voters.add(vote.voterDid);
    }

    // Calculate weighted votes
    let weightedApprove = 0;
    let weightedReject = 0;

    for (const vote of votes) {
      const role = roles.get(vote.voterDid) ?? 'user';
      const weight = this.getVoteWeight(role);

      if (vote.value === 'approve') {
        weightedApprove += weight;
      } else {
        weightedReject += weight;
      }
    }

    const totalWeighted = weightedApprove + weightedReject;
    const approvalPercentage = totalWeighted > 0 ? weightedApprove / totalWeighted : 0;

    // Check consensus
    const meetsMinimum = votes.length >= this.minimumVotes;
    const meetsThreshold = approvalPercentage >= this.consensusThreshold;
    const consensusReached =
      meetsMinimum && (meetsThreshold || approvalPercentage < 1 - this.consensusThreshold);

    let recommendedStatus: 'approved' | 'rejected' | 'pending';

    if (!consensusReached) {
      recommendedStatus = 'pending';
    } else if (meetsThreshold) {
      recommendedStatus = 'approved';
    } else {
      recommendedStatus = 'rejected';
    }

    this.logger.debug('Calculated consensus', {
      proposalId: proposal.id,
      approvalPercentage,
      weightedApprove,
      weightedReject,
      voterCount: votes.length,
      recommendedStatus,
    });

    return {
      consensusReached,
      approvalPercentage,
      weightedApprove,
      weightedReject,
      voterCount: votes.length,
      recommendedStatus,
    };
  }

  /**
   * Gets vote weight for user role.
   *
   * @param role - User role
   * @returns Vote weight multiplier
   *
   * @remarks
   * Default weights:
   * - Editor: 3.0x
   * - Trusted contributor: 1.5x
   * - User: 1.0x
   *
   * @public
   */
  getVoteWeight(role: UserRole): number {
    switch (role) {
      case 'editor':
        return this.editorWeight;
      case 'trusted-contributor':
        return this.trustedWeight;
      case 'user':
        return 1.0;
      default:
        return 1.0;
    }
  }

  /**
   * Checks if proposal qualifies for fast-track approval.
   *
   * @param proposal - Field proposal
   * @param votes - All votes for this proposal
   * @param roles - Map of DID to user role
   * @returns Whether fast-track is enabled
   *
   * @remarks
   * Fast-track criteria:
   * - At least 2 editor approvals
   * - No editor rejections
   * - All votes are approve
   *
   * Fast-track bypasses minimum voter requirement for uncontroversial changes.
   *
   * @example
   * ```typescript
   * if (service.canFastTrack(proposal, votes, roles)) {
   *   // Approve immediately without waiting for community votes
   * }
   * ```
   *
   * @public
   */
  canFastTrack(
    _proposal: NodeProposal,
    votes: readonly Vote[],
    roles: ReadonlyMap<DID, UserRole>
  ): boolean {
    if (votes.length === 0) {
      return false;
    }

    let editorApprovals = 0;
    let hasRejection = false;

    for (const vote of votes) {
      const role = roles.get(vote.voterDid) ?? 'user';

      if (vote.value === 'reject') {
        hasRejection = true;
        break;
      }

      if (role === 'editor' && vote.value === 'approve') {
        editorApprovals++;
      }
    }

    return editorApprovals >= 2 && !hasRejection;
  }

  /**
   * Validates vote before recording.
   *
   * @param vote - Vote to validate
   * @param existingVotes - Existing votes for proposal
   * @returns Validation result
   *
   * @remarks
   * Validation rules:
   * - Voter has not already voted
   * - Vote value is approve or reject
   * - Vote weight is positive
   *
   * @throws {@link ValidationError}
   * When vote fails validation.
   *
   * @public
   */
  validateVote(vote: Vote, existingVotes: readonly Vote[]): void {
    // Check duplicate vote
    for (const existing of existingVotes) {
      if (existing.voterDid === vote.voterDid) {
        throw new ValidationError('User has already voted on this proposal', 'voterDid');
      }
    }

    // Validate vote value
    if (vote.value !== 'approve' && vote.value !== 'reject') {
      throw new ValidationError('Vote value must be approve or reject', 'value');
    }

    // Validate weight
    if (vote.weight <= 0) {
      throw new ValidationError('Vote weight must be positive', 'weight');
    }
  }

  /**
   * Gets approval threshold percentage.
   *
   * @returns Consensus threshold (0-1)
   *
   * @public
   */
  getConsensusThreshold(): number {
    return this.consensusThreshold;
  }

  /**
   * Gets minimum voter requirement.
   *
   * @returns Minimum number of votes
   *
   * @public
   */
  getMinimumVotes(): number {
    return this.minimumVotes;
  }
}
