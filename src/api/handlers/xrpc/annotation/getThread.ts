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

import type { AnnotationViewOutput } from './listForEprint.js';
import { mapAnnotationView } from './listForEprint.js';

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
  thread: AnnotationViewOutput[];
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

    // Batch resolve author info for all annotations in thread
    const annotatorDids = new Set(threadAnnotations.map((a) => a.annotator));
    const authorInfoMap = await annotationService.getAuthorInfoByDids(annotatorDids);

    const authorMap = new Map<
      string,
      { did: string; handle?: string; displayName?: string; avatar?: string }
    >();
    for (const entry of Array.from(authorInfoMap.entries())) {
      const [did, info] = entry;
      authorMap.set(did, {
        did,
        handle: info.handle,
        displayName: info.displayName,
        avatar: info.avatar,
      });
    }

    // Transform annotations to API output format
    const thread = threadAnnotations.map((a) => mapAnnotationView(a, authorMap));
    const totalReplies = thread.length - 1;

    const response: OutputSchema = {
      thread,
      totalReplies,
    };

    logger.info('Annotation thread retrieved', {
      uri: params.uri,
      totalReplies: response.totalReplies,
    });

    return { encoding: 'application/json', body: response };
  },
};
