import neo4j from 'neo4j-driver';
import { singleton } from 'tsyringe';

import type { AtUri, DID } from '../../types/atproto.js';
import { DatabaseError, NotFoundError } from '../../types/errors.js';

import { Neo4jConnection } from './connection.js';
import { ModerationService } from './moderation-service.js';
import { getGovernanceDid } from './setup.js';
import type {
  EvidenceItem,
  GraphNode,
  NodeKind,
  NodeProposal,
  ProposalStatus,
  ProposalType,
  Reference,
} from './types.js';

/**
 * Proposal creation parameters
 */
export interface CreateProposalParams {
  fieldName: string;
  alternateNames?: string[];
  description: string;
  proposalType: ProposalType;
  existingFieldUri?: AtUri;
  mergeTargetUri?: AtUri;
  rationale: string;
  evidence: EvidenceItem[];
  references?: Reference[];
  proposerDid: DID;
}

/**
 * Proposal filter options
 */
export interface ProposalFilters {
  status?: ProposalStatus;
  proposalType?: ProposalType;
  proposerDid?: DID;
  fieldId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  offset?: number;
  limit?: number;
}

/**
 * Proposal list result
 */
export interface ProposalListResult {
  proposals: NodeProposal[];
  total: number;
  hasMore: boolean;
  offset: number;
}

/**
 * Proposal action result
 */
export interface ProposalActionResult {
  success: boolean;
  newStatus: ProposalStatus;
  message: string;
}

/**
 * Discussion comment on a proposal
 */
export interface DiscussionComment {
  id: string;
  proposalUri: AtUri;
  authorDid: DID;
  content: string;
  parentCommentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Proposal handler for governance workflows.
 *
 * Manages the lifecycle of field proposals, from creation through
 * community discussion and voting to approval or rejection.
 *
 * Proposal workflow:
 * 1. User creates proposal (pending)
 * 2. Community discusses (in-discussion)
 * 3. Voting period opens
 * 4. Consensus reached → approved or rejected
 * 5. If approved, changes applied to graph
 *
 * Proposal types:
 * - create: New field node
 * - modify: Update existing field
 * - merge: Combine two fields
 * - deprecate: Mark field as deprecated
 *
 * @example
 * ```typescript
 * const proposalHandler = container.resolve(ProposalHandler);
 *
 * // Create a proposal
 * const uri = await proposalHandler.createProposal({
 *   fieldName: 'Quantum Machine Learning',
 *   description: 'Intersection of quantum computing and ML',
 *   proposalType: 'create',
 *   rationale: 'Emerging interdisciplinary field with significant research activity',
 *   evidence: [
 *     {
 *       type: 'bibliometric-analysis',
 *       description: '500+ papers in past 2 years',
 *       confidence: 0.9
 *     }
 *   ],
 *   proposerDid: 'did:plc:user'
 * });
 *
 * // Move to discussion
 * await proposalHandler.openDiscussion(uri);
 *
 * // After voting, approve if consensus reached
 * await proposalHandler.approveProposal(uri, 'did:plc:moderator');
 * ```
 */
@singleton()
export class ProposalHandler {
  constructor(
    private connection: Neo4jConnection,
    private moderation: ModerationService
  ) {}

