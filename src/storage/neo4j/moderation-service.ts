import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import type { UserRole, VoteType } from './types.js';

/**
 * Vote record for a proposal
 */
export interface VoteRecord {
  id: string;
  proposalUri: AtUri;
  voterDid: DID;
  vote: VoteType;
  voterRole: UserRole;
  weight: number;
  rationale?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Voting summary for a proposal
 */
export interface VotingSummary {
  proposalUri: AtUri;
  approveCount: number;
  rejectCount: number;
  abstainCount: number;
  requestChangesCount: number;
  weightedApprove: number;
  weightedReject: number;
  approvalRatio: number;
  totalVotes: number;
  uniqueVoters: number;
  trustedEditors: number;
  domainExperts: number;
  adminVetoes: number;
  consensusReached: boolean;
  automaticApproval: boolean;
  threshold: number;
}

/**
 * User moderation profile
 */
export interface UserModerationProfile {
  did: DID;
  role: UserRole;
  trustScore: number;
  votingWeight: number;
  totalVotes: number;
  accuracyRate: number;
  specializations: string[];
  badges: string[];
  joinedAt: Date;
  lastActiveAt: Date;
}

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  approvalThreshold: number;
  minVotes: number;
  minTrustedEditors: number;
  votingPeriodDays: number;
  trustedEditorWeight: number;
  domainExpertWeight: number;
  adminVetoEnabled: boolean;
  automaticApprovalEnabled: boolean;
  automaticApprovalThreshold: number;
}

/**
 * Community moderation service for Wikipedia-style governance.
 *
 * Implements voting, consensus mechanisms, and user role management
 * for knowledge graph proposals.
 *
 * Voting power is weighted by user role:
 * - Community member: 1.0
 * - Trusted editor: 2.0
 * - Domain expert: 2.5
 * - Authority editor: 3.0
 * - Administrator: Veto power
 *
 * Consensus requires:
 * - 67% approval ratio (configurable)
 * - Minimum 5 votes
 * - At least 2 trusted editors voting
 *
 * @example
 * ```typescript
 * const modService = container.resolve(ModerationService);
 *
 * // Cast a vote
 * await modService.castVote({
 *   proposalUri: 'at://did:plc:gov/pub.chive.graph.proposal/123',
 *   voterDid: 'did:plc:user',
 *   vote: 'approve',
 *   rationale: 'Well-researched proposal with strong evidence'
 * });
 *
 * // Check consensus
 * const summary = await modService.getVotingSummary(
 *   'at://did:plc:gov/pub.chive.graph.proposal/123'
 * );
 * console.log(`Consensus: ${summary.consensusReached}`);
 * ```
 */
@singleton()
export class ModerationService {
  /**
   * Default consensus configuration
   */
  private static readonly DEFAULT_CONFIG: ConsensusConfig = {
    approvalThreshold: 0.67, // 67% approval
    minVotes: 5,
    minTrustedEditors: 2,
    votingPeriodDays: 14,
    trustedEditorWeight: 2.0,
    domainExpertWeight: 2.5,
    adminVetoEnabled: true,
    automaticApprovalEnabled: true,
    automaticApprovalThreshold: 0.9, // 90% for automatic approval
  };

  constructor(private connection: Neo4jConnection) {}

  /**
   * Get consensus configuration.
   *
   * @returns Current consensus configuration
   */
  getConsensusConfig(): ConsensusConfig {
    return { ...ModerationService.DEFAULT_CONFIG };
  }

