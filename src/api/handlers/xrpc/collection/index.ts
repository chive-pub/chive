/**
 * XRPC collection handler exports.
 *
 * @remarks
 * User-curated collection API endpoints for browsing, searching, and
 * navigating collection hierarchies.
 *
 * @packageDocumentation
 * @public
 */

import type { XRPCMethod } from '../../../xrpc/types.js';

import { get } from './get.js';
import { getContaining } from './getContaining.js';
import { getFeed } from './getFeed.js';
import { getParent } from './getParent.js';
import { getSubcollections } from './getSubcollections.js';
import { listByOwner } from './listByOwner.js';
import { listPublic } from './listPublic.js';
import { search } from './search.js';

// Re-export handlers
export { get } from './get.js';
export { getContaining } from './getContaining.js';
export { getFeed } from './getFeed.js';
export { getParent } from './getParent.js';
export { getSubcollections } from './getSubcollections.js';
export { listByOwner } from './listByOwner.js';
export { listPublic } from './listPublic.js';
export { search } from './search.js';

// Re-export types
export type { CollectionView } from './types.js';
export type { GetCollectionParams, GetCollectionOutput } from './get.js';
export type { GetFeedParams, GetFeedOutput } from './getFeed.js';
export type { ListByOwnerParams, ListByOwnerOutput } from './listByOwner.js';
export type { ListPublicParams, ListPublicOutput } from './listPublic.js';
export type { SearchCollectionsParams, SearchCollectionsOutput } from './search.js';
export type { GetContainingParams, GetContainingOutput } from './getContaining.js';
export type { GetParentParams, GetParentOutput } from './getParent.js';
export type { GetSubcollectionsParams, GetSubcollectionsOutput } from './getSubcollections.js';

/**
 * All collection XRPC methods keyed by NSID.
 *
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const collectionMethods: Record<string, XRPCMethod<any, any, any>> = {
  'pub.chive.collection.get': get,
  'pub.chive.collection.getFeed': getFeed,
  'pub.chive.collection.listByOwner': listByOwner,
  'pub.chive.collection.listPublic': listPublic,
  'pub.chive.collection.search': search,
  'pub.chive.collection.getContaining': getContaining,
  'pub.chive.collection.getParent': getParent,
  'pub.chive.collection.getSubcollections': getSubcollections,
};