  /**
   * Create a new field proposal.
   *
   * Creates a proposal node and initiates the governance workflow.
   * Proposals start in 'pending' status awaiting community review.
   *
   * @param params - Proposal creation parameters
   * @returns AT-URI of created proposal
   * @throws {Error} If proposal creation fails
   *
   * @example
   * ```typescript
   * const uri = await proposalHandler.createProposal({
   *   fieldName: 'Explainable AI',
   *   alternateNames: ['XAI', 'Interpretable ML'],
   *   description: 'Methods for understanding AI decision-making',
   *   proposalType: 'create',
   *   rationale: 'Growing subfield with distinct methodology',
   *   evidence: [
   *     {
   *       type: 'literature-review',
   *       description: 'Systematic review of 200+ papers',
   *       confidence: 0.85,
   *       sourceUrl: 'https://arxiv.org/...'
   *     }
   *   ],
   *   references: [
   *     {
   *       type: 'paper',
   *       identifier: 'doi:10.1234/example',
   *       title: 'Survey of XAI Methods'
   *     }
   *   ],
   *   proposerDid: 'did:plc:user'
   * });
   * ```
   */
  async createProposal(params: CreateProposalParams): Promise<AtUri> {
    const id = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const governanceDid = getGovernanceDid();
    const uri = `at://${governanceDid}/pub.chive.graph.proposal/${id}` as AtUri;

    const query = `
      CREATE (p:NodeProposal {
        id: $id,
        uri: $uri,
        fieldName: $fieldName,
        alternateNames: $alternateNames,
        description: $description,
        proposalType: $proposalType,
        existingFieldUri: $existingFieldUri,
        mergeTargetUri: $mergeTargetUri,
        rationale: $rationale,
        evidence: $evidence,
        references: $references,
        status: 'pending',
        proposerDid: $proposerDid,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN p.uri as uri
    `;

    const result = await this.connection.executeQuery<{ uri: AtUri }>(query, {
      id,
      uri,
      fieldName: params.fieldName,
      alternateNames: params.alternateNames ?? [],
      description: params.description,
      proposalType: params.proposalType,
      existingFieldUri: params.existingFieldUri ?? null,
      mergeTargetUri: params.mergeTargetUri ?? null,
      rationale: params.rationale,
      evidence: JSON.stringify(params.evidence),
      references: params.references ? JSON.stringify(params.references) : null,
      proposerDid: params.proposerDid,
    });

    const record = result.records[0];
    if (!record) {
      throw new DatabaseError(
        'CREATE',
        'Failed to create proposal: no record returned from database'
      );
    }

    return record.get('uri');
  }

  /**
   * Get proposal by URI.
   *
   * @param uri - Proposal AT-URI
   * @returns Field proposal or null if not found
   */
  async getProposal(uri: AtUri): Promise<NodeProposal | null> {
    const query = `
      MATCH (p:NodeProposal {uri: $uri})
      RETURN p
    `;

    const result = await this.connection.executeQuery<{
      p: Record<string, string | string[] | Date>;
    }>(query, { uri });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapProposal(record.get('p'));
  }

  /**
   * Get proposal by ID.
   *
   * @param id - Proposal identifier
   * @returns Field proposal or null if not found
   */
  async getProposalById(id: string): Promise<NodeProposal | null> {
    const query = `
      MATCH (p:NodeProposal {id: $id})
      RETURN p
    `;

    const result = await this.connection.executeQuery<{
      p: Record<string, string | string[] | Date>;
    }>(query, { id });

    const record = result.records[0];
    if (!record) {
      return null;
    }

    return this.mapProposal(record.get('p'));
  }

