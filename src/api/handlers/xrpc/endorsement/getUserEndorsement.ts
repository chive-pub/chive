/**
 * XRPC handler for pub.chive.endorsement.getUserEndorsement.
 *
 * @remarks
 * Gets a user's endorsement for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import type { AtUri, DID } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import {
  getUserEndorsementParamsSchema,
  endorsementSchema,
  type GetUserEndorsementParams,
  type Endorsement,
} from '../../../schemas/endorsement.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Maps internal endorsement type to API contribution types.
 *
 * @internal
 */
function mapEndorsementTypeToContributions(
  endorsementType: 'methods' | 'results' | 'overall'
): ('methodological' | 'analytical' | 'theoretical' | 'empirical' | 'conceptual')[] {
  switch (endorsementType) {
    case 'methods':
      return ['methodological'];
    case 'results':
      return ['empirical'];
    case 'overall':
      return ['conceptual'];
    default:
      return ['conceptual'];
  }
}

/**
 * Handler for pub.chive.endorsement.getUserEndorsement query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns User's endorsement or 404 if not found
 *
 * @public
 */
export async function getUserEndorsementHandler(
  c: Context<ChiveEnv>,
  params: GetUserEndorsementParams
): Promise<Endorsement> {
  const logger = c.get('logger');
  const reviewService = c.get('services').review;

  logger.debug('Getting user endorsement', {
    eprintUri: params.eprintUri,
    userDid: params.userDid,
  });

  // Get user's endorsement from ReviewService
  const endorsement = await reviewService.getEndorsementByUser(
    params.eprintUri as AtUri,
    params.userDid as DID
  );

  if (!endorsement) {
    throw new NotFoundError('Endorsement', `user=${params.userDid}, eprint=${params.eprintUri}`);
  }

  // Map to API format
  const response: Endorsement = {
    uri: endorsement.uri,
    eprintUri: endorsement.eprintUri,
    endorser: {
      did: endorsement.endorser,
      handle: 'unknown', // Handle would need to be resolved via DID
    },
    contributions: mapEndorsementTypeToContributions(endorsement.endorsementType),
    comment: endorsement.comment,
    createdAt: endorsement.createdAt.toISOString(),
  };

  logger.info('User endorsement returned', {
    eprintUri: params.eprintUri,
    userDid: params.userDid,
    uri: response.uri,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.endorsement.getUserEndorsement.
 *
 * @public
 */
export const getUserEndorsementEndpoint: XRPCEndpoint<GetUserEndorsementParams, Endorsement> = {
  method: 'pub.chive.endorsement.getUserEndorsement' as never,
  type: 'query',
  description: "Get a user's endorsement for a eprint",
  inputSchema: getUserEndorsementParamsSchema,
  outputSchema: endorsementSchema,
  handler: getUserEndorsementHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
