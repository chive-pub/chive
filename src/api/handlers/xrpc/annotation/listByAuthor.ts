/**
 * XRPC handler for pub.chive.annotation.listByAuthor.
 *
 * @remarks
 * Lists annotations created by a specific author with pagination.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for listByAuthor.
 */
export interface QueryParams {
  annotatorDid: string;
  limit?: number;
  cursor?: string;
}

/**
 * Output schema for listByAuthor.
 */
export interface OutputSchema {
  annotations: unknown[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

/**
 * XRPC method for pub.chive.annotation.listByAuthor.
 *
 * @remarks
 * Returns a paginated list of annotations by a specific author.
 *
 * @public
 */
export const listByAuthor: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const annotationService = c.get('services').annotation;

    logger.debug('Listing annotations for author', {
      annotatorDid: params.annotatorDid,
      limit: params.limit,
      cursor: params.cursor,
    });

    const result = await annotationService.listAnnotationsByAuthor(params.annotatorDid as DID, {
      limit: params.limit,
      cursor: params.cursor,
    });

    const response: OutputSchema = {
      annotations: result.items as unknown[],
      cursor: result.cursor,
      hasMore: result.hasMore,
      total: result.total,
    };

    logger.info('Annotations listed for author', {
      annotatorDid: params.annotatorDid,
      count: response.annotations.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