  /**
   * List proposals with filtering and pagination.
   *
   * @param filters - Filter and pagination options
   * @returns Paginated proposal list
   *
   * @example
   * ```typescript
   * const result = await proposalHandler.listProposals({
   *   status: 'pending',
   *   proposalType: 'create',
   *   offset: 0,
   *   limit: 20
   * });
   *
   * console.log(`Found ${result.total} proposals`);
   * result.proposals.forEach(p => {
   *   console.log(`${p.fieldName}: ${p.status}`);
   * });
   * ```
   */
  async listProposals(filters?: ProposalFilters): Promise<ProposalListResult> {
    const conditions: string[] = [];
    // Use unknown to allow neo4j.int() values for LIMIT/SKIP
    const params: Record<string, unknown> = {};

    if (filters?.status) {
      conditions.push('p.status = $status');
      params.status = filters.status;
    }

    if (filters?.proposalType) {
      conditions.push('p.proposalType = $proposalType');
      params.proposalType = filters.proposalType;
    }

    if (filters?.proposerDid) {
      conditions.push('p.proposerDid = $proposerDid');
      params.proposerDid = filters.proposerDid;
    }

    if (filters?.fieldId) {
      conditions.push('p.id = $fieldId');
      params.fieldId = filters.fieldId;
    }

    if (filters?.createdAfter) {
      conditions.push('p.createdAt >= $createdAfter');
      params.createdAfter = filters.createdAfter;
    }

    if (filters?.createdBefore) {
      conditions.push('p.createdAt <= $createdBefore');
      params.createdBefore = filters.createdBefore;
    }

    const offsetValue = Math.floor(filters?.offset ?? 0);
    const limitValue = Math.floor(filters?.limit ?? 20);
    params.offset = neo4j.int(offsetValue);
    params.limit = neo4j.int(limitValue);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      MATCH (p:NodeProposal)
      ${whereClause}
      WITH p
      ORDER BY p.createdAt DESC
      SKIP $offset
      LIMIT $limit
      RETURN p
    `;

    const countQuery = `
      MATCH (p:NodeProposal)
      ${whereClause}
      RETURN count(p) as total
    `;

    const [dataResult, countResult] = await Promise.all([
      this.connection.executeQuery<{
        p: Record<string, string | string[] | Date>;
      }>(query, params),
      this.connection.executeQuery<{ total: number }>(countQuery, params),
    ]);

    const proposals = dataResult.records.map((record) => this.mapProposal(record.get('p')));
    const total = countResult.records[0]?.get('total') ?? 0;

    return {
      proposals,
      total,
      hasMore: offsetValue + proposals.length < total,
      offset: offsetValue,
    };
  }

  /**
   * Update proposal status.
   *
   * @param uri - Proposal AT-URI
   * @param status - New status
   * @param updatedBy - DID of user making the update
   * @throws {Error} If proposal not found or status transition invalid
   */
  async updateProposalStatus(uri: AtUri, status: ProposalStatus, updatedBy: DID): Promise<void> {
    const query = `
      MATCH (p:NodeProposal {uri: $uri})
      SET p.status = $status,
          p.updatedAt = datetime(),
          p.updatedBy = $updatedBy
      RETURN p
    `;

    const result = await this.connection.executeQuery(query, {
      uri,
      status,
      updatedBy,
    });

    const record = result.records[0];
    if (!record) {
      throw new NotFoundError('Proposal', uri);
    }
  }

  /**
   * Open discussion period for a proposal.
   *
   * Transitions proposal from 'pending' to 'in-discussion'.
   *
   * @param uri - Proposal AT-URI
   * @returns Action result
   */
  async openDiscussion(uri: AtUri): Promise<ProposalActionResult> {
    const proposal = await this.getProposal(uri);

    if (!proposal) {
      return {
        success: false,
        newStatus: 'pending',
        message: 'Proposal not found',
      };
    }

    if (proposal.status !== 'pending') {
      return {
        success: false,
        newStatus: proposal.status,
        message: `Cannot open discussion: proposal is ${proposal.status}`,
      };
    }

    await this.updateProposalStatus(uri, 'in-discussion', getGovernanceDid() as DID);

    return {
      success: true,
      newStatus: 'in-discussion',
      message: 'Discussion period opened',
    };
  }

  /**
   * Approve a proposal.
   *
   * Marks proposal as approved after consensus is reached.
   * Should only be called after verifying voting consensus.
   *
   * @param uri - Proposal AT-URI
   * @param approvedBy - DID of approver (moderator/admin)
   * @returns Action result
   * @throws {Error} If consensus not reached
   *
   * @example
   * ```typescript
   * // Check consensus first
   * const summary = await modService.getVotingSummary(proposalUri);
   * if (summary.consensusReached) {
   *   await proposalHandler.approveProposal(proposalUri, 'did:plc:admin');
   * }
   * ```
   */
  async approveProposal(uri: AtUri, approvedBy: DID): Promise<ProposalActionResult> {
    const proposal = await this.getProposal(uri);

    if (!proposal) {
      return {
        success: false,
        newStatus: 'pending',
        message: 'Proposal not found',
      };
    }

    // Verify consensus
    const summary = await this.moderation.getVotingSummary(uri);

    if (!summary.consensusReached) {
      return {
        success: false,
        newStatus: proposal.status,
        message: `Consensus not reached: ${summary.approvalRatio.toFixed(2)} approval ratio (need ${summary.threshold})`,
      };
    }

    await this.updateProposalStatus(uri, 'approved', approvedBy);

    return {
      success: true,
      newStatus: 'approved',
      message: 'Proposal approved by consensus',
    };
  }

  /**
   * Reject a proposal.
   *
   * Marks proposal as rejected after failed consensus or community decision.
   *
   * @param uri - Proposal AT-URI
   * @param rejectedBy - DID of rejector
   * @param reason - Rejection reason
   * @returns Action result
   */
  async rejectProposal(uri: AtUri, rejectedBy: DID, reason: string): Promise<ProposalActionResult> {
    const proposal = await this.getProposal(uri);

    if (!proposal) {
      return {
        success: false,
        newStatus: 'pending',
        message: 'Proposal not found',
      };
    }

    await this.connection.executeQuery(
      `
      MATCH (p:NodeProposal {uri: $uri})
      SET p.status = 'rejected',
          p.rejectionReason = $reason,
          p.rejectedBy = $rejectedBy,
          p.rejectedAt = datetime(),
          p.updatedAt = datetime()
      `,
      { uri, reason, rejectedBy }
    );

    return {
      success: true,
      newStatus: 'rejected',
      message: `Proposal rejected: ${reason}`,
    };
  }

  /**
   * Request changes to a proposal.
   *
   * Transitions proposal to 'needs-changes' status with feedback.
   *
   * @param uri - Proposal AT-URI
   * @param requestedBy - DID of requester
   * @param changes - Requested changes description
   * @returns Action result
   */
  async requestChanges(
    uri: AtUri,
    requestedBy: DID,
    changes: string
  ): Promise<ProposalActionResult> {
    const proposal = await this.getProposal(uri);

    if (!proposal) {
      return {
        success: false,
        newStatus: 'pending',
        message: 'Proposal not found',
      };
    }

    await this.connection.executeQuery(
      `
      MATCH (p:NodeProposal {uri: $uri})
      SET p.status = 'needs-changes',
          p.requestedChanges = $changes,
          p.changesRequestedBy = $requestedBy,
          p.changesRequestedAt = datetime(),
          p.updatedAt = datetime()
      `,
      { uri, changes, requestedBy }
    );

    return {
      success: true,
      newStatus: 'needs-changes',
      message: 'Changes requested',
    };
  }

  /**
   * Add discussion comment to a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @param authorDid - Comment author DID
   * @param content - Comment content
   * @param parentCommentId - Parent comment ID (for threading)
   * @returns Comment ID
   */
  async addDiscussionComment(
    proposalUri: AtUri,
    authorDid: DID,
    content: string,
    parentCommentId?: string
  ): Promise<string> {
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const query = `
      MATCH (p:NodeProposal {uri: $proposalUri})
      CREATE (c:DiscussionComment {
        id: $commentId,
        proposalUri: $proposalUri,
        authorDid: $authorDid,
        content: $content,
        parentCommentId: $parentCommentId,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (c)-[:COMMENT_ON]->(p)
      RETURN c.id as id
    `;

    const result = await this.connection.executeQuery<{ id: string }>(query, {
      proposalUri,
      commentId,
      authorDid,
      content,
      parentCommentId: parentCommentId ?? null,
    });

    const record = result.records[0];
    if (!record) {
      throw new DatabaseError(
        'CREATE',
        'Failed to create discussion comment: no record returned from database'
      );
    }

    return record.get('id');
  }

  /**
   * Get discussion comments for a proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @param limit - Maximum comments (default: 100)
   * @returns Array of discussion comments
   */
  async getDiscussionComments(proposalUri: AtUri, limit = 100): Promise<DiscussionComment[]> {
    const query = `
      MATCH (c:DiscussionComment)-[:COMMENT_ON]->(:NodeProposal {uri: $proposalUri})
      RETURN c.id as id,
             c.proposalUri as proposalUri,
             c.authorDid as authorDid,
             c.content as content,
             c.parentCommentId as parentCommentId,
             c.createdAt as createdAt,
             c.updatedAt as updatedAt
      ORDER BY c.createdAt ASC
      LIMIT $limit
    `;

    const result = await this.connection.executeQuery<{
      id: string;
      proposalUri: AtUri;
      authorDid: DID;
      content: string;
      parentCommentId: string | null;
      createdAt: string;
      updatedAt: string;
    }>(query, { proposalUri, limit: neo4j.int(limit) });

    return result.records.map((record) => ({
      id: record.get('id'),
      proposalUri: record.get('proposalUri'),
      authorDid: record.get('authorDid'),
      content: record.get('content'),
      parentCommentId: record.get('parentCommentId') ?? undefined,
      createdAt: new Date(record.get('createdAt')),
      updatedAt: new Date(record.get('updatedAt')),
    }));
  }

  /**
   * Delete a discussion comment.
   *
   * @param commentId - Comment ID
   * @param deletedBy - DID of user deleting (author or moderator)
   * @throws {Error} If comment not found or user not authorized
   */
  async deleteDiscussionComment(commentId: string, deletedBy: DID): Promise<void> {
    const query = `
      MATCH (c:DiscussionComment {id: $commentId})
      WHERE c.authorDid = $deletedBy OR EXISTS {
        MATCH (user:User {did: $deletedBy})
        WHERE user.role IN ['administrator', 'trusted-editor']
      }
      DELETE c
    `;

    await this.connection.executeQuery(query, { commentId, deletedBy });
  }

  /**
   * Get proposals awaiting action (pending or in-discussion).
   *
   * @param limit - Maximum results (default: 20)
   * @returns Proposals awaiting community action
   */
  async getProposalsAwaitingAction(limit = 20): Promise<NodeProposal[]> {
    const query = `
      MATCH (p:NodeProposal)
      WHERE p.status IN ['pending', 'in-discussion', 'needs-changes']
      WITH p
      ORDER BY p.createdAt ASC
      LIMIT $limit
      RETURN p
    `;

    const result = await this.connection.executeQuery<{
      p: Record<string, string | string[] | Date>;
    }>(query, { limit: neo4j.int(limit) });

    return result.records.map((record) => this.mapProposal(record.get('p')));
  }

  /**
   * Get recently approved proposals.
   *
   * @param limit - Maximum results (default: 10)
   * @returns Recently approved proposals
   */
  async getRecentlyApprovedProposals(limit = 10): Promise<NodeProposal[]> {
    const query = `
      MATCH (p:NodeProposal {status: 'approved'})
      WITH p
      ORDER BY p.updatedAt DESC
      LIMIT $limit
      RETURN p
    `;

    const result = await this.connection.executeQuery<{
      p: Record<string, string | string[] | Date>;
    }>(query, { limit: neo4j.int(limit) });

    return result.records.map((record) => this.mapProposal(record.get('p')));
  }

  /**
   * Map Neo4j node to NodeProposal type.
   */
  private mapProposal(node: Record<string, string | string[] | Date>): NodeProposal {
    const evidenceStr = node.evidence as string | null;
    const proposedNodeStr = node.proposedNode as string | null;

    const evidence: EvidenceItem[] = evidenceStr ? (JSON.parse(evidenceStr) as EvidenceItem[]) : [];
    const proposedNode = proposedNodeStr
      ? (JSON.parse(proposedNodeStr) as Partial<GraphNode>)
      : undefined;

    return {
      id: node.id as string,
      uri: node.uri as AtUri,
      proposalType: node.proposalType as ProposalType,
      kind: (node.kind as NodeKind) ?? 'type',
      subkind: node.subkind as string | undefined,
      targetUri: node.targetUri ? (node.targetUri as AtUri) : undefined,
      mergeIntoUri: node.mergeIntoUri ? (node.mergeIntoUri as AtUri) : undefined,
      proposedNode,
      rationale: node.rationale as string,
      evidence,
      status: node.status as ProposalStatus,
      proposerDid: node.proposerDid as DID,
      createdAt: new Date(node.createdAt as string | Date),
      updatedAt: node.updatedAt ? new Date(node.updatedAt as string | Date) : undefined,
    };
  }
}
