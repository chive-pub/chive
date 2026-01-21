/**
 * Review XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { getThread } from './getThread.js';
export { listForAuthor } from './listForAuthor.js';
export { listForEprint } from './listForEprint.js';

import { getThread } from './getThread.js';
import { listForAuthor } from './listForAuthor.js';
import { listForEprint } from './listForEprint.js';

/**
 * All review XRPC methods keyed by NSID.
 */
export const reviewMethods = {
  'pub.chive.review.getThread': getThread,
  'pub.chive.review.listForAuthor': listForAuthor,
  'pub.chive.review.listForEprint': listForEprint,
} as const;
