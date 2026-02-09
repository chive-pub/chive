/**
 * Annotation XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { getThread } from './getThread.js';
export { listByAuthor } from './listByAuthor.js';
export { listForEprint } from './listForEprint.js';
export { listForPage } from './listForPage.js';

import { getThread } from './getThread.js';
import { listByAuthor } from './listByAuthor.js';
import { listForEprint } from './listForEprint.js';
import { listForPage } from './listForPage.js';

/**
 * All annotation XRPC methods keyed by NSID.
 */
export const annotationMethods = {
  'pub.chive.annotation.listForEprint': listForEprint,
  'pub.chive.annotation.listForPage': listForPage,
  'pub.chive.annotation.getThread': getThread,
  'pub.chive.annotation.listByAuthor': listByAuthor,
} as const;
