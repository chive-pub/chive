/**
 * Author XRPC method exports.
 *
 * @packageDocumentation
 * @public
 */

export { getProfile } from './getProfile.js';
export { searchAuthors } from './searchAuthors.js';

import { getProfile } from './getProfile.js';
import { searchAuthors } from './searchAuthors.js';

/**
 * All author XRPC methods keyed by NSID.
 */
export const authorMethods = {
  'pub.chive.author.getProfile': getProfile,
  'pub.chive.author.searchAuthors': searchAuthors,
} as const;
