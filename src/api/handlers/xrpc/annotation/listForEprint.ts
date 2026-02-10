/**
 * XRPC handler for pub.chive.annotation.listForEprint.
 *
 * @remarks
 * Lists annotations and entity links for a specific eprint.
 *
 * @packageDocumentation
 * @public
 */

import type {
  AnnotationThread as ServiceAnnotationThread,
  AnnotationView as ServiceAnnotationView,
  EntityLinkView as ServiceEntityLinkView,
} from '../../../../services/annotation/annotation-service.js';
import type { AtUri } from '../../../../types/atproto.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Query parameters for listForEprint.
 */
export interface QueryParams {
  eprintUri: string;
  motivation?: string;
  pageNumber?: number;
  includeEntityLinks?: boolean;
  limit?: number;
  cursor?: string;
}

/**
 * Author info resolved from authors_index.
 */
interface AuthorInfo {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Annotation view in API response format.
 */
export interface AnnotationViewOutput {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  eprintUri: string;
  content: string;
  body?: {
    text: string;
    facets?: unknown[];
  };
  target: {
    source: string;
    selector?: {
      type: string;
      exact?: string;
      prefix?: string;
      suffix?: string;
    };
    refinedBy?: {
      type: string;
      start?: number;
      end?: number;
      pageNumber?: number;
      boundingRect?: unknown;
    };
    page?: number;
  };
  motivation: string;
  parentAnnotationUri?: string;
  replyCount: number;
  createdAt: string;
  indexedAt: string;
  deleted: boolean;
}

/**
 * Entity link view in API response format.
 */
export interface EntityLinkViewOutput {
  uri: string;
  cid: string;
  creator: {
    did: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
  };
  eprintUri: string;
  target: {
    source: string;
    selector?: {
      type: string;
      exact?: string;
      prefix?: string;
      suffix?: string;
    };
    refinedBy?: {
      type: string;
      start?: number;
      end?: number;
      pageNumber?: number;
      boundingRect?: unknown;
    };
    page?: number;
  };
  linkedEntity: {
    $type: string;
    [key: string]: unknown;
  };
  confidence?: number;
  createdAt: string;
  indexedAt: string;
}

/**
 * Output schema for listForEprint.
 */
export interface OutputSchema {
  annotations: AnnotationViewOutput[];
  entityLinks?: EntityLinkViewOutput[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Flattens annotation threads into a list with author info.
 *
 * @internal
 */
export function flattenThreads(
  threads: readonly ServiceAnnotationThread[],
  authorMap: Map<string, AuthorInfo>
): AnnotationViewOutput[] {
  const annotations: AnnotationViewOutput[] = [];

  function processThread(thread: ServiceAnnotationThread): void {
    const root = thread.root;
    annotations.push(mapAnnotationView(root, authorMap));
    for (const reply of thread.replies) {
      processThread(reply);
    }
  }

  for (const thread of threads) {
    processThread(thread);
  }

  return annotations;
}

/**
 * Maps a service AnnotationView to the API output format.
 *
 * @internal
 */
export function mapAnnotationView(
  view: ServiceAnnotationView,
  authorMap: Map<string, AuthorInfo>
): AnnotationViewOutput {
  const authorInfo = authorMap.get(view.annotator);

  // Build body from stored body array
  let body: AnnotationViewOutput['body'] = undefined;
  if (view.body && Array.isArray(view.body) && view.body.length > 0 && !view.deleted) {
    const textParts: string[] = [];
    const allFacets: unknown[] = [];

    let currentByteOffset = 0;
    for (const item of view.body as {
      type?: string;
      content?: string;
      facets?: {
        index: { byteStart: number; byteEnd: number };
        features: unknown[];
      }[];
    }[]) {
      if (item.type === 'text' && item.content) {
        textParts.push(item.content);
        if (item.facets) {
          for (const facet of item.facets) {
            allFacets.push({
              index: {
                byteStart: facet.index.byteStart + currentByteOffset,
                byteEnd: facet.index.byteEnd + currentByteOffset,
              },
              features: facet.features,
            });
          }
        }
        currentByteOffset += new TextEncoder().encode(item.content).length;
      }
    }

    const fullText = textParts.join('');
    if (fullText) {
      const facetsToUse =
        allFacets.length > 0
          ? allFacets
          : view.facets && Array.isArray(view.facets)
            ? (view.facets as unknown[])
            : undefined;
      body = {
        text: fullText,
        facets: facetsToUse,
      };
    }
  }

  // Build refinedBy, stripping $type from boundingRect to avoid cross-lexicon
  // $type mismatches (stored data may reference comment#boundingRect)
  const rawBoundingRect = view.target.refinedBy?.boundingRect as
    | (Record<string, unknown> & { $type?: string })
    | undefined;
  const sanitizedBoundingRect = rawBoundingRect
    ? Object.fromEntries(Object.entries(rawBoundingRect).filter(([k]) => k !== '$type'))
    : undefined;

  const refinedBy = view.target.refinedBy
    ? {
        type: 'TextPositionSelector' as const,
        start: view.target.refinedBy.start ?? 0,
        end: view.target.refinedBy.end ?? 0,
        pageNumber: view.target.refinedBy.pageNumber ?? view.target.pageNumber,
        boundingRect: sanitizedBoundingRect,
      }
    : view.target.pageNumber
      ? {
          type: 'TextPositionSelector' as const,
          start: 0,
          end: 0,
          pageNumber: view.target.pageNumber,
        }
      : undefined;

  return {
    uri: view.uri,
    cid: view.cid,
    author: {
      did: view.annotator,
      handle: authorInfo?.handle ?? view.annotator.split(':').pop() ?? 'unknown',
      displayName: authorInfo?.displayName,
      avatar: authorInfo?.avatar,
    },
    eprintUri: view.eprintUri,
    content: view.deleted ? '' : view.content,
    body,
    target: {
      source: view.target.source,
      selector: view.target.selector?.exact
        ? {
            type: 'TextQuoteSelector' as const,
            exact: view.target.selector.exact,
            prefix: view.target.selector.prefix,
            suffix: view.target.selector.suffix,
          }
        : undefined,
      refinedBy,
      page: view.target.refinedBy?.pageNumber ?? view.target.pageNumber,
    },
    motivation: view.motivation,
    parentAnnotationUri: view.parentAnnotation ?? undefined,
    replyCount: view.replyCount,
    createdAt: view.createdAt.toISOString(),
    indexedAt: view.indexedAt.toISOString(),
    deleted: view.deleted,
  };
}

/**
 * Maps a service EntityLinkView to the API output format.
 *
 * @internal
 */
export function mapEntityLinkView(
  view: ServiceEntityLinkView,
  authorMap: Map<string, AuthorInfo>
): EntityLinkViewOutput {
  const creatorInfo = authorMap.get(view.creator);

  // Build linkedEntity from entityType/entityData
  const entityData = (
    typeof view.entityData === 'object' && view.entityData !== null ? view.entityData : {}
  ) as Record<string, unknown>;

  // Spread entityData first, then override $type to match the listForEprint lexicon
  let linkedEntity: EntityLinkViewOutput['linkedEntity'];
  switch (view.entityType) {
    case 'graphNode':
      linkedEntity = {
        ...entityData,
        $type: 'pub.chive.annotation.listForEprint#graphNodeLink',
        type: 'graphNode',
        label: view.entityLabel,
      };
      break;
    case 'externalId':
      linkedEntity = {
        ...entityData,
        $type: 'pub.chive.annotation.listForEprint#externalIdLink',
        type: 'externalId',
        label: view.entityLabel,
      };
      break;
    case 'author':
      linkedEntity = {
        ...entityData,
        $type: 'pub.chive.annotation.listForEprint#authorLink',
        type: 'author',
        displayName: view.entityLabel,
      };
      break;
    case 'eprint':
      linkedEntity = {
        ...entityData,
        $type: 'pub.chive.annotation.listForEprint#eprintLink',
        type: 'eprint',
        title: view.entityLabel,
      };
      break;
    default:
      linkedEntity = {
        ...entityData,
        $type: 'pub.chive.annotation.listForEprint#graphNodeLink',
        type: view.entityType,
        label: view.entityLabel,
      };
  }

  return {
    uri: view.uri,
    cid: view.cid,
    creator: {
      did: view.creator,
      handle: creatorInfo?.handle,
      displayName: creatorInfo?.displayName,
      avatar: creatorInfo?.avatar,
    },
    eprintUri: view.eprintUri,
    target: {
      source: view.target.source,
      selector: view.target.selector?.exact
        ? {
            type: 'TextQuoteSelector' as const,
            exact: view.target.selector.exact,
            prefix: view.target.selector.prefix,
            suffix: view.target.selector.suffix,
          }
        : undefined,
      refinedBy: view.target.refinedBy
        ? (() => {
            const rawRect = view.target.refinedBy.boundingRect as
              | (Record<string, unknown> & { $type?: string })
              | undefined;
            const rect = rawRect
              ? Object.fromEntries(Object.entries(rawRect).filter(([k]) => k !== '$type'))
              : undefined;
            return {
              type: 'TextPositionSelector' as const,
              start: view.target.refinedBy.start ?? 0,
              end: view.target.refinedBy.end ?? 0,
              pageNumber: view.target.refinedBy.pageNumber ?? view.target.pageNumber,
              boundingRect: rect,
            };
          })()
        : undefined,
      page: view.target.refinedBy?.pageNumber ?? view.target.pageNumber,
    },
    linkedEntity,
    confidence: view.confidence,
    createdAt: view.createdAt.toISOString(),
    indexedAt: view.indexedAt.toISOString(),
  };
}

/**
 * Collects all unique annotator DIDs from annotation threads.
 *
 * @internal
 */
export function collectAnnotatorDids(threads: readonly ServiceAnnotationThread[]): Set<string> {
  const dids = new Set<string>();

  function processThread(thread: ServiceAnnotationThread): void {
    dids.add(thread.root.annotator);
    for (const reply of thread.replies) {
      processThread(reply);
    }
  }

  for (const thread of threads) {
    processThread(thread);
  }

  return dids;
}

/**
 * XRPC method for pub.chive.annotation.listForEprint.
 *
 * @remarks
 * Returns a paginated list of annotations for an eprint, with optional entity links.
 *
 * @public
 */
export const listForEprint: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: false,
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const annotationService = c.get('services').annotation;

    logger.debug('Listing annotations for eprint', {
      eprintUri: params.eprintUri,
      motivation: params.motivation,
      pageNumber: params.pageNumber,
      includeEntityLinks: params.includeEntityLinks,
      limit: params.limit,
      cursor: params.cursor,
    });

    // Get threaded annotations
    const threads = await annotationService.getAnnotations(params.eprintUri as AtUri, {
      pageNumber: params.pageNumber,
      motivation: params.motivation,
    });

    // Batch resolve author info
    const annotatorDids = collectAnnotatorDids(threads);
    const authorInfoMap = await annotationService.getAuthorInfoByDids(annotatorDids);

    const authorMap = new Map<string, AuthorInfo>();
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
    const allAnnotations = flattenThreads(threads, authorMap);

    // Apply pagination
    const limit = params.limit ?? 50;
    let startIndex = 0;

    if (params.cursor) {
      startIndex = parseInt(params.cursor, 10) || 0;
    }

    const total = allAnnotations.length;
    const endIndex = startIndex + limit;
    const paginatedAnnotations = allAnnotations.slice(startIndex, endIndex);
    const hasMore = endIndex < allAnnotations.length;

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
      annotations: paginatedAnnotations,
      entityLinks,
      cursor: hasMore ? String(endIndex) : undefined,
      hasMore,
      total,
    };

    logger.info('Annotations listed for eprint', {
      eprintUri: params.eprintUri,
      count: response.annotations.length,
    });

    return { encoding: 'application/json', body: response };
  },
};
