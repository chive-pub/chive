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

import type { AnnotationViewOutput, EntityLinkViewOutput } from './listForEprint.js';
import { collectAnnotatorDids, flattenThreads, mapEntityLinkView } from './listForEprint.js';

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
  annotations: AnnotationViewOutput[];
  entityLinks?: EntityLinkViewOutput[];
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

    // Batch resolve author info
    const annotatorDids = collectAnnotatorDids(threads);
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

    // Flatten threads with author info
    const annotations = flattenThreads(threads, authorMap);

    // Optionally include entity links
    let entityLinks: EntityLinkViewOutput[] | undefined;
    if (params.includeEntityLinks) {
      const rawEntityLinks = await annotationService.getEntityLinks(params.eprintUri as AtUri, {
        pageNumber: params.pageNumber,
      });

      // Resolve creator DIDs not already in authorMap
      const creatorDids = new Set(rawEntityLinks.map((el) => el.creator));
      const missingDids = new Set<string>();
      for (const did of creatorDids) {
        if (!authorMap.has(did)) {
          missingDids.add(did);
        }
      }
      if (missingDids.size > 0) {
        const extraAuthors = await annotationService.getAuthorInfoByDids(missingDids);
        for (const [did, info] of extraAuthors.entries()) {
          authorMap.set(did, {
            did,
            handle: info.handle,
            displayName: info.displayName,
            avatar: info.avatar,
          });
        }
      }

      entityLinks = rawEntityLinks.map((el) => mapEntityLinkView(el, authorMap));
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
