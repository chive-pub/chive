/**
 * XRPC handler for pub.chive.collection.get.
 *
 * @remarks
 * Retrieves a single collection by AT-URI with items, subcollections, and
 * inter-item edges. Visibility-gated: public collections are accessible to
 * anyone; private collections are visible only to the owner.
 *
 * All collection items are personal graph nodes. Item data (label, kind,
 * subkind, metadata) comes fully resolved from the personal_graph_nodes_index
 * join in getCollectionItems().
 *
 * @packageDocumentation
 * @public
 */

import type { Redis } from 'ioredis';

import { DIDResolver } from '../../../../auth/did/did-resolver.js';
import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/collection/get.js';
import type { AtUri, DID } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { ILogger } from '../../../../types/interfaces/logger.interface.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

import { mapCollectionToView } from './utils.js';

/** Re-exported query parameters for pub.chive.collection.get. */
export type GetCollectionParams = QueryParams;

/** Re-exported output schema for pub.chive.collection.get. */
export type GetCollectionOutput = OutputSchema;

/**
 * XRPC method for pub.chive.collection.get query.
 *
 * @public
 */
export const get: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { collection: collectionService } = c.get('services');
    const logger = c.get('logger');
    const redis = c.get('redis');
    const user = c.get('user');

    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    if (!collectionService) {
      throw new NotFoundError('Collection', params.uri);
    }

    logger.debug('Getting collection', { uri: params.uri });

    const result = await collectionService.getCollection(params.uri as AtUri, user?.did);

    if (!result) {
      throw new NotFoundError('Collection', params.uri);
    }

    // Fetch items, subcollections, inter-item edges, and owner handle in parallel
    const [itemsResult, subcollections, interItemEdges, ownerHandle] = await Promise.all([
      collectionService
        .getCollectionItems(params.uri as AtUri, {
          excludeSubcollectionItems: params.excludeSubcollectionItems,
        })
        .catch(() => ({ ok: false as const, error: null })),
      collectionService.getSubcollections(params.uri as AtUri, user?.did).catch(() => []),
      collectionService.getInterItemEdges(params.uri as AtUri).catch(() => []),
      resolveOwnerHandle(result.ownerDid, redis, logger),
    ]);

    const items = itemsResult.ok ? itemsResult.value : [];

    const response: OutputSchema = {
      collection: {
        ...mapCollectionToView(result),
        ownerHandle,
      },
      items: items.map((item) => ({
        edgeUri: item.edgeUri,
        itemUri: item.itemUri,
        itemType: item.subkind ?? 'unknown',
        note: item.note,
        order: item.order,
        addedAt: item.addedAt.toISOString(),
        title: item.title,
        label: item.label,
        kind: item.kind,
        subkind: item.subkind,
        description: item.description,
        authors: item.metadata?.authors as string[] | undefined,
        avatar: item.metadata?.avatarUrl as string | undefined,
        source: item.metadata?.clonedFrom ? 'community' : 'personal',
        metadata: item.metadata,
      })),
      subcollections: subcollections.map(mapCollectionToView),
      interItemEdges: interItemEdges.map((e) => ({
        edgeUri: e.uri,
        sourceUri: e.sourceUri,
        targetUri: e.targetUri,
        relationSlug: e.relationSlug,
      })),
    };

    logger.info('Collection retrieved', {
      uri: params.uri,
      itemCount: result.itemCount,
      items: items.length,
      subcollections: subcollections.length,
      interItemEdges: interItemEdges.length,
    });

    return { encoding: 'application/json', body: response };
  },
};

/**
 * Resolves a DID to a human-readable handle via PLC directory.
 *
 * @param did - DID to resolve
 * @param redis - Redis client for caching
 * @param logger - Logger instance
 * @returns Handle string or undefined if resolution fails
 *
 * @internal
 */
async function resolveOwnerHandle(
  did: DID,
  redis: Redis,
  logger: ILogger
): Promise<string | undefined> {
  try {
    const didResolver = new DIDResolver({ redis, logger });
    const atprotoData = await didResolver.getAtprotoData(did);
    return atprotoData?.handle;
  } catch {
    return undefined;
  }
}