  /**
   * Cast a vote on a proposal.
   *
   * Creates or updates a vote for the given proposal.
   * Vote weight is determined by user role.
   *
   * @param params - Vote parameters
   * @returns Created vote ID
   * @throws {Error} If proposal not found or voter not authorized
   *
   * @example
   * ```typescript
   * const voteId = await modService.castVote({
   *   proposalUri: 'at://did:plc:gov/pub.chive.graph.proposal/123',
   *   voterDid: 'did:plc:user',
   *   vote: 'approve',
   *   rationale: 'Strong bibliometric evidence supports this field structure'
   * });
   * ```
   */
  async castVote(params: {
    proposalUri: AtUri;
    voterDid: DID;
    vote: VoteType;
    rationale?: string;
  }): Promise<string> {
    const { proposalUri, voterDid, vote, rationale } = params;

    // Get user profile to determine role and weight
    const profile = await this.getUserProfile(voterDid);
    const role = profile?.role ?? 'community-member';
    const weight = profile?.votingWeight ?? 1.0;

    const query = `
      MATCH (proposal {uri: $proposalUri})
      MERGE (voter:User {did: $voterDid})
      ON CREATE SET
        voter.role = $role,
        voter.votingWeight = $weight,
        voter.createdAt = datetime()
      MERGE (voter)-[v:VOTED_ON {proposalUri: $proposalUri}]->(proposal)
      ON CREATE SET
        v.id = randomUUID(),
        v.vote = $vote,
        v.voterRole = $role,
        v.weight = $weight,
        v.rationale = $rationale,
        v.createdAt = datetime(),
        v.updatedAt = datetime()
      ON MATCH SET
        v.vote = $vote,
        v.voterRole = $role,
        v.weight = $weight,
        v.rationale = $rationale,
        v.updatedAt = datetime()
      RETURN v.id as voteId
    `;

    const result = await this.connection.executeQuery<{ voteId: string }>(query, {
      proposalUri,
      voterDid,
      vote,
      role,
      weight,
      rationale: rationale ?? null,
    });

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('Proposal', proposalUri);
    }

