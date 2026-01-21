/**
 * XRPC eprint handler exports.
 *
 * @packageDocumentation
 * @public
 */

export { getSubmission } from './getSubmission.js';
export { searchSubmissions } from './searchSubmissions.js';
export { listByAuthor } from './listByAuthor.js';

import { getSubmission } from './getSubmission.js';
import { listByAuthor } from './listByAuthor.js';
import { searchSubmissions } from './searchSubmissions.js';

/**
 * All eprint XRPC methods keyed by NSID.
 */
export const eprintMethods = {
  'pub.chive.eprint.getSubmission': getSubmission,
  'pub.chive.eprint.searchSubmissions': searchSubmissions,
  'pub.chive.eprint.listByAuthor': listByAuthor,
} as const;
