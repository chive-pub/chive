/**
 * Shared utilities for collection XRPC handlers.
 *
 * @packageDocumentation
 * @public
 */

import type { IndexedCollection } from '../../../../services/collection/collection-service.js';

import type { CollectionView } from './types.js';

/**
 * Maps an IndexedCollection from the service layer to the API response format.
 *
 * @param collection - Indexed collection from the service
 * @returns Collection view for the API response
 *
 * @public
 */
export function mapCollectionToView(collection: IndexedCollection): CollectionView {
  return {
    uri: collection.uri as string,
    cid: collection.cid,
    ownerDid: collection.ownerDid as string,
    label: collection.label,
    description: collection.description,
    visibility: collection.visibility,
    itemCount: collection.itemCount,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt?.toISOString(),
  };
}