    return record.get('voteId');
  }

  /**
   * Update an existing vote.
   *
   * @param voteId - Vote ID
   * @param vote - New vote value
   * @param rationale - Updated rationale
   * @throws {Error} If vote not found
   */
  async updateVote(voteId: string, vote: VoteType, rationale?: string): Promise<void> {
    const query = `
      MATCH ()-[v:VOTED_ON {id: $voteId}]->()
      SET v.vote = $vote,
          v.rationale = $rationale,
          v.updatedAt = datetime()
      RETURN v
    `;

    const result = await this.connection.executeQuery(query, {
      voteId,
      vote,
      rationale: rationale ?? null,
    });

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('Vote', voteId);
    }
  }

  /**
   * Withdraw a vote.
   *
   * @param voteId - Vote ID
   */
  async withdrawVote(voteId: string): Promise<void> {
    const query = `
      MATCH ()-[v:VOTED_ON {id: $voteId}]->()
      DELETE v
    `;

    await this.connection.executeQuery(query, { voteId });
  }

  /**
   * Get vote by ID.
   *
   * @param voteId - Vote ID
   * @returns Vote record or null if not found
   */
  async getVote(voteId: string): Promise<VoteRecord | null> {
    const query = `
      MATCH (voter:User)-[v:VOTED_ON {id: $voteId}]->()
      RETURN v.id as id,
             v.proposalUri as proposalUri,
             voter.did as voterDid,
             v.vote as vote,
             v.voterRole as voterRole,
             v.weight as weight,
             v.rationale as rationale,
             v.createdAt as createdAt,
             v.updatedAt as updatedAt
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      proposalUri: AtUri;
      voterDid: DID;
      vote: VoteType;
      voterRole: UserRole;
      weight: number;
      rationale: string | null;
      createdAt: string;
      updatedAt: string;
    }>(query, { voteId });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return {
      id: record.get('id'),
      proposalUri: record.get('proposalUri'),
      voterDid: record.get('voterDid'),
      vote: record.get('vote'),
      voterRole: record.get('voterRole'),
      weight: Number(record.get('weight')),
      rationale: record.get('rationale') ?? undefined,
      createdAt: new Date(record.get('createdAt')),
      updatedAt: new Date(record.get('updatedAt')),
    };
  }

  /**
   * Get all votes for a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Array of vote records
   */
  async getVotesForProposal(proposalUri: AtUri): Promise<VoteRecord[]> {
    const query = `
      MATCH (voter:User)-[v:VOTED_ON {proposalUri: $proposalUri}]->()
      RETURN v.id as id,
             v.proposalUri as proposalUri,
             voter.did as voterDid,
             v.vote as vote,
             v.voterRole as voterRole,
             v.weight as weight,
             v.rationale as rationale,
             v.createdAt as createdAt,
             v.updatedAt as updatedAt
      ORDER BY v.createdAt DESC
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      proposalUri: AtUri;
      voterDid: DID;
      vote: VoteType;
      voterRole: UserRole;
      weight: number;
      rationale: string | null;
      createdAt: string;
      updatedAt: string;
    }>(query, { proposalUri });

    return result.records.map((record) => ({
      id: record.get('id'),
      proposalUri: record.get('proposalUri'),
      voterDid: record.get('voterDid'),
      vote: record.get('vote'),
      voterRole: record.get('voterRole'),
      weight: Number(record.get('weight')),
      rationale: record.get('rationale') ?? undefined,
      createdAt: new Date(record.get('createdAt')),
      updatedAt: new Date(record.get('updatedAt')),
    }));
  }

  /**
   * Get votes cast by a user.
   *
   * @param voterDid - User DID
   * @param limit - Maximum results (default: 50)
   * @returns Array of vote records
   */
  async getVotesByUser(voterDid: DID, limit = 50): Promise<VoteRecord[]> {
    const query = `
      MATCH (voter:User {did: $voterDid})-[v:VOTED_ON]->()
      RETURN v.id as id,
             v.proposalUri as proposalUri,
             voter.did as voterDid,
             v.vote as vote,
             v.voterRole as voterRole,
             v.weight as weight,
             v.rationale as rationale,
             v.createdAt as createdAt,
             v.updatedAt as updatedAt
      ORDER BY v.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      proposalUri: AtUri;
      voterDid: DID;
      vote: VoteType;
      voterRole: UserRole;
      weight: number;
      rationale: string | null;
      createdAt: string;
      updatedAt: string;
    }>(query, { voterDid, limit: neo4j.int(limit) });

    return result.records.map((record) => ({
      id: record.get('id'),
      proposalUri: record.get('proposalUri'),
      voterDid: record.get('voterDid'),
      vote: record.get('vote'),
      voterRole: record.get('voterRole'),
      weight: Number(record.get('weight')),
      rationale: record.get('rationale') ?? undefined,
      createdAt: new Date(record.get('createdAt')),
      updatedAt: new Date(record.get('updatedAt')),
    }));
  }

  /**
   * Calculate voting summary for a proposal.
   *
   * Aggregates votes, applies weighting, and determines consensus status.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Voting summary with consensus determination
   *
   * @example
   * ```typescript
   * const summary = await modService.getVotingSummary(proposalUri);
   * if (summary.consensusReached) {
   *   console.log(`Approved with ${summary.approvalRatio}% support`);
   * }
   * ```
   */
  async getVotingSummary(proposalUri: AtUri): Promise<VotingSummary> {
    const votes = await this.getVotesForProposal(proposalUri);
    const config = this.getConsensusConfig();

    let approveCount = 0;
    let rejectCount = 0;
    let abstainCount = 0;
    let requestChangesCount = 0;
    let weightedApprove = 0;
    let weightedReject = 0;
    let trustedEditors = 0;
    let domainExperts = 0;
    let adminVetoes = 0;

    const uniqueVoters = new Set<DID>();

    for (const vote of votes) {
      uniqueVoters.add(vote.voterDid);

      if (vote.vote === 'approve') {
        approveCount++;
        weightedApprove += vote.weight;
      } else if (vote.vote === 'reject') {
        rejectCount++;
        weightedReject += vote.weight;

        // Administrator veto
        if (vote.voterRole === 'administrator' && config.adminVetoEnabled) {
          adminVetoes++;
        }
      } else if (vote.vote === 'request-changes') {
        requestChangesCount++;
        // Treat as reject for consensus calculation
        weightedReject += vote.weight;
      } else if (vote.vote === 'abstain') {
        abstainCount++;
      }

      // Count special roles
      if (vote.voterRole === 'trusted-editor' || vote.voterRole === 'authority-editor') {
        trustedEditors++;
      }

      if (vote.voterRole === 'domain-expert') {
        domainExperts++;
      }
    }

    const totalVotes = approveCount + rejectCount + requestChangesCount;
    const totalWeighted = weightedApprove + weightedReject;
    const approvalRatio = totalWeighted > 0 ? weightedApprove / totalWeighted : 0;

    // Consensus requirements
    const consensusReached =
      totalVotes >= config.minVotes &&
      trustedEditors >= config.minTrustedEditors &&
      approvalRatio >= config.approvalThreshold &&
      adminVetoes === 0;

    // Automatic approval for overwhelming support
    const automaticApproval =
      config.automaticApprovalEnabled &&
      totalVotes >= config.minVotes * 2 &&
      approvalRatio >= config.automaticApprovalThreshold &&
      adminVetoes === 0;

    return {
      proposalUri,
      approveCount,
      rejectCount,
      abstainCount,
      requestChangesCount,
      weightedApprove,
      weightedReject,
      approvalRatio,
      totalVotes,
      uniqueVoters: uniqueVoters.size,
      trustedEditors,
      domainExperts,
      adminVetoes,
      consensusReached,
      automaticApproval,
      threshold: config.approvalThreshold,
    };
  }

  /**
   * Get or create user moderation profile.
   *
   * @param did - User DID
   * @returns User moderation profile
   */
  async getUserProfile(did: DID): Promise<UserModerationProfile | null> {
    const query = `
      MATCH (user:User {did: $did})
      OPTIONAL MATCH (user)-[v:VOTED_ON]->()
      WITH user, count(v) as totalVotes
      RETURN user.did as did,
             user.role as role,
             user.trustScore as trustScore,
             user.votingWeight as votingWeight,
             totalVotes,
             user.accuracyRate as accuracyRate,
             user.specializations as specializations,
             user.badges as badges,
             user.createdAt as joinedAt,
             user.lastActiveAt as lastActiveAt
    `;

    const result = await this.connection.executeQuery<{
      did: DID;
      role: UserRole | null;
      trustScore: number | null;
      votingWeight: number | null;
      totalVotes: number;
      accuracyRate: number | null;
      specializations: string[] | null;
      badges: string[] | null;
      joinedAt: string | null;
      lastActiveAt: string | null;
    }>(query, { did });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    const joinedAtValue = record.get('joinedAt');
    const lastActiveAtValue = record.get('lastActiveAt');

    return {
      did: record.get('did'),
      role: record.get('role') ?? 'community-member',
      trustScore: Number(record.get('trustScore') ?? 0.5),
      votingWeight: Number(record.get('votingWeight') ?? 1.0),
      totalVotes: Number(record.get('totalVotes') ?? 0),
      accuracyRate: Number(record.get('accuracyRate') ?? 0),
      specializations: record.get('specializations') ?? [],
      badges: record.get('badges') ?? [],
      joinedAt: joinedAtValue ? new Date(joinedAtValue) : new Date(),
      lastActiveAt: lastActiveAtValue ? new Date(lastActiveAtValue) : new Date(),
    };
  }

  /**
   * Update user role.
   *
   * @param did - User DID
   * @param role - New role
   * @param votingWeight - New voting weight (optional)
   * @throws {Error} If user not found
   *
   * @example
   * ```typescript
   * // Promote user to trusted editor
   * await modService.updateUserRole(
   *   'did:plc:user',
   *   'trusted-editor',
   *   2.0
   * );
   * ```
   */
  async updateUserRole(did: DID, role: UserRole, votingWeight?: number): Promise<void> {
    // Determine default voting weight based on role
    const defaultWeights: Record<UserRole, number> = {
      'community-member': 1.0,
      'trusted-editor': 2.0,
      'authority-editor': 3.0,
      'domain-expert': 2.5,
      administrator: 5.0,
    };

    const weight = votingWeight ?? defaultWeights[role];

    const query = `
      MERGE (user:User {did: $did})
      ON CREATE SET
        user.role = $role,
        user.votingWeight = $weight,
        user.trustScore = 0.5,
        user.createdAt = datetime(),
        user.lastActiveAt = datetime()
      ON MATCH SET
        user.role = $role,
        user.votingWeight = $weight,
        user.lastActiveAt = datetime()
      RETURN user
    `;

    const result = await this.connection.executeQuery(query, {
      did,
      role,
      weight,
    });

    const record = result.records[0];
    if (!record) {
      throw new DatabaseError('UPDATE', `Failed to update user role for ${did}`);
    }
  }

  /**
   * Update user trust score.
   *
   * @param did - User DID
   * @param trustScore - New trust score (0-1)
   * @throws {Error} If user not found or score out of range
   */
  async updateUserTrustScore(did: DID, trustScore: number): Promise<void> {
    if (trustScore < 0 || trustScore > 1) {
      throw new ValidationError('Trust score must be between 0 and 1', 'trustScore', 'range');
    }

    const query = `
      MATCH (user:User {did: $did})
      SET user.trustScore = $trustScore,
          user.lastActiveAt = datetime()
      RETURN user
    `;

    const result = await this.connection.executeQuery(query, {
      did,
      trustScore,
    });

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('User', did);
    }
  }

  /**
   * Add specialization to user profile.
   *
   * @param did - User DID
   * @param specialization - Field or topic specialization
   */
  async addUserSpecialization(did: DID, specialization: string): Promise<void> {
    const query = `
      MERGE (user:User {did: $did})
      ON CREATE SET
        user.specializations = [$specialization],
        user.createdAt = datetime()
      ON MATCH SET
        user.specializations = CASE
          WHEN $specialization IN user.specializations THEN user.specializations
          ELSE user.specializations + $specialization
        END
      SET user.lastActiveAt = datetime()
    `;

    await this.connection.executeQuery(query, { did, specialization });
  }

  /**
   * Award badge to user.
   *
   * @param did - User DID
   * @param badge - Badge identifier
   *
   * @example
   * ```typescript
   * await modService.awardBadge('did:plc:user', 'helpful-reviewer');
   * await modService.awardBadge('did:plc:user', 'consensus-builder');
   * ```
   */
  async awardBadge(did: DID, badge: string): Promise<void> {
    const query = `
      MERGE (user:User {did: $did})
      ON CREATE SET
        user.badges = [$badge],
        user.createdAt = datetime()
      ON MATCH SET
        user.badges = CASE
          WHEN $badge IN user.badges THEN user.badges
          ELSE user.badges + $badge
        END
      SET user.lastActiveAt = datetime()
    `;

    await this.connection.executeQuery(query, { did, badge });
  }

  /**
   * Get leaderboard of top contributors.
   *
   * @param limit - Maximum results (default: 20)
   * @returns Top users by voting activity and trust score
   */
  async getLeaderboard(limit = 20): Promise<UserModerationProfile[]> {
    const query = `
      MATCH (user:User)
      OPTIONAL MATCH (user)-[v:VOTED_ON]->()
      WITH user, count(v) as totalVotes
      WHERE totalVotes > 0
      RETURN user.did as did,
             user.role as role,
             user.trustScore as trustScore,
             user.votingWeight as votingWeight,
             totalVotes,
             user.accuracyRate as accuracyRate,
             user.specializations as specializations,
             user.badges as badges,
             user.createdAt as joinedAt,
             user.lastActiveAt as lastActiveAt
      ORDER BY totalVotes DESC, user.trustScore DESC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      did: DID;
      role: UserRole;
      trustScore: number;
      votingWeight: number;
      totalVotes: number;
      accuracyRate: number | null;
      specializations: string[] | null;
      badges: string[] | null;
      joinedAt: string;
      lastActiveAt: string;
    }>(query, { limit: neo4j.int(limit) });

    return result.records.map((record) => ({
      did: record.get('did'),
      role: (record.get('role') as UserRole | null) ?? 'community-member',
      trustScore: Number(record.get('trustScore') ?? 0.5),
      votingWeight: Number(record.get('votingWeight') ?? 1.0),
      totalVotes: Number(record.get('totalVotes') ?? 0),
      accuracyRate: Number(record.get('accuracyRate') ?? 0),
      specializations: record.get('specializations') ?? [],
      badges: record.get('badges') ?? [],
      joinedAt: new Date(record.get('joinedAt')),
      lastActiveAt: new Date(record.get('lastActiveAt')),
    }));
  }
}
