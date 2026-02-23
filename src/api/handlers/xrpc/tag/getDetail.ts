/**
 * XRPC handler for pub.chive.tag.getDetail.
 *
 * @remarks
 * Gets details for a specific tag or keyword.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/tag/getDetail.js';
import { NotFoundError } from '../../../../types/errors.js';
import { normalizeTag } from '../../../../utils/normalize-tag.js';
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
    const eprintService = c.get('services').eprint;

    logger.debug('Getting tag detail', {
      tag: params.tag,
    });

    const normalizedTerm = normalizeTag(params.tag);

    // Get tag from TagManager (Neo4j) for quality score and display form.
    // May be null for keyword-only terms that have no community tag.
    const tag = await tagManager.getTag(normalizedTerm);

    // Get unified count from both community tags and author keywords.
    const { total: usageCount } = await eprintService.getEprintUrisForTerm(normalizedTerm, 0, 0);

    if (!tag && usageCount === 0) {
      throw new NotFoundError('Tag', params.tag);
    }

    // Lexicon expects qualityScore as integer 0-100 (scaled from 0-1)
    const response: OutputSchema = {
      normalizedForm: tag?.normalizedForm ?? normalizedTerm,
      displayForms: tag ? [tag.rawForm] : [params.tag],
      usageCount,
      qualityScore: tag ? Math.round((tag.qualityScore ?? 0) * 100) : 0,
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
