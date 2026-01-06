/**
 * XRPC handler for pub.chive.governance.listProposals.
 *
 * @remarks
 * Lists governance proposals with optional filtering by status and type.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import {
  listProposalsParamsSchema,
  proposalsResponseSchema,
  type ListProposalsParams,
  type ProposalsResponse,
} from '../../../schemas/governance.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.governance.listProposals query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns List of proposals matching the filters
 *
 * @public
 */
export async function listProposalsHandler(
  c: Context<ChiveEnv>,
  params: ListProposalsParams
): Promise<ProposalsResponse> {
  const logger = c.get('logger');
  const graphService = c.get('services').graph;

  logger.debug('Listing governance proposals', {
    status: params.status,
    type: params.type,
    limit: params.limit,
  });

  // Map API status to service status (filter out 'expired' which is not supported)
  const supportedStatuses = ['pending', 'approved', 'rejected'] as const;
  const filteredStatus = params.status
    ? supportedStatuses.filter((s) => s === params.status)
    : undefined;

  // Get proposals from the knowledge graph service
  const result = await graphService.listProposals({
    status: filteredStatus && filteredStatus.length > 0 ? filteredStatus[0] : undefined,
    type: params.type,
    fieldId: params.fieldId,
    proposedBy: params.proposedBy,
    limit: params.limit,
    cursor: params.cursor,
  });

  // Map to API response format
  const proposals = result.proposals.map((p) => ({
    id: p.id,
    uri: p.uri,
    fieldId: p.fieldId,
    label: undefined, // Would need field lookup
    type: p.type,
    changes: p.changes,
    rationale: p.rationale,
    status: p.status,
    proposedBy: p.proposedBy,
    proposerName: undefined, // Would need DID resolution
    votes: p.votes,
    consensus: undefined, // Would need consensus calculation
    createdAt: p.createdAt.toISOString(),
    updatedAt: undefined,
    expiresAt: undefined,
  }));

  const response: ProposalsResponse = {
    proposals,
    cursor: result.cursor,
    total: result.total,
  };

  logger.info('Governance proposals listed', {
    count: response.proposals.length,
    total: response.total,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.governance.listProposals.
 *
 * @public
 */
export const listProposalsEndpoint: XRPCEndpoint<ListProposalsParams, ProposalsResponse> = {
  method: 'pub.chive.governance.listProposals' as never,
  type: 'query',
  description: 'List governance proposals',
  inputSchema: listProposalsParamsSchema,
  outputSchema: proposalsResponseSchema,
  handler: listProposalsHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
