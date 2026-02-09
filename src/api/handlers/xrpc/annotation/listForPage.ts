/**
 * XRPC handler for pub.chive.annotation.listForPage.
 *
 * @remarks
 * Lists annotations and entity links for a specific page of an eprint.
 *
 * @packageDocumentation
 * @public
 */

import type { AtUri } from '../../../../types/atproto.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for listForPage.
 */
export interface QueryParams {
  eprintUri: string;
  pageNumber: number;
  includeEntityLinks?: boolean;
}

/**
 * Output schema for listForPage.
 */
export interface OutputSchema {
  annotations: unknown[];
  entityLinks?: readonly unknown[];
  pageNumber: number;
}

/**
 * XRPC method for pub.chive.annotation.listForPage.
 *
 * @remarks
 * Returns annotations and entity links for a specific page of an eprint.
 *
 * @public
 */
export const listForPage: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const annotationService = c.get('services').annotation;

    if (params.pageNumber < 1) {
      throw new ValidationError('pageNumber must be at least 1', 'pageNumber', 'min');
    }

    logger.debug('Listing annotations for page', {
      eprintUri: params.eprintUri,
      pageNumber: params.pageNumber,
    });

    const threads = await annotationService.getAnnotationsForPage(
      params.eprintUri as AtUri,
      params.pageNumber
    );

    // Flatten threads to flat annotation list for page view
    const annotations: unknown[] = [];
    function flattenThread(thread: {
      root: unknown;
      replies: readonly { root: unknown; replies: readonly unknown[] }[];
    }): void {
      annotations.push(thread.root);
      for (const reply of thread.replies) {
        flattenThread(reply as typeof thread);
      }
    }
    for (const thread of threads) {
      flattenThread(thread);
    }

    let entityLinks: readonly unknown[] | undefined;
    if (params.includeEntityLinks) {
      entityLinks = await annotationService.getEntityLinks(params.eprintUri as AtUri, {
        pageNumber: params.pageNumber,
      });
    }

    const response: OutputSchema = {
      annotations,
      entityLinks,
      pageNumber: params.pageNumber,
    };

    logger.info('Annotations listed for page', {
      eprintUri: params.eprintUri,
      pageNumber: params.pageNumber,
      annotationCount: annotations.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
