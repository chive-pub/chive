/**
 * Backlink XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

import { create } from './create.js';
import { deleteBacklink } from './delete.js';
import { getCounts } from './getCounts.js';
import { list } from './list.js';

export { create as backlinkCreate } from './create.js';
export { deleteBacklink as backlinkDelete } from './delete.js';
export { getCounts as backlinkGetCounts } from './getCounts.js';
export { list as backlinkList } from './list.js';

/**
 * Backlink XRPC methods keyed by NSID.
 *
 * @public
 */
export const backlinkMethods = {
  'pub.chive.backlink.list': list,
  'pub.chive.backlink.getCounts': getCounts,
  'pub.chive.backlink.create': create,
  'pub.chive.backlink.delete': deleteBacklink,
} as const;
