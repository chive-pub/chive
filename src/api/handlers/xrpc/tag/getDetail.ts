/**
 * XRPC handler for pub.chive.tag.getDetail.
 *
 * @remarks
 * Gets details for a specific tag.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/getDetail.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * XRPC method for pub.chive.tag.getDetail.
 *
 * @public
 */
export const getDetail: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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
    // Lexicon expects qualityScore as integer 0-100 (scaled from 0-1)
    const response: OutputSchema = {
      normalizedForm: tag.normalizedForm,
      displayForms: [tag.rawForm],
      usageCount: tag.usageCount ?? 0,
      qualityScore: Math.round((tag.qualityScore ?? 0) * 100),
      isPromoted: false,
      promotedTo: undefined,
    };

    logger.info('Tag detail retrieved', {
      tag: params.tag,
      usageCount: response.usageCount,
    });

    return { encoding: 'application/json', body: response };
  },
};
