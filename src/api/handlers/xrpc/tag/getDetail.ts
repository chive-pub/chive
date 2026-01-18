/**
 * XRPC handler for pub.chive.tag.getDetail.
 *
 * @remarks
 * Gets details for a specific tag.
 *
 * @packageDocumentation
 * @public
 */

import type { Context } from 'hono';

import { NotFoundError } from '../../../../types/errors.js';
import {
  getTagDetailParamsSchema,
  tagSummarySchema,
  type GetTagDetailParams,
  type TagSummary,
} from '../../../schemas/tag.js';
import type { ChiveEnv } from '../../../types/context.js';
import type { XRPCEndpoint } from '../../../types/handlers.js';

/**
 * Handler for pub.chive.tag.getDetail query.
 *
 * @param c - Hono context with Chive environment
 * @param params - Validated query parameters
 * @returns Tag details
 *
 * @public
 */
export async function getDetailHandler(
  c: Context<ChiveEnv>,
  params: GetTagDetailParams
): Promise<TagSummary> {
  const logger = c.get('logger');
  const tagManager = c.get('services').tagManager;

  logger.debug('Getting tag detail', {
    tag: params.tag,
  });

  // Normalize the tag for lookup
  const normalizedTag = tagManager.normalizeTag(params.tag);

  // Get tag from TagManager
  const tag = await tagManager.getTag(normalizedTag);

  if (!tag) {
    throw new NotFoundError('Tag', params.tag);
  }

  // Map to TagSummary format
  const response: TagSummary = {
    normalizedForm: tag.normalizedForm,
    displayForms: [tag.rawForm],
    usageCount: tag.usageCount ?? 0,
    qualityScore: tag.qualityScore ?? 0,
    isPromoted: false,
    promotedTo: undefined,
  };

  logger.info('Tag detail retrieved', {
    tag: params.tag,
    usageCount: response.usageCount,
  });

  return response;
}

/**
 * Endpoint definition for pub.chive.tag.getDetail.
 *
 * @public
 */
export const getDetailEndpoint: XRPCEndpoint<GetTagDetailParams, TagSummary> = {
  method: 'pub.chive.tag.getDetail' as never,
  type: 'query',
  description: 'Get tag details',
  inputSchema: getTagDetailParamsSchema,
  outputSchema: tagSummarySchema,
  handler: getDetailHandler,
  auth: 'none',
  rateLimit: 'anonymous',
};
