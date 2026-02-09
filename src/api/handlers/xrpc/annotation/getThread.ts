/**
 * XRPC handler for pub.chive.annotation.getThread.
 *
 * @remarks
 * Gets an annotation thread with all replies.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for getThread.
 */
export interface QueryParams {
  uri: string;
  maxDepth?: number;
}

/**
 * Output schema for getThread.
 */
export interface OutputSchema {
  thread: unknown[];
  totalReplies: number;
}

/**
 * XRPC method for pub.chive.annotation.getThread.
 *
 * @remarks
 * Returns an annotation thread starting from the given URI.
 *
 * @public
 */
export const getThread: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const annotationService = c.get('services').annotation;

    logger.debug('Getting annotation thread', {
      uri: params.uri,
      maxDepth: params.maxDepth,
    });

    const threadAnnotations = await annotationService.getAnnotationThread(
      params.uri as AtUri,
      params.maxDepth ?? 10
    );

    if (threadAnnotations.length === 0) {
      throw new NotFoundError('Annotation', params.uri);
    }

    // First item is root, rest are replies
    const totalReplies = threadAnnotations.length - 1;

    const response: OutputSchema = {
      thread: threadAnnotations,
      totalReplies,
    };

    logger.info('Annotation thread retrieved', {
      uri: params.uri,
      totalReplies: response.totalReplies,
    });

    return { encoding: 'application/json', body: response };
  },
};
