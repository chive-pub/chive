/**
 * Handler for pub.chive.alpha.apply.
 *
 * @remarks
 * Submits an alpha tester application. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { AuthenticationError } from '../../../../types/errors.js';
import {
  alphaApplyParamsSchema,
  alphaApplyResponseSchema,
  type AlphaApplyParams,
  type AlphaApplyResponse,
} from '../../../schemas/alpha.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.alpha.apply.
 *
 * @param c - Hono context
 * @param params - Application parameters
 * @returns Created application
 *
 * @public
 */
export async function applyHandler(
  c: Context<ChiveEnv>,
  params: AlphaApplyParams
): Promise<AlphaApplyResponse> {
  const logger = c.get('logger');
  const user = c.get('user');
  const alphaService = c.get('alphaService');

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.debug('Processing alpha application', {
    did: user.did,
    sector: params.sector,
    careerStage: params.careerStage,
    affiliationCount: params.affiliations?.length ?? 0,
    keywordCount: params.researchKeywords.length,
  });

  const application = await alphaService.apply({
    did: user.did,
    handle: user.handle,
    email: params.email,
    sector: params.sector,
    sectorOther: params.sectorOther,
    careerStage: params.careerStage,
    careerStageOther: params.careerStageOther,
    affiliations: params.affiliations,
    researchKeywords: params.researchKeywords,
    motivation: params.motivation,
  });

  return {
    applicationId: application.id,
    status: application.status,
    createdAt: application.createdAt.toISOString(),
  };
}

/**
 * Endpoint definition for pub.chive.alpha.apply.
 *
 * @public
 */
export const applyEndpoint: XRPCEndpoint<AlphaApplyParams, AlphaApplyResponse> = {
  method: 'pub.chive.alpha.apply' as never,
  type: 'procedure',
  description: 'Submit an alpha tester application',
  inputSchema: alphaApplyParamsSchema,
  outputSchema: alphaApplyResponseSchema,
  handler: applyHandler,
  auth: 'required',
  rateLimit: 'authenticated',
};
